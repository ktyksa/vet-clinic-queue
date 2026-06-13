import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission, type ActionName, type ModuleName } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

export async function requirePermission(
  moduleName: ModuleName,
  actionName: ActionName
) {
  const user = await requireAuth();

  if (!hasPermission(user.role as UserRole, moduleName, actionName)) {
    redirect("/unauthorized");
  }

  return user;
}