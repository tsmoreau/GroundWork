import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Feature } from "@/models/Feature";
import { Group } from "@/models/Group";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, groupId } = await params;

  try {
    await connectToDatabase();
    await requireProjectAccess(id, user.id, user.email!, ["owner", "editor"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { sharedProperties } = body;

  const group = await Group.findOneAndUpdate(
    { groupId, projectId: id },
    { $set: { sharedProperties } },
    { new: true }
  );

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (sharedProperties) {
    const updateProps: Record<string, unknown> = {};
    if (sharedProperties.fillColor !== undefined) {
      updateProps["properties.fillColor"] = sharedProperties.fillColor;
    }
    if (sharedProperties.strokeColor !== undefined) {
      updateProps["properties.strokeColor"] = sharedProperties.strokeColor;
    }

    if (Object.keys(updateProps).length > 0) {
      await Feature.updateMany(
        { groupId, projectId: id },
        { $set: updateProps }
      );
    }
  }

  const features = await Feature.find({ groupId, projectId: id });

  return NextResponse.json({
    group: group.toObject(),
    features: features.map((f) => f.toObject()),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, groupId } = await params;

  try {
    await connectToDatabase();
    await requireProjectAccess(id, user.id, user.email!, ["owner", "editor"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const group = await Group.findOneAndDelete({ groupId, projectId: id });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  await Feature.updateMany(
    { groupId, projectId: id },
    { $set: { groupId: null } }
  );

  return NextResponse.json({ success: true });
}
