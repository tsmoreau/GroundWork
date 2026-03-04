import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Feature } from "@/models/Feature";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, featureId } = await params;

  try {
    await connectToDatabase();
    await requireProjectAccess(id, user.id, user.email!, ["owner", "editor"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowedFields = ["layerId", "groupId", "type", "geometry", "properties"];
  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      update[field] = body[field];
    }
  }

  const feature = await Feature.findOneAndUpdate(
    { _id: featureId, projectId: id },
    { $set: update },
    { new: true }
  );

  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  return NextResponse.json(feature.toObject());
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, featureId } = await params;

  try {
    await connectToDatabase();
    await requireProjectAccess(id, user.id, user.email!, ["owner", "editor"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const feature = await Feature.findOneAndDelete({
    _id: featureId,
    projectId: id,
  });

  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
