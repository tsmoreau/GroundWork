import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import { connectToDatabase } from "./mongodb";
import { ProjectMember } from "@/models/ProjectMember";
import { Project } from "@/models/Project";
import type { ProjectRole } from "@/types/groundwork";

export async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return null;
  }
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

export async function getUserRole(
  projectId: string,
  userIdOrEmail: string
): Promise<ProjectRole | null> {
  await connectToDatabase();
  const member = await ProjectMember.findOne({
    projectId,
    $or: [{ userId: userIdOrEmail }, { email: userIdOrEmail }],
  });
  return member?.role || null;
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireProjectAccess(
  projectId: string,
  userId: string,
  userEmail: string,
  requiredRoles?: ProjectRole[]
): Promise<ProjectRole> {
  await connectToDatabase();

  const member = await ProjectMember.findOne({
    projectId,
    $or: [{ userId }, { email: userEmail }],
  });

  if (!member) {
    const project = await Project.findById(projectId);
    if (project?.visibility === "public") {
      return "viewer";
    }
    throw new Error("Forbidden");
  }

  if (requiredRoles && !requiredRoles.includes(member.role)) {
    throw new Error("Forbidden");
  }

  return member.role;
}
