"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function validateEmail(email: string | null) {
  if (!email) return;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error("Invalid email format.");
  }
}

async function assertDuplicatePhone(phoneNo: string, excludeOwnerId?: string) {
  const existingOwner = await prisma.owner.findFirst({
    where: {
      phoneNo,
      deletedAt: null,
      ...(excludeOwnerId
        ? {
            ownerId: {
              not: excludeOwnerId,
            },
          }
        : {}),
    },
  });

  if (existingOwner) {
    throw new Error("Phone number already exists.");
  }
}

function getOwnerPayload(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const phoneNo = String(formData.get("phoneNo") || "").trim();
  const lineId = optionalString(formData.get("lineId"));
  const email = optionalString(formData.get("email"));
  const othersSocialMedia = optionalString(formData.get("othersSocialMedia"));

  const houseNo = optionalString(formData.get("houseNo"));
  const villageName = optionalString(formData.get("villageName"));
  const buildingName = optionalString(formData.get("buildingName"));
  const soi = optionalString(formData.get("soi"));
  const road = optionalString(formData.get("road"));
  const subDistrict = optionalString(formData.get("subDistrict"));
  const district = optionalString(formData.get("district"));
  const province = optionalString(formData.get("province"));
  const postalCode = optionalString(formData.get("postalCode"));
  const country = optionalString(formData.get("country")) || "Thailand";

  const remark = optionalString(formData.get("remark"));

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!phoneNo) {
    throw new Error("Phone number is required.");
  }

  validateEmail(email);

  return {
    fullName,
    phoneNo,
    lineId,
    email,
    othersSocialMedia,
    houseNo,
    villageName,
    buildingName,
    soi,
    road,
    subDistrict,
    district,
    province,
    postalCode,
    country,
    remark,
  };
}

export async function createOwner(formData: FormData) {
  const currentUser = await requirePermission("owner", "create");

  const payload = getOwnerPayload(formData);

  await assertDuplicatePhone(payload.phoneNo);

  const owner = await prisma.owner.create({
    data: {
      ...payload,
      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: currentUser.userId,
      action: "CREATE_OWNER",
      entityName: "Owner",
      entityId: owner.ownerId,
      newValue: {
        ownerId: owner.ownerId,
        ...payload,
        createdByUserId: currentUser.userId,
      },
      ipAddress: null,
    },
  });

  redirect("/owners");
}

export async function updateOwner(ownerId: string, formData: FormData) {
  const currentUser = await requirePermission("owner", "update");

  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  const existingOwner = await prisma.owner.findUnique({
    where: {
      ownerId,
    },
  });

  if (!existingOwner || existingOwner.deletedAt) {
    throw new Error("Owner not found.");
  }

  const payload = getOwnerPayload(formData);

  await assertDuplicatePhone(payload.phoneNo, ownerId);

  const owner = await prisma.owner.update({
    where: {
      ownerId,
    },
    data: {
      ...payload,
      updatedByUserId: currentUser.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: currentUser.userId,
      action: "UPDATE_OWNER",
      entityName: "Owner",
      entityId: owner.ownerId,
      oldValue: {
        fullName: existingOwner.fullName,
        phoneNo: existingOwner.phoneNo,
        lineId: existingOwner.lineId,
        email: existingOwner.email,
        othersSocialMedia: existingOwner.othersSocialMedia,
        houseNo: existingOwner.houseNo,
        villageName: existingOwner.villageName,
        buildingName: existingOwner.buildingName,
        soi: existingOwner.soi,
        road: existingOwner.road,
        subDistrict: existingOwner.subDistrict,
        district: existingOwner.district,
        province: existingOwner.province,
        postalCode: existingOwner.postalCode,
        country: existingOwner.country,
        remark: existingOwner.remark,
        updatedByUserId: existingOwner.updatedByUserId,
      },
      newValue: {
        ...payload,
        updatedByUserId: currentUser.userId,
      },
      ipAddress: null,
    },
  });

  revalidatePath("/owners");
  revalidatePath(`/owners/${owner.ownerId}`);

  redirect(`/owners/${owner.ownerId}`);
}

export async function deleteOwner(ownerId: string) {
  const currentUser = await requirePermission("owner", "delete");

  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  const existingOwner = await prisma.owner.findUnique({
    where: {
      ownerId,
    },
    include: {
      pets: {
        where: {
          deletedAt: null,
        },
      },
    },
  });

  if (!existingOwner || existingOwner.deletedAt) {
    throw new Error("Owner not found.");
  }

  if (existingOwner.pets.length > 0) {
    throw new Error(
      "Cannot delete owner because this owner still has registered pets."
    );
  }

  const owner = await prisma.owner.update({
    where: {
      ownerId,
    },
    data: {
      deletedAt: new Date(),
      updatedByUserId: currentUser.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: currentUser.userId,
      action: "DELETE_OWNER",
      entityName: "Owner",
      entityId: owner.ownerId,
      oldValue: {
        ownerId: existingOwner.ownerId,
        fullName: existingOwner.fullName,
        phoneNo: existingOwner.phoneNo,
        lineId: existingOwner.lineId,
        email: existingOwner.email,
        othersSocialMedia: existingOwner.othersSocialMedia,
        houseNo: existingOwner.houseNo,
        villageName: existingOwner.villageName,
        buildingName: existingOwner.buildingName,
        soi: existingOwner.soi,
        road: existingOwner.road,
        subDistrict: existingOwner.subDistrict,
        district: existingOwner.district,
        province: existingOwner.province,
        postalCode: existingOwner.postalCode,
        country: existingOwner.country,
        remark: existingOwner.remark,
        activePetCount: existingOwner.pets.length,
      },
      newValue: {
        deletedAt: owner.deletedAt,
        updatedByUserId: currentUser.userId,
      },
      ipAddress: null,
    },
  });

  revalidatePath("/owners");
  redirect("/owners");
}