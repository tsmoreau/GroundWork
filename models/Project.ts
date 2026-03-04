import mongoose, { Schema, Document } from "mongoose";

export interface IProjectDocument extends Document {
  name: string;
  snapshot: {
    center: { lat: number; lng: number };
    zoom: number;
    heading: number;
  } | null;
  layers: Array<{
    id: string;
    name: string;
    visible: boolean;
    order: number;
  }>;
  visibility: "private" | "public";
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

if (mongoose.models.Project) delete mongoose.models.Project;

const ProjectSchema = new Schema<IProjectDocument>(
  {
    name: { type: String, required: true },
    snapshot: {
      type: {
        center: {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
        },
        zoom: { type: Number, required: true },
        heading: { type: Number, required: true },
      },
      default: null,
    },
    layers: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        visible: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
      },
    ],
    visibility: { type: String, enum: ["private", "public"], default: "private" },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

export const Project = mongoose.model<IProjectDocument>("Project", ProjectSchema);
