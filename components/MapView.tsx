"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { IFeature, ILayer } from "@/types/groundwork";

type DrawingMode =
  | "select"
  | "polygon"
  | "rectangle"
  | "circle"
  | "polyline"
  | "line"
  | "text";

interface MapViewProps {
  snapshot: {
    center: { lat: number; lng: number };
    zoom: number;
    heading: number;
  } | null;
  features: IFeature[];
  layers: ILayer[];
  drawingMode: DrawingMode;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  onCreateFeature: (feature: Partial<IFeature>) => Promise<any>;
  onUpdateFeature: (featureId: string, updates: Partial<IFeature>) => void;
  canEdit: boolean;
  onCaptureReady?: (
    captureFn: () => {
      center: { lat: number; lng: number };
      zoom: number;
      heading: number;
    } | null,
  ) => void;
}

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const DEFAULT_ZOOM = 18;

if (typeof window !== "undefined") {
  setOptions({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "",
    v: "weekly",
  });
}

// ─── Helpers ──────────────────────────────────────

function toDrawingManagerMode(
  mode: DrawingMode,
): google.maps.drawing.OverlayType | null {
  switch (mode) {
    case "polygon":
      return google.maps.drawing.OverlayType.POLYGON;
    case "rectangle":
      return google.maps.drawing.OverlayType.RECTANGLE;
    case "circle":
      return google.maps.drawing.OverlayType.CIRCLE;
    case "polyline":
    case "line":
      return google.maps.drawing.OverlayType.POLYLINE;
    default:
      return null;
  }
}

/** Centroid of coordinate pairs. Strips closing point if ring. */
function centroidOf(coords: number[][]): [number, number] {
  const pts =
    coords.length > 1 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords.slice(0, -1)
      : coords;
  const sLng = pts.reduce((s, c) => s + c[0], 0);
  const sLat = pts.reduce((s, c) => s + c[1], 0);
  return [sLng / pts.length, sLat / pts.length];
}

/** Rotate [lng,lat] coords around centroid by angle (radians).
 *  Compensates for longitude compression at latitude so shapes
 *  don't distort (1° lng ≠ 1° lat except at the equator). */
function rotateCoords(
  coords: number[][],
  cx: number,
  cy: number,
  angle: number,
): number[][] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cosLat = Math.cos((cy * Math.PI) / 180);
  return coords.map(([lng, lat]) => {
    // Scale to local meters-like space
    const dx = (lng - cx) * cosLat;
    const dy = lat - cy;
    // Rotate
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    // Unscale back to lng/lat
    return [cx + rx / cosLat, cy + ry];
  });
}

/** Dot product of 2D vectors. */
function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/** Normalize a 2D vector, returns [0,0] for zero-length. */
function normalize(x: number, y: number): [number, number] {
  const len = Math.sqrt(x * x + y * y);
  return len > 0 ? [x / len, y / len] : [0, 0];
}

// ─── Component ────────────────────────────────────

