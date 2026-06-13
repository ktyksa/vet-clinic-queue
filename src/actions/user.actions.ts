"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { hashPassword, validatePasswordPolicy } from "@/lib/security/password";
import type { Language, UserRole, UserStatus } from "@/generated/prisma/client";

function canManageRole(currentRole: UserRole, targetRole: UserRole) {
  if (currentRole === "ADMIN") return true;

  if (currentRole === "CLINIC_OWNER") {
    return targetRole !== "ADMIN" && targetRole !== "CLINIC_OWNER";
  }

  return false;
}

async function assertNotLastPrivilegedUser(targetUserId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { userId: targetUserId },
  });

  if (!targetUser) {
    throw new Error("User not found.");
  }

  if (targetUser.role !== "ADMIN" && targetUser.role !== "CLINIC_OWNER") {
    return;
  }

  const activePrivilegedCount = await prisma.user.count({
    where: {
      userId: {
        not: targetUserId,
      },
      role: {
        in: ["ADMIN", "CLINIC_OWNER"],
      },
      status: "ACTIVE",
      activeFlag: true,
    },
  });

  if (activePrivilegedCount === 0) {
    throw new Error("Cannot deactivate the last active Admin or Clinic Owner.");
  }
}

export async function createUser(formData: FormData) {
  const currentUser = await requirePermission("user", "create");
  const currentRole = currentUser.role as UserRole;

  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phoneNo = String(formData.get("phoneNo") || "").trim();
  const role = String(formData.get("role") || "STAFF") as UserRole;
  const activeFlag = formData.get("activeFlag") === "on";
  const status: UserStatus = activeFlag ? "ACTIVE" : "INACTIVE";
  const preferredLanguage = String(
    formData.get("preferredLanguage") || "TH"
  ) as Language;
  const licenseNo = String(formData.get("licenseNo") || "").trim();
  const password = String(formData.get("password") || "");

  if (!fullName) throw new Error("Full name is required.");
  if (!email) throw new Error("Email is required.");
  if (!password) throw new Error("Password is required.");

  if (!canManageRole(currentRole, role)) {
    throw new Error("You do not have permission to create this role.");
  }

  const passwordPolicy = validatePasswordPolicy(password);

  if (!passwordPolicy.valid) {
    throw new Error(passwordPolicy.errors.join(" "));
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("Email already exists.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      phoneNo: phoneNo || null,
      role,
      status,
      activeFlag,
      preferredLanguage,
      licenseNo: licenseNo || null,
      passwordHash,
      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: currentUser.userId,
      action: "CREATE_USER",
      entityName: "User",
      entityId: user.userId,
      newValue: {
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        activeFlag: user.activeFlag,
        preferredLanguage: user.preferredLanguage,
        createdByUserId: currentUser.userId,
      },
      ipAddress: null,
    },
  });

  redirect("/administration/users");
}

export async function toggleUserStatus(userId: string) {
  const currentUser = await requirePermission("user", "update");
  const currentRole = currentUser.role as UserRole;

  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (userId === currentUser.userId) {
    throw new Error("You cannot activate or deactivate your own account.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { userId },
  });

  if (!existingUser) {
    throw new Error("User not found.");
  }

  if (!canManageRole(currentRole, existingUser.role)) {
    throw new Error("You do not have permission to manage this user.");
  }

  if (existingUser.status === "TERMINATED") {
    throw new Error("Terminated user cannot be activated from this action.");
  }

  if (existingUser.activeFlag) {
    await assertNotLastPrivilegedUser(userId);
  }

  const nextActiveFlag = !existingUser.activeFlag;
  const nextStatus: UserStatus = nextActiveFlag ? "ACTIVE" : "INACTIVE";

  const user = await prisma.user.update({
    where: { userId },
    data: {
      status: nextStatus,
      activeFlag: nextActiveFlag,
      deactivatedAt: nextActiveFlag ? null : new Date(),
      deactivatedByUserId: nextActiveFlag ? null : currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: currentUser.userId,
      action: nextActiveFlag ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityName: "User",
      entityId: user.userId,
      oldValue: {
        status: existingUser.status,
        activeFlag: existingUser.activeFlag,
        deactivatedAt: existingUser.deactivatedAt,
        deactivatedByUserId: existingUser.deactivatedByUserId,
      },
      newValue: {
        status: user.status,
        activeFlag: user.activeFlag,
        deactivatedAt: user.deactivatedAt,
        deactivatedByUserId: user.deactivatedByUserId,
        updatedByUserId: currentUser.userId,
      },
      ipAddress: null,
    },
  });

  revalidatePath("/administration/users");
}

export async function deactivateUser(userId: string) {
  await toggleUserStatus(userId);
}