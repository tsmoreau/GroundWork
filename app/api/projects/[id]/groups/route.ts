import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Feature } from "@/models/Feature";
import { Group } from "@/models/Group";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

export async function POST(
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
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { featureIds, sharedProperties } = body;

  if (!featureIds || !Array.isArray(featureIds) || featureIds.length < 2) {
    return NextResponse.json(
      { error: "At least 2 feature IDs are required" },
      { status: 400 }
    );
  }

  const groupId = uuidv4();

  const group = await Group.create({
    projectId: new mongoose.Types.ObjectId(id),
    groupId,
    sharedProperties: sharedProperties || { fillColor: null, strokeColor: null },
  });

  await Feature.updateMany(
    { _id: { $in: featureIds }, projectId: id },
    { $set: { groupId } }
  );

  const updatedFeatures = await Feature.find({
    _id: { $in: featureIds },
    projectId: id,
  });

  return NextResponse.json(
    {
      group: group.toObject(),
      features: updatedFeatures.map((f) => f.toObject()),
    },
    { status: 201 }
  );
}
