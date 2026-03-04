import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";
import { ProjectMember } from "@/models/ProjectMember";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();
    await requireProjectAccess(id, user.id, user.email!);

    const members = await ProjectMember.find({ projectId: id }).lean();
    return NextResponse.json(members);
  } catch (err: any) {
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();
    await requireProjectAccess(id, user.id, user.email!, ["owner", "editor"]);

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    if (!["editor", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Role must be editor or viewer" }, { status: 400 });
    }

    const existing = await ProjectMember.findOne({
      projectId: id,
      email: email.toLowerCase(),
    });

    if (existing) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    let userId: mongoose.Types.ObjectId | null = null;
    const db = mongoose.connection.db;
    if (db) {
      const existingUser = await db.collection("users").findOne({ email: email.toLowerCase() });
      if (existingUser) {
        userId = existingUser._id as mongoose.Types.ObjectId;
      }
    }

    const member = await ProjectMember.create({
      projectId: id,
      userId,
      email: email.toLowerCase(),
      role,
    });

    return NextResponse.json(member, { status: 201 });
  } catch (err: any) {
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err.code === 11000) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
