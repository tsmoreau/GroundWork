import mongoose, { Schema, Document } from "mongoose";

export interface IProjectMemberDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | null;
  email: string;
  role: "owner" | "editor" | "viewer";
  invitedAt: Date;
}

if (mongoose.models.ProjectMember) delete mongoose.models.ProjectMember;

const ProjectMemberSchema = new Schema<IProjectMemberDocument>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, default: null, index: true },
  email: { type: String, required: true },
  role: { type: String, enum: ["owner", "editor", "viewer"], required: true },
  invitedAt: { type: Date, default: Date.now },
});

ProjectMemberSchema.index({ projectId: 1, email: 1 }, { unique: true });

export const ProjectMember = mongoose.model<IProjectMemberDocument>(
  "ProjectMember",
  ProjectMemberSchema
);
