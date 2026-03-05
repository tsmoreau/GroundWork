"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { IFeature, ILayer } from "@/types/groundwork";

type DrawingMode = "select" | "polygon" | "rectangle" | "circle" | "polyline" | "line" | "text";

interface MapViewProps {
  snapshot: { center: { lat: number; lng: number }; zoom: number; heading: number } | null;
  features: IFeature[];
  layers: ILayer[];
  drawingMode: DrawingMode;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  onCreateFeature: (feature: Partial<IFeature>) => Promise<any>;
  onUpdateFeature: (featureId: string, updates: Partial<IFeature>) => void;
  canEdit: boolean;
  onCaptureReady?: (captureFn: () => { center: { lat: number; lng: number }; zoom: number; heading: number } | null) => void;
}

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const DEFAULT_ZOOM = 18;

function hexToRGBA(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function getStrokeDash(style: string): number[] {
  if (style === "dashed") return [12, 6];
  if (style === "dotted") return [3, 6];
  return [];
}

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
  const overlaysRef = useRef<Map<string, google.maps.Polygon | google.maps.Polyline | google.maps.Circle | google.maps.Marker>>(new Map());
  const drawingPoints = useRef<google.maps.LatLng[]>([]);
  const drawingOverlay = useRef<google.maps.Polyline | google.maps.Polygon | null>(null);
  const rectStartRef = useRef<google.maps.LatLng | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Keep latest prop callbacks in refs so the drawing effect never needs them as deps.
  // Without this, every parent render recreates these functions → effect tears down
  // and re-registers the map click listener on every render, causing a race window.
  const onCreateFeatureRef = useRef(onCreateFeature);
  const onSelectFeatureRef = useRef(onSelectFeature);
  const layersRef = useRef(layers);
  useEffect(() => { onCreateFeatureRef.current = onCreateFeature; }, [onCreateFeature]);
  useEffect(() => { onSelectFeatureRef.current = onSelectFeature; }, [onSelectFeature]);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  const getVisibleLayerIds = useCallback(() => {
    return new Set(layers.filter((l) => l.visible).map((l) => l.id));
  }, [layers]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey) {
      console.error("Google Maps API key not configured");
      return;
    }

    let cancelled = false;

    (async () => {
      setOptions({ key: apiKey, v: "weekly" });
      const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;

      if (cancelled || !mapRef.current || mapInstance.current) return;

      const center = snapshot?.center || DEFAULT_CENTER;
      const zoom = snapshot?.zoom || DEFAULT_ZOOM;

      const map = new Map(mapRef.current, {
        center,
        zoom,
        heading: snapshot?.heading || 0,
        tilt: 0,
        mapTypeId: "satellite",
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
      });

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

  useEffect(() => {
    if (!mapInstance.current || !snapshot) return;
    mapInstance.current.panTo(snapshot.center);
    mapInstance.current.setZoom(snapshot.zoom);
    mapInstance.current.setHeading(snapshot.heading);
  }, [snapshot?.center?.lat, snapshot?.center?.lng, snapshot?.zoom, snapshot?.heading]);

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    const map = mapInstance.current;

    const visibleLayerIds = getVisibleLayerIds();

    overlaysRef.current.forEach((overlay, id) => {
      overlay.setMap(null);
    });
    overlaysRef.current.clear();

    features.forEach((feature) => {
      if (!visibleLayerIds.has(feature.layerId)) return;

      const props = feature.properties || {};
      const isSelected = feature._id === selectedFeatureId;
      const strokeColor = props.strokeColor || "#1d4ed8";
      const strokeWidth = (props.strokeWidth || 2) + (isSelected ? 2 : 0);
      const fillColor = props.fillColor || "#3b82f6";
      const fillOpacity = props.fillOpacity ?? 0.3;
      const strokeStyle = props.strokeStyle || "solid";

      const strokeDash = getStrokeDash(strokeStyle);

      if (feature.type === "polygon" || feature.type === "rectangle") {
        const geom = feature.geometry as any;
        if (!geom?.coordinates?.[0]) return;
        const path = geom.coordinates[0].map(
          (c: number[]) => new google.maps.LatLng(c[1], c[0])
        );
        const polygon = new google.maps.Polygon({
          paths: path,
          strokeColor,
          strokeWeight: strokeWidth,
          fillColor,
          fillOpacity,
          editable: isSelected && canEdit,
          draggable: isSelected && canEdit,
          map,
        });
        polygon.addListener("click", () => onSelectFeature(feature._id));
        if (isSelected && canEdit) {
          const pathChanged = () => {
            const newPath = polygon.getPath().getArray();
            const coords = newPath.map((p) => [p.lng(), p.lat()]);
            coords.push(coords[0]);
            onUpdateFeature(feature._id, {
              geometry: { type: "Polygon", coordinates: [coords] },
            } as any);
          };
          google.maps.event.addListener(polygon.getPath(), "set_at", pathChanged);
          google.maps.event.addListener(polygon.getPath(), "insert_at", pathChanged);
          polygon.addListener("dragend", pathChanged);
        }
        overlaysRef.current.set(feature._id, polygon);
      } else if (feature.type === "circle") {
        const geom = feature.geometry as any;
        if (!geom?.coordinates) return;
        const center = new google.maps.LatLng(geom.coordinates[1], geom.coordinates[0]);
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
          map,
        });
        circle.addListener("click", () => onSelectFeature(feature._id));
        if (isSelected && canEdit) {
          const updateCircle = () => {
            const c = circle.getCenter();
            if (!c) return;
            onUpdateFeature(feature._id, {
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
        overlaysRef.current.set(feature._id, circle);
      } else if (feature.type === "polyline" || feature.type === "line") {
        const geom = feature.geometry as any;
        if (!geom?.coordinates) return;
        const path = geom.coordinates.map(
          (c: number[]) => new google.maps.LatLng(c[1], c[0])
        );
        const polyline = new google.maps.Polyline({
          path,
          strokeColor,
          strokeWeight: strokeWidth,
          editable: isSelected && canEdit,
          draggable: isSelected && canEdit,
          map,
          icons: strokeStyle === "dashed"
            ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: strokeWidth }, offset: "0", repeat: "16px" }]
            : strokeStyle === "dotted"
            ? [{ icon: { path: google.maps.SymbolPath.CIRCLE, strokeOpacity: 1, scale: strokeWidth / 2 }, offset: "0", repeat: "10px" }]
            : undefined,
          strokeOpacity: strokeStyle === "solid" ? 1 : 0,
        });

        if (props.arrowEnd) {
          polyline.setOptions({
            icons: [
              ...(polyline.get("icons") || []),
              { icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3 }, offset: "100%" },
            ],
          });
        }
        if (props.arrowStart) {
          polyline.setOptions({
            icons: [
              ...(polyline.get("icons") || []),
              { icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 3 }, offset: "0%" },
            ],
          });
        }

        polyline.addListener("click", () => onSelectFeature(feature._id));
        if (isSelected && canEdit) {
          const pathChanged = () => {
            const newPath = polyline.getPath().getArray();
            const coords = newPath.map((p) => [p.lng(), p.lat()]);
            onUpdateFeature(feature._id, {
              geometry: { type: "LineString", coordinates: coords },
            } as any);
          };
          google.maps.event.addListener(polyline.getPath(), "set_at", pathChanged);
          google.maps.event.addListener(polyline.getPath(), "insert_at", pathChanged);
          polyline.addListener("dragend", pathChanged);
        }
        overlaysRef.current.set(feature._id, polyline);
      } else if (feature.type === "text") {
        const geom = feature.geometry as any;
        if (!geom?.coordinates) return;
        const position = new google.maps.LatLng(geom.coordinates[1], geom.coordinates[0]);
        const text = props.text || props.label || "Text";
        const fontSize = props.fontSize || 14;

        const marker = new google.maps.Marker({
          position,
          map,
          label: {
            text,
            color: strokeColor,
            fontSize: `${fontSize}px`,
            fontWeight: "bold",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          draggable: isSelected && canEdit,
        });
        marker.addListener("click", () => onSelectFeature(feature._id));
        if (isSelected && canEdit) {
          marker.addListener("dragend", () => {
            const pos = marker.getPosition();
            if (!pos) return;
            onUpdateFeature(feature._id, {
              geometry: { type: "Point", coordinates: [pos.lng(), pos.lat()] },
            } as any);
          });
        }
        overlaysRef.current.set(feature._id, marker);
      }

      if (props.label && feature.type !== "text") {
        const geom = feature.geometry as any;
        let labelPos: google.maps.LatLng | null = null;
        if (geom?.coordinates) {
          if (feature.type === "polygon" || feature.type === "rectangle") {
            const coords = geom.coordinates[0];
            const avgLat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length;
            const avgLng = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length;
            labelPos = new google.maps.LatLng(avgLat, avgLng);
          } else if (feature.type === "circle") {
            labelPos = new google.maps.LatLng(geom.coordinates[1], geom.coordinates[0]);
          } else {
            const mid = Math.floor(geom.coordinates.length / 2);
            labelPos = new google.maps.LatLng(geom.coordinates[mid][1], geom.coordinates[mid][0]);
          }
        }
        if (labelPos) {
          const labelMarker = new google.maps.Marker({
            position: labelPos,
            map,
            label: {
              text: props.label,
              color: strokeColor,
              fontSize: "12px",
              fontWeight: "bold",
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
            },
          });
          overlaysRef.current.set(`label-${feature._id}`, labelMarker);
        }
      }
    });
  }, [features, mapLoaded, selectedFeatureId, canEdit, getVisibleLayerIds]);

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    const map = mapInstance.current;
    
    if (drawingMode === "select") {
      map.setOptions({ draggable: true, gestureHandling: "greedy" });

      if (drawingOverlay.current) {
        drawingOverlay.current.setMap(null);
        drawingOverlay.current = null;
      }
      drawingPoints.current = [];
      rectStartRef.current = null;
      return;
    }

    map.setOptions({ draggable: false, gestureHandling: "greedy" });

    const clickListener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const layers = layersRef.current;
      const layerId = layers[0]?.id || "";

      if (drawingMode === "text") {
        onCreateFeatureRef.current({
          type: "text",
          layerId,
          geometry: { type: "Point", coordinates: [e.latLng.lng(), e.latLng.lat()] },
          properties: { text: "New Text", fontSize: 14, strokeColor: "#000000" },
        });
        return;
      }

      if (drawingMode === "circle") {
        onCreateFeatureRef.current({
          type: "circle",
          layerId,
          geometry: { type: "Point", coordinates: [e.latLng.lng(), e.latLng.lat()], radius: 30 } as any,
          properties: { fillColor: "#3b82f6", fillOpacity: 0.3, strokeColor: "#1d4ed8", strokeWidth: 2 },
        });
        return;
      }

      if (drawingMode === "rectangle") {
        if (!rectStartRef.current) {
          rectStartRef.current = e.latLng;
          return;
        }
        const start = rectStartRef.current;
        const end = e.latLng;
        const coords = [
          [start.lng(), start.lat()], [end.lng(), start.lat()],
          [end.lng(), end.lat()], [start.lng(), end.lat()], [start.lng(), start.lat()],
        ];
        rectStartRef.current = null;
        onCreateFeatureRef.current({
          type: "rectangle",
          layerId,
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: { fillColor: "#3b82f6", fillOpacity: 0.3, strokeColor: "#1d4ed8", strokeWidth: 2 },
        });
        return;
      }

      drawingPoints.current.push(e.latLng);
      if (drawingOverlay.current) drawingOverlay.current.setMap(null);

      if (drawingMode === "polygon") {
        drawingOverlay.current = new google.maps.Polygon({
          paths: drawingPoints.current, strokeColor: "#1d4ed8",
          strokeWeight: 2, fillColor: "#3b82f6", fillOpacity: 0.2, map,
        });
      } else {
        drawingOverlay.current = new google.maps.Polyline({
          path: drawingPoints.current, strokeColor: "#1d4ed8", strokeWeight: 2, map,
        });
      }
    });

    const dblClickListener = map.addListener("dblclick", (e: google.maps.MapMouseEvent) => {
      if (drawingPoints.current.length < 2) return;
      const layerId = layersRef.current[0]?.id || "";

      if (drawingMode === "polygon") {
        const coords = drawingPoints.current.map((p) => [p.lng(), p.lat()]);
        coords.push(coords[0]);
        onCreateFeatureRef.current({
          type: "polygon", layerId,
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: { fillColor: "#3b82f6", fillOpacity: 0.3, strokeColor: "#1d4ed8", strokeWidth: 2 },
        });
      } else if (drawingMode === "polyline" || drawingMode === "line") {
        const coords = drawingPoints.current.map((p) => [p.lng(), p.lat()]);
        onCreateFeatureRef.current({
          type: drawingMode === "line" ? "line" : "polyline", layerId,
          geometry: { type: "LineString", coordinates: coords },
          properties: { strokeColor: "#1d4ed8", strokeWidth: 2, strokeStyle: "solid" },
        });
      }

      if (drawingOverlay.current) { drawingOverlay.current.setMap(null); drawingOverlay.current = null; }
      drawingPoints.current = [];
    });

    return () => {
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(dblClickListener);
      if (drawingOverlay.current) { drawingOverlay.current.setMap(null); drawingOverlay.current = null; }
      drawingPoints.current = [];
      rectStartRef.current = null;
    };
  }, [drawingMode, mapLoaded]); // stable: callbacks accessed via refs, not deps

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    const map = mapInstance.current;

    if (drawingMode === "select") {
      const listener = map.addListener("click", () => {
        onSelectFeatureRef.current(null);
      });
      return () => {
        google.maps.event.removeListener(listener);
      };
    }
  }, [drawingMode, mapLoaded]);

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
