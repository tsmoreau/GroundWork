import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Feature } from "@/models/Feature";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";
import mongoose from "mongoose";

interface BulkCreateItem {
  layerId: string;
  type: string;
  geometry: object;
  properties?: object;
  groupId?: string | null;
}

interface BulkUpdateItem {
  _id: string;
  layerId?: string;
  groupId?: string | null;
  type?: string;
  geometry?: object;
  properties?: object;
}

interface BulkDeleteItem {
  _id: string;
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
  const { create, update, delete: deleteIds } = body as {
    create?: BulkCreateItem[];
    update?: BulkUpdateItem[];
    delete?: BulkDeleteItem[];
  };

  const results: { created: object[]; updated: object[]; deleted: number } = {
    created: [],
    updated: [],
    deleted: 0,
  };

  const validTypes = ["polygon", "rectangle", "circle", "polyline", "line", "text"];

  if (create && Array.isArray(create)) {
    const docs = create
      .filter((item) => item.layerId && item.type && item.geometry && validTypes.includes(item.type))
      .map((item) => ({
        projectId: new mongoose.Types.ObjectId(id),
        layerId: item.layerId,
        groupId: item.groupId || null,
        type: item.type,
        geometry: item.geometry,
        properties: item.properties || {},
        createdBy: new mongoose.Types.ObjectId(user.id),
      }));

    if (docs.length > 0) {
      const created = await Feature.insertMany(docs);
      results.created = created.map((f) => f.toObject());
    }
  }

  if (update && Array.isArray(update)) {
    const allowedFields = ["layerId", "groupId", "type", "geometry", "properties"];
    for (const item of update) {
      if (!item._id) continue;
      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if ((item as Record<string, unknown>)[field] !== undefined) {
          updateData[field] = (item as Record<string, unknown>)[field];
        }
      }
      const updated = await Feature.findOneAndUpdate(
        { _id: item._id, projectId: id },
        { $set: updateData },
        { new: true }
      );
      if (updated) {
        results.updated.push(updated.toObject());
      }
    }
  }

  if (deleteIds && Array.isArray(deleteIds)) {
    const ids = deleteIds.map((item) => (typeof item === "string" ? item : item._id)).filter(Boolean);
    if (ids.length > 0) {
      const result = await Feature.deleteMany({
        _id: { $in: ids },
        projectId: id,
      });
      results.deleted = result.deletedCount;
    }
  }

  return NextResponse.json(results);
}
