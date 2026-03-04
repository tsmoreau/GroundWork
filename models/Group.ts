import mongoose, { Schema, Document } from "mongoose";

export interface IGroupDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  groupId: string;
  sharedProperties: {
    fillColor: string | null;
    strokeColor: string | null;
  };
}

if (mongoose.models.Group) delete mongoose.models.Group;

const GroupSchema = new Schema<IGroupDocument>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  groupId: { type: String, required: true, unique: true },
  sharedProperties: {
    fillColor: { type: String, default: null },
    strokeColor: { type: String, default: null },
  },
});

export const Group = mongoose.model<IGroupDocument>("Group", GroupSchema);
