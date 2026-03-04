import mongoose, { Schema, Document } from "mongoose";

export interface IFeatureDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  layerId: string;
  groupId: string | null;
  type: "polygon" | "rectangle" | "circle" | "polyline" | "line" | "text";
  geometry: object;
  properties: {
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeWidth?: number;
    strokeStyle?: string;
    arrowStart?: boolean;
    arrowEnd?: boolean;
    label?: string;
    text?: string;
    fontSize?: number;
  };
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

if (mongoose.models.Feature) delete mongoose.models.Feature;

const FeatureSchema = new Schema<IFeatureDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    layerId: { type: String, required: true },
    groupId: { type: String, default: null },
    type: {
      type: String,
      enum: ["polygon", "rectangle", "circle", "polyline", "line", "text"],
      required: true,
    },
    geometry: { type: Schema.Types.Mixed, required: true },
    properties: {
      type: Schema.Types.Mixed,
      default: {
        fillColor: "#3b82f6",
        fillOpacity: 0.3,
        strokeColor: "#1d4ed8",
        strokeWidth: 2,
        strokeStyle: "solid",
        arrowStart: false,
        arrowEnd: false,
        label: "",
        text: "",
        fontSize: 14,
      },
    },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

export const Feature = mongoose.model<IFeatureDocument>("Feature", FeatureSchema);
