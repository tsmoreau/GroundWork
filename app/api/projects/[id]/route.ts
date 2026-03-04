import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { Feature } from "@/models/Feature";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";

export async function GET(
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
    const role = await requireProjectAccess(id, user.id, user.email!);

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project: project.toObject(), role });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectToDatabase();
    await requireProjectAccess(id, user.id, user.email!, ["owner", "editor"]);

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "Invalid project name" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.snapshot !== undefined) {
      updates.snapshot = body.snapshot;
    }

    if (body.layers !== undefined) {
      updates.layers = body.layers;
    }

    if (body.visibility !== undefined) {
      if (!["private", "public"].includes(body.visibility)) {
        return NextResponse.json(
          { error: "Invalid visibility value" },
          { status: 400 }
        );
      }
      updates.visibility = body.visibility;
    }

    const project = await Project.findByIdAndUpdate(id, updates, {
      new: true,
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project.toObject());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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
    await requireProjectAccess(id, user.id, user.email!, ["owner"]);

    await Feature.deleteMany({ projectId: id });
    await ProjectMember.deleteMany({ projectId: id });
    await Project.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