export default function MapView({
  snapshot,
  features,
  layers,
  drawingMode,
  selectedFeatureId,
  onSelectFeature,
  onCreateFeature,
  onUpdateFeature,
  canEdit,
  onCaptureReady,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(
    null,
  );

  // All overlays: feature shapes, handles, tethers. Keyed by ID.
  const overlaysRef = useRef<Map<string, google.maps.MVCObject>>(new Map());

  const justSelectedRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const onCreateFeatureRef = useRef(onCreateFeature);
  const onSelectFeatureRef = useRef(onSelectFeature);
  const layersRef = useRef(layers);
  useEffect(() => {
    onCreateFeatureRef.current = onCreateFeature;
  }, [onCreateFeature]);
  useEffect(() => {
    onSelectFeatureRef.current = onSelectFeature;
  }, [onSelectFeature]);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const getVisibleLayerIds = useCallback(() => {
    return new Set(layers.filter((l) => l.visible).map((l) => l.id));
  }, [layers]);

  // ─── Map + DrawingManager init ─────────────────

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey) {
      console.error("Google Maps API key not configured");
      return;
    }

    let cancelled = false;

    (async () => {
      const [mapsLib, drawingLib] = await Promise.all([
        importLibrary("maps") as Promise<google.maps.MapsLibrary>,
        importLibrary("drawing") as Promise<google.maps.DrawingLibrary>,
      ]);
      if (cancelled || !mapRef.current || mapInstance.current) return;

      const map = new mapsLib.Map(mapRef.current, {
        center: snapshot?.center || DEFAULT_CENTER,
        zoom: snapshot?.zoom || DEFAULT_ZOOM,
        heading: snapshot?.heading || 0,
        tilt: 0,
        mapTypeId: "satellite",
        disableDefaultUI: false,
        zoomControl: true,
        scrollwheel: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
      });

      const previewStyle = {
        strokeColor: "#1d4ed8",
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
      };
      const dm = new drawingLib.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: previewStyle,
        rectangleOptions: previewStyle,
        circleOptions: previewStyle,
        polylineOptions: { strokeColor: "#1d4ed8", strokeWeight: 2 },
        map,
      });

      dm.addListener(
        "overlaycomplete",
        (e: google.maps.drawing.OverlayCompleteEvent) => {
          const layerId = layersRef.current[0]?.id || "";
          const overlay = e.overlay;

          if (e.type === google.maps.drawing.OverlayType.POLYGON) {
            const poly = overlay as google.maps.Polygon;
            const coords = poly
              .getPath()
              .getArray()
              .map((p) => [p.lng(), p.lat()]);
            coords.push(coords[0]);
            onCreateFeatureRef.current({
              type: "polygon",
              layerId,
              geometry: { type: "Polygon", coordinates: [coords] },
              properties: {
                fillColor: "#3b82f6",
                fillOpacity: 0.3,
                strokeColor: "#1d4ed8",
                strokeWidth: 2,
              },
            });
          } else if (e.type === google.maps.drawing.OverlayType.RECTANGLE) {
            const rect = overlay as google.maps.Rectangle;
            const b = rect.getBounds()!;
            const sw = b.getSouthWest(),
              ne = b.getNorthEast();
            const coords = [
              [sw.lng(), sw.lat()],
              [ne.lng(), sw.lat()],
              [ne.lng(), ne.lat()],
              [sw.lng(), ne.lat()],
              [sw.lng(), sw.lat()],
            ];
            onCreateFeatureRef.current({
              type: "rectangle",
              layerId,
              geometry: { type: "Polygon", coordinates: [coords] },
              properties: {
                fillColor: "#3b82f6",
                fillOpacity: 0.3,
                strokeColor: "#1d4ed8",
                strokeWidth: 2,
              },
            });
          } else if (e.type === google.maps.drawing.OverlayType.CIRCLE) {
            const circle = overlay as google.maps.Circle;
            const c = circle.getCenter()!;
            onCreateFeatureRef.current({
              type: "circle",
              layerId,
              geometry: {
                type: "Point",
                coordinates: [c.lng(), c.lat()],
                radius: circle.getRadius(),
              } as any,
              properties: {
                fillColor: "#3b82f6",
                fillOpacity: 0.3,
                strokeColor: "#1d4ed8",
                strokeWidth: 2,
              },
            });
          } else if (e.type === google.maps.drawing.OverlayType.POLYLINE) {
            const line = overlay as google.maps.Polyline;
            const coords = line
              .getPath()
              .getArray()
              .map((p) => [p.lng(), p.lat()]);
            onCreateFeatureRef.current({
              type: coords.length <= 2 ? "line" : "polyline",
              layerId,
              geometry: { type: "LineString", coordinates: coords },
              properties: {
                strokeColor: "#1d4ed8",
                strokeWidth: 2,
                strokeStyle: "solid",
              },
            });
          }

          overlay.setMap(null);
        },
      );

      drawingManagerRef.current = dm;
      mapInstance.current = map;
      setMapLoaded(true);

      if (onCaptureReady) {
        onCaptureReady(() => {
          const c = map.getCenter();
          if (!c) return null;
          return {
            center: { lat: c.lat(), lng: c.lng() },
            zoom: map.getZoom() || DEFAULT_ZOOM,
            heading: map.getHeading() || 0,
          };
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Sync snapshot ─────────────────────────────

  useEffect(() => {
    if (!mapInstance.current || !snapshot) return;
    mapInstance.current.panTo(snapshot.center);
    mapInstance.current.setZoom(snapshot.zoom);
    mapInstance.current.setHeading(snapshot.heading);
  }, [
    snapshot?.center?.lat,
    snapshot?.center?.lng,
    snapshot?.zoom,
    snapshot?.heading,
  ]);

  // ─── Sync drawing mode ─────────────────────────

  useEffect(() => {
    if (!drawingManagerRef.current || !mapInstance.current) return;
    const map = mapInstance.current;
    const dm = drawingManagerRef.current;
    if (drawingMode === "select" || drawingMode === "text") {
      dm.setDrawingMode(null);
      map.setOptions({ draggable: true, gestureHandling: "greedy" });
    } else {
      dm.setDrawingMode(toDrawingManagerMode(drawingMode));
      map.setOptions({ draggable: false, gestureHandling: "greedy" });
    }
  }, [drawingMode, mapLoaded]);

  // ─── Text placement + deselect ─────────────────

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    const map = mapInstance.current;
    if (drawingMode === "text") {
      const listener = map.addListener(
        "click",
        (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          onCreateFeatureRef.current({
            type: "text",
            layerId: layersRef.current[0]?.id || "",
            geometry: {
              type: "Point",
              coordinates: [e.latLng.lng(), e.latLng.lat()],
            },
            properties: {
              text: "New Text",
              fontSize: 14,
              strokeColor: "#000000",
            },
          });
        },
      );
      return () => {
        google.maps.event.removeListener(listener);
      };
    }
    if (drawingMode === "select") {
      const listener = map.addListener("click", () => {
        if (justSelectedRef.current) {
          justSelectedRef.current = false;
          return;
        }
        onSelectFeatureRef.current(null);
      });
      return () => {
        google.maps.event.removeListener(listener);
      };
    }
  }, [drawingMode, mapLoaded]);

  // ─── Feature rendering + handles ───────────────

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    const map = mapInstance.current;
    const visibleLayerIds = getVisibleLayerIds();

    const selectFeature = (id: string) => {
      justSelectedRef.current = true;
      onSelectFeature(id);
    };

    // Teardown all existing overlays
    overlaysRef.current.forEach((o: any) => {
      o.setMap?.(null);
    });
    overlaysRef.current.clear();

    // ─── Helper: store overlay in ref ─────────────
    const store = (key: string, overlay: any) => {
      overlay.setMap(map);
      overlaysRef.current.set(key, overlay);
    };

    // ─── Helper: rotation handle ──────────────────
    //
    // Places a draggable marker above the shape. Dragging it rotates all
    // coordinates around the centroid. A tether line connects them.
    //
    // Works for polygon, rectangle, polyline, line.
    //
    const addRotationHandle = (
      featureId: string,
      rawCoords: number[][],
      isRing: boolean,
      shapeOverlay: google.maps.Polygon | google.maps.Polyline,
    ) => {
      const [cx, cy] = centroidOf(rawCoords);
      const maxLat = Math.max(...rawCoords.map((c) => c[1]));
      const minLat = Math.min(...rawCoords.map((c) => c[1]));
      const offset = Math.max((maxLat - minLat) * 0.35, 0.00015);
      const handleLat = maxLat + offset;

      const tether = new google.maps.Polyline({
        path: [
          new google.maps.LatLng(cy, cx),
          new google.maps.LatLng(handleLat, cx),
        ],
        strokeColor: "#6366f1",
        strokeWeight: 1,
        strokeOpacity: 0.6,
        clickable: false,
      });
      store(`rot-line-${featureId}`, tether);

      const handle = new google.maps.Marker({
        position: new google.maps.LatLng(handleLat, cx),
        draggable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#6366f1",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: 1000,
      });
      store(`rot-${featureId}`, handle);

      // Capture coords at drag start, compute angle delta during drag
      let startCoords = rawCoords;

      handle.addListener("dragstart", () => {
        if (shapeOverlay instanceof google.maps.Polygon) {
          startCoords = shapeOverlay
            .getPath()
            .getArray()
            .map((p) => [p.lng(), p.lat()]);
          if (isRing) startCoords.push(startCoords[0]);
        } else {
          startCoords = (shapeOverlay as google.maps.Polyline)
            .getPath()
            .getArray()
            .map((p) => [p.lng(), p.lat()]);
        }
      });

      const cosLat = Math.cos((cy * Math.PI) / 180);

      handle.addListener("drag", () => {
        const pos = handle.getPosition();
        if (!pos) return;
        // Compute angle in corrected space so rotation looks uniform
        const angle =
          Math.atan2(pos.lat() - cy, (pos.lng() - cx) * cosLat) - Math.PI / 2;
        const rotated = rotateCoords(startCoords, cx, cy, angle);

        const pathCoords = isRing ? rotated.slice(0, -1) : rotated;
        const newPath = pathCoords.map(
          ([lng, lat]) => new google.maps.LatLng(lat, lng),
        );
        if (shapeOverlay instanceof google.maps.Polygon) {
          shapeOverlay.setPath(newPath);
        } else {
          (shapeOverlay as google.maps.Polyline).setPath(newPath);
        }

        tether.setPath([new google.maps.LatLng(cy, cx), pos]);
      });

      handle.addListener("dragend", () => {
        const pos = handle.getPosition();
        if (!pos) return;
        const angle =
          Math.atan2(pos.lat() - cy, (pos.lng() - cx) * cosLat) - Math.PI / 2;
        const rotated = rotateCoords(startCoords, cx, cy, angle);

        if (isRing) {
          onUpdateFeature(featureId, {
            geometry: { type: "Polygon", coordinates: [rotated] } as any,
          } as any);
        } else {
          onUpdateFeature(featureId, {
            geometry: { type: "LineString", coordinates: rotated } as any,
          } as any);
        }
      });
    };

    // ─── Helper: rectangle scale handles ──────────
    //
    // 4 corner markers that maintain rectangular constraint when dragged.
    // When you drag corner i, opposite corner (i+2)%4 stays fixed.
    // Adjacent corners adjust to keep right angles.
    //
    const addRectScaleHandles = (
      featureId: string,
      shapeOverlay: google.maps.Polygon,
    ) => {
      const getCorners = (): number[][] => {
        const path = shapeOverlay.getPath().getArray();
        return path.map((p) => [p.lng(), p.lat()]);
      };

      const corners = getCorners();

      for (let i = 0; i < 4; i++) {
        const handle = new google.maps.Marker({
          position: new google.maps.LatLng(corners[i][1], corners[i][0]),
          draggable: true,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: "#ffffff",
            fillOpacity: 1,
            strokeColor: "#1d4ed8",
            strokeWeight: 2,
          },
          zIndex: 999,
        });
        store(`scale-${featureId}-${i}`, handle);

        const cornerIndex = i;

        handle.addListener("drag", () => {
          const pos = handle.getPosition();
          if (!pos) return;
          const c = getCorners();
          const oppIdx = (cornerIndex + 2) % 4;
          const adj1Idx = (cornerIndex + 1) % 4;
          const adj2Idx = (cornerIndex + 3) % 4;

          const O = c[oppIdx]; // fixed corner

          // Work in equirectangular-corrected space so perpendicularity is real
          const [cxc, cyc] = centroidOf(c);
          const cosLat = Math.cos((cyc * Math.PI) / 180);

          // Convert to local corrected coords
          const toLocal = (p: number[]) => [
            (p[0] - O[0]) * cosLat,
            p[1] - O[1],
          ];
          const lA1 = toLocal(c[adj1Idx]);
          const lA2 = toLocal(c[adj2Idx]);
          const lDrag = [(pos.lng() - O[0]) * cosLat, pos.lat() - O[1]];

          // Edge directions in corrected space
          const [e1x, e1y] = normalize(lA1[0], lA1[1]);
          const [e2x, e2y] = normalize(lA2[0], lA2[1]);

          // Project drag onto those axes
          const proj1 = dot(lDrag[0], lDrag[1], e1x, e1y);
          const proj2 = dot(lDrag[0], lDrag[1], e2x, e2y);

          // Recompute corners in corrected space, then convert back
          const fromLocal = (lx: number, ly: number): number[] => [
            O[0] + lx / cosLat,
            O[1] + ly,
          ];

          const newCorners: number[][] = [[], [], [], []];
          newCorners[oppIdx] = [...O];
          newCorners[adj1Idx] = fromLocal(proj1 * e1x, proj1 * e1y);
          newCorners[adj2Idx] = fromLocal(proj2 * e2x, proj2 * e2y);
          newCorners[cornerIndex] = fromLocal(
            proj1 * e1x + proj2 * e2x,
            proj1 * e1y + proj2 * e2y,
          );

          // Update shape preview
          const newPath = newCorners.map(
            ([lng, lat]) => new google.maps.LatLng(lat, lng),
          );
          shapeOverlay.setPath(newPath);

          // Update all corner handle positions
          for (let j = 0; j < 4; j++) {
            const h = overlaysRef.current.get(`scale-${featureId}-${j}`) as
              | google.maps.Marker
              | undefined;
            if (h && j !== cornerIndex) {
              h.setPosition(
                new google.maps.LatLng(newCorners[j][1], newCorners[j][0]),
              );
            }
          }
        });

        handle.addListener("dragend", () => {
          const c = getCorners();
          const closed = [...c, c[0]];
          onUpdateFeature(featureId, {
            geometry: { type: "Polygon", coordinates: [closed] } as any,
          } as any);
        });
      }
    };

    // ─── Render each feature ──────────────────────

    features.forEach((feature) => {
      if (!visibleLayerIds.has(feature.layerId)) return;

      const props = feature.properties || {};
      const isSelected = feature._id === selectedFeatureId;
      const strokeColor = props.strokeColor || "#1d4ed8";
      const strokeWidth = (props.strokeWidth || 2) + (isSelected ? 2 : 0);
      const fillColor = props.fillColor || "#3b82f6";
      const fillOpacity = props.fillOpacity ?? 0.3;
      const strokeStyle = props.strokeStyle || "solid";
      const id = feature._id;

      // ── Polygon & Rectangle: both render as google.maps.Polygon ──
      if (feature.type === "polygon" || feature.type === "rectangle") {
        const geom = feature.geometry as any;
        if (!geom?.coordinates?.[0]) return;
        const coordsRaw = geom.coordinates[0] as number[][];
        const path = coordsRaw.map(
          (c: number[]) => new google.maps.LatLng(c[1], c[0]),
        );
        // Strip closing point for the Polygon path
        const displayPath =
          coordsRaw.length > 1 &&
          coordsRaw[0][0] === coordsRaw[coordsRaw.length - 1][0] &&
          coordsRaw[0][1] === coordsRaw[coordsRaw.length - 1][1]
            ? path.slice(0, -1)
            : path;

        const polygon = new google.maps.Polygon({
          paths: displayPath,
          strokeColor,
          strokeWeight: strokeWidth,
          fillColor,
          fillOpacity,
          // Polygons get Google's vertex handles; rectangles get our custom scale handles
          editable: isSelected && canEdit && feature.type === "polygon",
          draggable: isSelected && canEdit,
        });
        store(id, polygon);
        polygon.addListener("click", () => selectFeature(id));

        if (isSelected && canEdit) {
          // Polygon: free vertex editing via Google's built-in handles
          if (feature.type === "polygon") {
            const pathChanged = () => {
              const newPath = polygon.getPath().getArray();
              const coords = newPath.map((p) => [p.lng(), p.lat()]);
              coords.push(coords[0]);
              onUpdateFeature(id, {
                geometry: { type: "Polygon", coordinates: [coords] },
              } as any);
            };
            google.maps.event.addListener(
              polygon.getPath(),
              "set_at",
              pathChanged,
            );
            google.maps.event.addListener(
              polygon.getPath(),
              "insert_at",
              pathChanged,
            );
            polygon.addListener("dragend", pathChanged);
          }

          // Rectangle: custom corner handles for constrained scaling
          if (feature.type === "rectangle") {
            polygon.addListener("dragend", () => {
              const newPath = polygon.getPath().getArray();
              const coords = newPath.map((p) => [p.lng(), p.lat()]);
              coords.push(coords[0]);
              onUpdateFeature(id, {
                geometry: { type: "Polygon", coordinates: [coords] },
              } as any);
            });
            addRectScaleHandles(id, polygon);
          }

          // Rotation handle for both
          addRotationHandle(id, coordsRaw, true, polygon);
        }

        // ── Circle ──
      } else if (feature.type === "circle") {
        const geom = feature.geometry as any;
        if (!geom?.coordinates) return;
        const center = new google.maps.LatLng(
          geom.coordinates[1],
          geom.coordinates[0],
        );
        const radius = (geom as any).radius || 50;
        const circle = new google.maps.Circle({
          center,
          radius,
          strokeColor,
          strokeWeight: strokeWidth,
          fillColor,
          fillOpacity,
          editable: isSelected && canEdit,
          draggable: isSelected && canEdit,
        });
        store(id, circle);
        circle.addListener("click", () => selectFeature(id));
        if (isSelected && canEdit) {
          const updateCircle = () => {
            const c = circle.getCenter();
            if (!c) return;
            onUpdateFeature(id, {
              geometry: {
                type: "Point",
                coordinates: [c.lng(), c.lat()],
                radius: circle.getRadius(),
              } as any,
            } as any);
          };
          circle.addListener("center_changed", updateCircle);
          circle.addListener("radius_changed", updateCircle);
        }
        // No rotation — circles are rotationally symmetric

        // ── Polyline & Line ──
      } else if (feature.type === "polyline" || feature.type === "line") {
        const geom = feature.geometry as any;
        if (!geom?.coordinates) return;
        const coordsRaw = geom.coordinates as number[][];
        const path = coordsRaw.map(
          (c: number[]) => new google.maps.LatLng(c[1], c[0]),
        );
        const polyline = new google.maps.Polyline({
          path,
          strokeColor,
          strokeWeight: strokeWidth,
          editable: isSelected && canEdit,
          draggable: isSelected && canEdit,
          icons:
            strokeStyle === "dashed"
              ? [
                  {
                    icon: {
                      path: "M 0,-1 0,1",
                      strokeOpacity: 1,
                      scale: strokeWidth,
                    },
                    offset: "0",
                    repeat: "16px",
                  },
                ]
              : strokeStyle === "dotted"
                ? [
                    {
                      icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        strokeOpacity: 1,
                        scale: strokeWidth / 2,
                      },
                      offset: "0",
                      repeat: "10px",
                    },
                  ]
                : undefined,
          strokeOpacity: strokeStyle === "solid" ? 1 : 0,
        });
        if (props.arrowEnd) {
          polyline.setOptions({
            icons: [
              ...(polyline.get("icons") || []),
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 3,
                },
                offset: "100%",
              },
            ],
          });
        }
        if (props.arrowStart) {
          polyline.setOptions({
            icons: [
              ...(polyline.get("icons") || []),
              {
                icon: {
                  path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                  scale: 3,
                },
                offset: "0%",
              },
            ],
          });
        }
        store(id, polyline);
        polyline.addListener("click", () => selectFeature(id));
        if (isSelected && canEdit) {
          const pathChanged = () => {
            const newPath = polyline.getPath().getArray();
            const coords = newPath.map((p) => [p.lng(), p.lat()]);
            onUpdateFeature(id, {
              geometry: { type: "LineString", coordinates: coords },
            } as any);
          };
          google.maps.event.addListener(
            polyline.getPath(),
            "set_at",
            pathChanged,
          );
          google.maps.event.addListener(
            polyline.getPath(),
            "insert_at",
            pathChanged,
          );
          polyline.addListener("dragend", pathChanged);

          // Rotation handle
          addRotationHandle(id, coordsRaw, false, polyline);
        }

        // ── Text ──
      } else if (feature.type === "text") {
        const geom = feature.geometry as any;
        if (!geom?.coordinates) return;
        const position = new google.maps.LatLng(
          geom.coordinates[1],
          geom.coordinates[0],
        );
        const text = props.text || props.label || "Text";
        const fontSize = props.fontSize || 14;
        const marker = new google.maps.Marker({
          position,
          label: {
            text,
            color: strokeColor,
            fontSize: `${fontSize}px`,
            fontWeight: "bold",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#000000",
            fillOpacity: 0,
            strokeWeight: 0,
          },
          draggable: isSelected && canEdit,
        });
        store(id, marker);
        marker.addListener("click", () => selectFeature(id));
        if (isSelected && canEdit) {
          marker.addListener("dragend", () => {
            const pos = marker.getPosition();
            if (!pos) return;
            onUpdateFeature(id, {
              geometry: { type: "Point", coordinates: [pos.lng(), pos.lat()] },
            } as any);
          });
        }
      }

      // ── Label overlay (non-text features with a label) ──
      if (props.label && feature.type !== "text") {
        const geom = feature.geometry as any;
        let labelPos: google.maps.LatLng | null = null;
        if (geom?.coordinates) {
          if (feature.type === "polygon" || feature.type === "rectangle") {
            const coords = geom.coordinates[0];
            const avgLat =
              coords.reduce((s: number, c: number[]) => s + c[1], 0) /
              coords.length;
            const avgLng =
              coords.reduce((s: number, c: number[]) => s + c[0], 0) /
              coords.length;
            labelPos = new google.maps.LatLng(avgLat, avgLng);
          } else if (feature.type === "circle") {
            labelPos = new google.maps.LatLng(
              geom.coordinates[1],
              geom.coordinates[0],
            );
          } else {
            const mid = Math.floor(geom.coordinates.length / 2);
            labelPos = new google.maps.LatLng(
              geom.coordinates[mid][1],
              geom.coordinates[mid][0],
            );
          }
        }
        if (labelPos) {
          const labelMarker = new google.maps.Marker({
            position: labelPos,
            label: {
              text: props.label,
              color: strokeColor,
              fontSize: "12px",
              fontWeight: "bold",
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#000000",
              fillOpacity: 0,
              strokeWeight: 0,
            },
          });
          store(`label-${id}`, labelMarker);
        }
      }
    });
  }, [features, mapLoaded, selectedFeatureId, canEdit, getVisibleLayerIds]);

  // ─── Render ────────────────────────────────────

  return (
    <div className="relative w-full h-full" data-map-view>
      <div ref={mapRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground">Loading map...</span>
        </div>
      )}
    </div>
  );
}
