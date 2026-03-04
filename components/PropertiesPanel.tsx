"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { X, Trash2 } from "lucide-react";
import type { IFeature, ILayer } from "@/types/groundwork";

interface PropertiesPanelProps {
  feature: IFeature;
  layers: ILayer[];
  onUpdate: (updates: Partial<IFeature>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function PropertiesPanel({
  feature,
  layers,
  onUpdate,
  onDelete,
  onClose,
}: PropertiesPanelProps) {
  const props = feature.properties || {};
  const isShape = ["polygon", "rectangle", "circle"].includes(feature.type);
  const isLine = ["polyline", "line"].includes(feature.type);
  const isText = feature.type === "text";

  const updateProp = (key: string, value: any) => {
    onUpdate({
      properties: { ...props, [key]: value },
    } as any);
  };

  return (
    <div className="w-64 border-l border-border bg-card flex flex-col shrink-0 overflow-y-auto z-20">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold capitalize">{feature.type} Properties</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0"
          data-testid="button-close-properties"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 space-y-4">
        {isShape && (
          <>
            <div>
              <Label className="text-xs">Fill Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={props.fillColor || "#3b82f6"}
                  onChange={(e) => updateProp("fillColor", e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer"
                  data-testid="input-fill-color"
                />
                <Input
                  value={props.fillColor || "#3b82f6"}
                  onChange={(e) => updateProp("fillColor", e.target.value)}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Fill Opacity ({Math.round((props.fillOpacity ?? 0.3) * 100)}%)</Label>
              <Slider
                value={[props.fillOpacity ?? 0.3]}
                onValueChange={([v]) => updateProp("fillOpacity", v)}
                min={0}
                max={1}
                step={0.05}
                className="mt-1"
                data-testid="slider-fill-opacity"
              />
            </div>
          </>
        )}

        <div>
          <Label className="text-xs">Stroke Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              value={props.strokeColor || "#1d4ed8"}
              onChange={(e) => updateProp("strokeColor", e.target.value)}
              className="w-8 h-8 rounded border border-border cursor-pointer"
              data-testid="input-stroke-color"
            />
            <Input
              value={props.strokeColor || "#1d4ed8"}
              onChange={(e) => updateProp("strokeColor", e.target.value)}
              className="h-8 text-xs flex-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Stroke Width</Label>
          <Slider
            value={[props.strokeWidth ?? 2]}
            onValueChange={([v]) => updateProp("strokeWidth", v)}
            min={1}
            max={10}
            step={1}
            className="mt-1"
            data-testid="slider-stroke-width"
          />
        </div>

        <div>
          <Label className="text-xs">Stroke Style</Label>
          <Select
            value={props.strokeStyle || "solid"}
            onValueChange={(v) => updateProp("strokeStyle", v)}
          >
            <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-stroke-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLine && (
          <div>
            <Label className="text-xs">Arrow Heads</Label>
            <div className="flex gap-2 mt-1">
              <Button
                variant={props.arrowStart ? "default" : "outline"}
                size="sm"
                className="text-xs flex-1"
                onClick={() => updateProp("arrowStart", !props.arrowStart)}
                data-testid="button-arrow-start"
              >
                ← Start
              </Button>
              <Button
                variant={props.arrowEnd ? "default" : "outline"}
                size="sm"
                className="text-xs flex-1"
                onClick={() => updateProp("arrowEnd", !props.arrowEnd)}
                data-testid="button-arrow-end"
              >
                End →
              </Button>
            </div>
          </div>
        )}

        {isText && (
          <>
            <div>
              <Label className="text-xs">Text</Label>
              <Input
                value={props.text || ""}
                onChange={(e) => updateProp("text", e.target.value)}
                className="h-8 text-xs mt-1"
                placeholder="Enter text..."
                data-testid="input-text-content"
              />
            </div>
            <div>
              <Label className="text-xs">Font Size</Label>
              <Slider
                value={[props.fontSize ?? 14]}
                onValueChange={([v]) => updateProp("fontSize", v)}
                min={8}
                max={48}
                step={1}
                className="mt-1"
                data-testid="slider-font-size"
              />
            </div>
          </>
        )}

        <div>
          <Label className="text-xs">Label</Label>
          <Input
            value={props.label || ""}
            onChange={(e) => updateProp("label", e.target.value)}
            className="h-8 text-xs mt-1"
            placeholder="Optional label..."
            data-testid="input-label"
          />
        </div>

        <div>
          <Label className="text-xs">Layer</Label>
          <Select
            value={feature.layerId}
            onValueChange={(v) => onUpdate({ layerId: v } as any)}
          >
            <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-layer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {layers.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={onDelete}
            data-testid="button-delete-feature"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete Feature
          </Button>
        </div>
      </div>
    </div>
  );
}
