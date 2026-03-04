"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  GripVertical,
  X,
  Check,
  Pencil,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ILayer } from "@/types/groundwork";
import { v4 as uuidv4 } from "uuid";

interface LayersPanelProps {
  layers: ILayer[];
  onUpdateLayers: (layers: ILayer[]) => void;
  canEdit: boolean;
  onClose: () => void;
}

export default function LayersPanel({
  layers,
  onUpdateLayers,
  canEdit,
  onClose,
}: LayersPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleToggleVisibility = (layerId: string) => {
    const updated = layers.map((l) =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    onUpdateLayers(updated);
  };

  const handleAddLayer = () => {
    const newLayer: ILayer = {
      id: uuidv4(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      order: layers.length,
    };
    onUpdateLayers([...layers, newLayer]);
  };

  const handleRename = (layerId: string) => {
    if (!editName.trim()) return;
    const updated = layers.map((l) =>
      l.id === layerId ? { ...l, name: editName.trim() } : l
    );
    onUpdateLayers(updated);
    setEditingId(null);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const updated = layers
      .filter((l) => l.id !== deleteId)
      .map((l, i) => ({ ...l, order: i }));
    onUpdateLayers(updated);
    setDeleteId(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...layers];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onUpdateLayers(updated.map((l, i) => ({ ...l, order: i })));
  };

  const handleMoveDown = (index: number) => {
    if (index === layers.length - 1) return;
    const updated = [...layers];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onUpdateLayers(updated.map((l, i) => ({ ...l, order: i })));
  };

  const sorted = [...layers].sort((a, b) => a.order - b.order);

  return (
    <div className="w-56 border-r border-border bg-card flex flex-col shrink-0 z-20">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold">Layers</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0" data-testid="button-close-layers">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.map((layer, index) => (
          <div
            key={layer.id}
            className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 hover:bg-muted/50 group"
            data-testid={`layer-item-${layer.id}`}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => handleToggleVisibility(layer.id)}
              data-testid={`button-toggle-layer-${layer.id}`}
            >
              {layer.visible ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>

            {editingId === layer.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-6 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleRename(layer.id)}
                  autoFocus
                  data-testid="input-layer-name"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleRename(layer.id)}
                >
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <span
                className="text-xs flex-1 truncate cursor-pointer"
                onDoubleClick={() => {
                  if (canEdit) {
                    setEditingId(layer.id);
                    setEditName(layer.name);
                  }
                }}
              >
                {layer.name}
              </span>
            )}

            {canEdit && editingId !== layer.id && (
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setEditingId(layer.id);
                    setEditName(layer.name);
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                {layers.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => setDeleteId(layer.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="p-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleAddLayer}
            data-testid="button-add-layer"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Layer
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layer</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the layer and all features on it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
