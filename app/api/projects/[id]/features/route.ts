import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Feature } from "@/models/Feature";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";
import mongoose from "mongoose";

export async function GET(
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
    await requireProjectAccess(id, user.id, user.email!);
    const features = await Feature.find({ projectId: id });
    return NextResponse.json(features.map((f) => f.toObject()));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

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
  const { layerId, type, geometry, properties, groupId } = body;

  if (!layerId || !type || !geometry) {
    return NextResponse.json(
      { error: "layerId, type, and geometry are required" },
      { status: 400 }
    );
  }

  const validTypes = ["polygon", "rectangle", "circle", "polyline", "line", "text"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid feature type" }, { status: 400 });
  }

  const feature = await Feature.create({
    projectId: new mongoose.Types.ObjectId(id),
    layerId,
    groupId: groupId || null,
    type,
    geometry,
    properties: properties || {},
    createdBy: new mongoose.Types.ObjectId(user.id),
  });

  return NextResponse.json(feature.toObject(), { status: 201 });
}
