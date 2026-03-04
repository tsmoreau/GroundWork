import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { getAuthUser } from "@/lib/permissions";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const memberships = await ProjectMember.find({
    $or: [{ userId: user.id }, { email: user.email }],
  });

  const projectIds = memberships.map((m) => m.projectId);

  const projects = await Project.find({ _id: { $in: projectIds } }).sort({
    updatedAt: -1,
  });

  const projectsWithRole = projects.map((project) => {
    const membership = memberships.find(
      (m) => m.projectId.toString() === project._id.toString()
    );
    return {
      ...project.toObject(),
      role: membership?.role || "viewer",
    };
  });

  return NextResponse.json(projectsWithRole);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Project name is required" },
      { status: 400 }
    );
  }

  const defaultLayerId = uuidv4();

  const project = await Project.create({
    name: name.trim(),
    snapshot: null,
    layers: [{ id: defaultLayerId, name: "Layer 1", visible: true, order: 0 }],
    visibility: "private",
    createdBy: new mongoose.Types.ObjectId(user.id),
  });

  await ProjectMember.create({
    projectId: project._id,
    userId: new mongoose.Types.ObjectId(user.id),
    email: user.email,
    role: "owner",
    invitedAt: new Date(),
  });

  return NextResponse.json(project.toObject(), { status: 201 });
}
