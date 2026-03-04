import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { Feature } from "@/models/Feature";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";
import mongoose from "mongoose";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectToDatabase();
    await requireProjectAccess(id, user.id, user.email!);

    const sourceProject = await Project.findById(id);
    if (!sourceProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const newProject = await Project.create({
      name: `${sourceProject.name} (Copy)`,
      snapshot: sourceProject.snapshot,
      layers: sourceProject.layers,
      visibility: "private",
      createdBy: new mongoose.Types.ObjectId(user.id),
    });

    await ProjectMember.create({
      projectId: newProject._id,
      userId: new mongoose.Types.ObjectId(user.id),
      email: user.email,
      role: "owner",
      invitedAt: new Date(),
    });

    const sourceFeatures = await Feature.find({ projectId: id });
    if (sourceFeatures.length > 0) {
      const newFeatures = sourceFeatures.map((f) => ({
        projectId: newProject._id,
        layerId: f.layerId,
        groupId: f.groupId,
        type: f.type,
        geometry: f.geometry,
        properties: f.properties,
        createdBy: new mongoose.Types.ObjectId(user.id),
      }));
      await Feature.insertMany(newFeatures);
    }

    return NextResponse.json(newProject.toObject(), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
