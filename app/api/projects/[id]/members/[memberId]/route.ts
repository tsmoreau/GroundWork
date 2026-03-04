import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthUser, requireProjectAccess } from "@/lib/permissions";
import { ProjectMember } from "@/models/ProjectMember";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, memberId } = await params;
    await connectToDatabase();
    const callerRole = await requireProjectAccess(id, user.id, user.email!);

    const body = await request.json();
    const { role } = body;

    if (!role || !["owner", "editor", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Valid role is required" }, { status: 400 });
    }

    const targetMember = await ProjectMember.findById(memberId);
    if (!targetMember || targetMember.projectId.toString() !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (role === "owner") {
      if (callerRole !== "owner") {
        return NextResponse.json({ error: "Only the owner can transfer ownership" }, { status: 403 });
      }

      const callerMember = await ProjectMember.findOne({
        projectId: id,
        $or: [{ userId: user.id }, { email: user.email }],
      });

      if (callerMember) {
        callerMember.role = "editor";
        await callerMember.save();
      }

      targetMember.role = "owner";
      await targetMember.save();

      return NextResponse.json(targetMember);
    }

    if (callerRole !== "owner") {
      return NextResponse.json({ error: "Only the owner can change roles" }, { status: 403 });
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot change the owner's role directly" }, { status: 400 });
    }

    targetMember.role = role;
    await targetMember.save();

    return NextResponse.json(targetMember);
  } catch (err: any) {
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, memberId } = await params;
    await connectToDatabase();
    const callerRole = await requireProjectAccess(id, user.id, user.email!);

    const targetMember = await ProjectMember.findById(memberId);
    if (!targetMember || targetMember.projectId.toString() !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the project owner" }, { status: 400 });
    }

    const isSelf =
      (targetMember.userId && targetMember.userId.toString() === user.id) ||
      targetMember.email === user.email;

    if (!isSelf && callerRole !== "owner") {
      return NextResponse.json({ error: "Only the owner can remove other members" }, { status: 403 });
    }

    await ProjectMember.findByIdAndDelete(memberId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
