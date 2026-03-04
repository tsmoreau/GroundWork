"use client";

import { Button } from "@/components/ui/button";
import {
  MousePointer2,
  Pentagon,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  Undo2,
  Redo2,
  Layers,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DrawingMode = "select" | "polygon" | "rectangle" | "circle" | "polyline" | "line" | "text";

interface ToolbarProps {
  drawingMode: DrawingMode;
  onSetMode: (mode: DrawingMode) => void;
  canEdit: boolean;
  onToggleLayers: () => void;
  layersPanelOpen: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const tools: { mode: DrawingMode; icon: any; label: string }[] = [
  { mode: "select", icon: MousePointer2, label: "Select / Pan" },
  { mode: "polygon", icon: Pentagon, label: "Polygon" },
  { mode: "rectangle", icon: Square, label: "Rectangle" },
  { mode: "circle", icon: Circle, label: "Circle" },
  { mode: "polyline", icon: Minus, label: "Polyline" },
  { mode: "line", icon: ArrowRight, label: "Line" },
  { mode: "text", icon: Type, label: "Text" },
];

export default function Toolbar({
  drawingMode,
  onSetMode,
  canEdit,
  onToggleLayers,
  layersPanelOpen,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <div className="h-12 border-t border-border bg-card flex items-center justify-center gap-1 px-2 overflow-x-auto shrink-0">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={layersPanelOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleLayers}
              className="shrink-0"
              data-testid="button-toggle-layers"
            >
              <Layers className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Layers</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        {tools.map(({ mode, icon: Icon, label }) => (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                variant={drawingMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => canEdit && onSetMode(mode)}
                disabled={!canEdit && mode !== "select"}
                className="shrink-0"
                data-testid={`button-tool-${mode}`}
              >
                <Icon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}

        <div className="w-px h-6 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
              className="shrink-0"
              data-testid="button-undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
              className="shrink-0"
              data-testid="button-redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
