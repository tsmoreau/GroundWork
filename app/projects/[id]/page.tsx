"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TopBar from "@/components/TopBar";
import MapView from "@/components/MapView";
import Toolbar from "@/components/Toolbar";
import LayersPanel from "@/components/LayersPanel";
import PropertiesPanel from "@/components/PropertiesPanel";
import ShareDialog from "@/components/ShareDialog";
import ExportMenu from "@/components/ExportMenu";
import type { IProject, IFeature, ILayer } from "@/types/groundwork";
import { Camera } from "lucide-react";

type DrawingMode = "select" | "polygon" | "rectangle" | "circle" | "polyline" | "line" | "text";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const projectId = params.id as string;

  const [project, setProject] = useState<IProject | null>(null);
  const [features, setFeatures] = useState<IFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("viewer");
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("select");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const snapshotCaptureRef = useRef<(() => { center: { lat: number; lng: number }; zoom: number; heading: number } | null) | null>(null);

  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);

  const canEdit = role === "owner" || role === "editor";
  const snapshotSet = !!project?.snapshot;

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        router.push("/projects");
        return;
      }
      const data = await res.json();
      setProject(data.project);
      setRole(data.role);
    } catch {
      router.push("/projects");
    }
  }, [projectId, router]);

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/features`);
      if (res.ok) {
        const data = await res.json();
        setFeatures(data);
      }
    } catch {}
  }, [projectId]);

  useEffect(() => {
    const load = async () => {
      await fetchProject();
      await fetchFeatures();
      setLoading(false);
    };
    load();
  }, [fetchProject, fetchFeatures]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchProject();
      fetchFeatures();
    }, 12000);

    const handleFocus = () => {
      fetchProject();
      fetchFeatures();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchProject, fetchFeatures]);

  const handleSetSnapshot = async (snapshot: { center: { lat: number; lng: number }; zoom: number; heading: number }) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      if (res.ok) {
        setProject((prev) => prev ? { ...prev, snapshot } : prev);
        toast({ title: "Snapshot saved" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save snapshot", variant: "destructive" });
    }
  };

  const handleUpdateLayers = async (layers: ILayer[]) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers }),
      });
      if (res.ok) {
        setProject((prev) => prev ? { ...prev, layers } : prev);
      }
    } catch {}
  };

  const pushUndo = (action: any) => {
    setUndoStack((prev) => [...prev, action]);
    setRedoStack([]);
  };

  const handleCreateFeature = async (feature: Partial<IFeature>) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feature),
      });
      if (res.ok) {
        const created = await res.json();
        setFeatures((prev) => [...prev, created]);
        pushUndo({ type: "create", feature: created });
        setDrawingMode("select");
        setSelectedFeatureId(created._id);
        return created;
      }
    } catch {}
  };

  const handleUpdateFeature = async (featureId: string, updates: Partial<IFeature>) => {
    if (!canEdit) return;
    const old = features.find((f) => f._id === featureId);
    try {
      const res = await fetch(`/api/projects/${projectId}/features/${featureId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setFeatures((prev) => prev.map((f) => (f._id === featureId ? updated : f)));
        if (old) pushUndo({ type: "update", featureId, before: old, after: updated });
      }
    } catch {}
  };

  const handleDeleteFeature = async (featureId: string) => {
    if (!canEdit) return;
    const old = features.find((f) => f._id === featureId);
    try {
      const res = await fetch(`/api/projects/${projectId}/features/${featureId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeatures((prev) => prev.filter((f) => f._id !== featureId));
        if (old) pushUndo({ type: "delete", feature: old });
        if (selectedFeatureId === featureId) setSelectedFeatureId(null);
      }
    } catch {}
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    if (action.type === "create") {
      await fetch(`/api/projects/${projectId}/features/${action.feature._id}`, { method: "DELETE" });
      setFeatures((prev) => prev.filter((f) => f._id !== action.feature._id));
      setRedoStack((prev) => [...prev, action]);
    } else if (action.type === "update") {
      const res = await fetch(`/api/projects/${projectId}/features/${action.featureId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: action.before.geometry, properties: action.before.properties }),
      });
      if (res.ok) {
        const restored = await res.json();
        setFeatures((prev) => prev.map((f) => (f._id === action.featureId ? restored : f)));
      }
      setRedoStack((prev) => [...prev, action]);
    } else if (action.type === "delete") {
      const res = await fetch(`/api/projects/${projectId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.feature),
      });
      if (res.ok) {
        const recreated = await res.json();
        setFeatures((prev) => [...prev, recreated]);
      }
      setRedoStack((prev) => [...prev, action]);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    if (action.type === "create") {
      const res = await fetch(`/api/projects/${projectId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.feature),
      });
      if (res.ok) {
        const created = await res.json();
        setFeatures((prev) => [...prev, created]);
      }
      setUndoStack((prev) => [...prev, action]);
    } else if (action.type === "update") {
      const res = await fetch(`/api/projects/${projectId}/features/${action.featureId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: action.after.geometry, properties: action.after.properties }),
      });
      if (res.ok) {
        const updated = await res.json();
        setFeatures((prev) => prev.map((f) => (f._id === action.featureId ? updated : f)));
      }
      setUndoStack((prev) => [...prev, action]);
    } else if (action.type === "delete") {
      await fetch(`/api/projects/${projectId}/features/${action.feature._id}`, { method: "DELETE" });
      setFeatures((prev) => prev.filter((f) => f._id !== action.feature._id));
      setUndoStack((prev) => [...prev, action]);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedFeatureId && document.activeElement === document.body) {
          handleDeleteFeature(selectedFeatureId);
        }
      }
      if (e.key === "Escape") {
        setDrawingMode("select");
        setSelectedFeatureId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedFeatureId, undoStack, redoStack]);

  const selectedFeature = features.find((f) => f._id === selectedFeatureId) || null;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Project not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        projectName={project.name}
        onBack={() => router.push("/projects")}
        onShare={() => setShareOpen(true)}
        onSettings={() => setSettingsOpen(!settingsOpen)}
        canEdit={canEdit}
        userImage={session?.user?.image}
      >
        <ExportMenu mapContainerRef={mapContainerRef} projectName={project.name} />
      </TopBar>

      <div className="flex-1 flex overflow-hidden relative">
        {layersPanelOpen && (
          <LayersPanel
            layers={project.layers}
            onUpdateLayers={handleUpdateLayers}
            canEdit={canEdit}
            onClose={() => setLayersPanelOpen(false)}
          />
        )}

        <div className="flex-1 relative" ref={mapContainerRef}>
          <MapView
            snapshot={project.snapshot}
            features={features}
            layers={project.layers}
            drawingMode={snapshotSet && canEdit ? drawingMode : "select"}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            onCreateFeature={handleCreateFeature}
            onUpdateFeature={handleUpdateFeature}
            canEdit={canEdit}
            onCaptureReady={(fn) => { snapshotCaptureRef.current = fn; }}
          />

          {!snapshotSet && canEdit && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-card/95 backdrop-blur border border-border rounded-lg p-6 text-center shadow-lg pointer-events-auto max-w-sm mx-4">
                <Camera className="w-10 h-10 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-2">Set Your View</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Navigate the map to your property, then capture the view as your project home.
                </p>
                <Button
                  onClick={() => {
                    const snap = snapshotCaptureRef.current?.();
                    if (snap) handleSetSnapshot(snap);
                  }}
                  data-testid="button-set-snapshot"
                >
                  <Camera className="w-4 h-4 mr-1" />
                  Set Snapshot
                </Button>
              </div>
            </div>
          )}

          {settingsOpen && canEdit && snapshotSet && (
            <div className="absolute top-2 right-2 z-20 bg-card border border-border rounded-lg p-3 shadow-lg">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const snap = snapshotCaptureRef.current?.();
                  if (snap) handleSetSnapshot(snap);
                  setSettingsOpen(false);
                }}
                data-testid="button-reset-snapshot"
              >
                <Camera className="w-4 h-4 mr-1" />
                Reset Snapshot
              </Button>
            </div>
          )}
        </div>

        {selectedFeature && canEdit && (
          <PropertiesPanel
            feature={selectedFeature}
            layers={project.layers}
            onUpdate={(updates) => handleUpdateFeature(selectedFeature._id, updates)}
            onDelete={() => handleDeleteFeature(selectedFeature._id)}
            onClose={() => setSelectedFeatureId(null)}
          />
        )}
      </div>

      {snapshotSet && (
        <Toolbar
          drawingMode={drawingMode}
          onSetMode={setDrawingMode}
          canEdit={canEdit}
          onToggleLayers={() => setLayersPanelOpen(!layersPanelOpen)}
          layersPanelOpen={layersPanelOpen}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
        />
      )}

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={projectId}
        role={role}
      />
    </div>
  );
}
