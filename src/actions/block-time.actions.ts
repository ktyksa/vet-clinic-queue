"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { type BlockTimeType, Prisma } from "@/generated/prisma/client";

const BLOCK_TIME_TYPES: BlockTimeType[] = [
  "LUNCH_BREAK",
  "LEAVE",
  "HOLIDAY",
  "MEETING",
  "SURGERY_ROOM",
  "GROOMING_AREA",
  "BOARDING_AREA",
  "OTHER",
];

function requiredString(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function requiredDate(value: FormDataEntryValue | null) {
  const text = requiredString(value);

  if (!text) {
    throw new Error("Date and time are required.");
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date and time.");
  }

  return date;
}

function isValidBlockTimeType(value: string): value is BlockTimeType {
  return BLOCK_TIME_TYPES.includes(value as BlockTimeType);
}

function toJsonDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function buildBlockTimeAuditValue(blockTime: {
  blockTimeId: string;
  title: string;
  description: string | null;
  blockType: BlockTimeType;
  startDateTime: Date;
  endDateTime: Date;
  veterinarianId: string | null;
  groomerId: string | null;
  activeFlag: boolean;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}): Prisma.InputJsonObject {
  return {
    blockTimeId: blockTime.blockTimeId,
    title: blockTime.title,
    description: blockTime.description,
    blockType: blockTime.blockType,
    startDateTime: toJsonDate(blockTime.startDateTime),
    endDateTime: toJsonDate(blockTime.endDateTime),
    veterinarianId: blockTime.veterinarianId,
    groomerId: blockTime.groomerId,
    activeFlag: blockTime.activeFlag,
    deletedAt: toJsonDate(blockTime.deletedAt),
    createdAt: toJsonDate(blockTime.createdAt),
    updatedAt: toJsonDate(blockTime.updatedAt),
    createdByUserId: blockTime.createdByUserId ?? null,
    updatedByUserId: blockTime.updatedByUserId ?? null,
  };
}

async function assertUserCanBeResource(params: {
  veterinarianId: string | null;
  groomerId: string | null;
}) {
  if (params.veterinarianId && params.groomerId) {
    throw new Error("Please select either veterinarian or groomer, not both.");
  }

  if (params.veterinarianId) {
    const vet = await prisma.user.findFirst({
      where: {
        userId: params.veterinarianId,
        role: "VETERINARIAN",
        status: "ACTIVE",
        activeFlag: true,
      },
      select: {
        userId: true,
      },
    });

    if (!vet) {
      throw new Error("Veterinarian resource not found or inactive.");
    }
  }

  if (params.groomerId) {
    const groomer = await prisma.user.findFirst({
      where: {
        userId: params.groomerId,
        role: "GROOMER",
        status: "ACTIVE",
        activeFlag: true,
      },
      select: {
        userId: true,
      },
    });

    if (!groomer) {
      throw new Error("Groomer resource not found or inactive.");
    }
  }
}

function revalidateBlockTimePaths() {
  revalidatePath("/appointments");
  revalidatePath("/appointments/calendar");
}

export async function createBlockTime(formData: FormData) {
  const currentUser = await requirePermission("blockTime", "create");

  const title = requiredString(formData.get("title"));
  const description = optionalString(formData.get("description"));
  const blockTypeRaw = requiredString(formData.get("blockType"));
  const startDateTime = requiredDate(formData.get("startDateTime"));
  const endDateTime = requiredDate(formData.get("endDateTime"));
  const resourceId = optionalString(formData.get("resourceId"));
  const resourceRole = optionalString(formData.get("resourceRole"));

  if (!title) {
    throw new Error("Block time title is required.");
  }

  if (!isValidBlockTimeType(blockTypeRaw)) {
    throw new Error("Invalid block time type.");
  }

  if (endDateTime.getTime() <= startDateTime.getTime()) {
    throw new Error("End time must be later than start time.");
  }

  const veterinarianId = resourceRole === "VETERINARIAN" ? resourceId : null;
  const groomerId = resourceRole === "GROOMER" ? resourceId : null;

  await assertUserCanBeResource({
    veterinarianId,
    groomerId,
  });

  const blockTime = await prisma.$transaction(async (tx) => {
    const createdBlockTime = await tx.blockTime.create({
      data: {
        title,
        description,
        blockType: blockTypeRaw,
        startDateTime,
        endDateTime,
        veterinarianId,
        groomerId,
        activeFlag: true,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_BLOCK_TIME",
        entityName: "BlockTime",
        entityId: createdBlockTime.blockTimeId,
        newValue: buildBlockTimeAuditValue(createdBlockTime),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return createdBlockTime;
  });

  revalidateBlockTimePaths();

  redirect(`/appointments/calendar?date=${blockTime.startDateTime
    .toISOString()
    .slice(0, 10)}`);
}

export async function updateBlockTime(formData: FormData) {
  const currentUser = await requirePermission("blockTime", "update");

  const blockTimeId = requiredString(formData.get("blockTimeId"));
  const title = requiredString(formData.get("title"));
  const description = optionalString(formData.get("description"));
  const blockTypeRaw = requiredString(formData.get("blockType"));
  const startDateTime = requiredDate(formData.get("startDateTime"));
  const endDateTime = requiredDate(formData.get("endDateTime"));
  const resourceId = optionalString(formData.get("resourceId"));
  const resourceRole = optionalString(formData.get("resourceRole"));

  if (!blockTimeId) {
    throw new Error("Block time ID is required.");
  }

  if (!title) {
    throw new Error("Block time title is required.");
  }

  if (!isValidBlockTimeType(blockTypeRaw)) {
    throw new Error("Invalid block time type.");
  }

  if (endDateTime.getTime() <= startDateTime.getTime()) {
    throw new Error("End time must be later than start time.");
  }

  const existingBlockTime = await prisma.blockTime.findFirst({
    where: {
      blockTimeId,
      deletedAt: null,
    },
  });

  if (!existingBlockTime) {
    throw new Error("Block time not found.");
  }

  const veterinarianId = resourceRole === "VETERINARIAN" ? resourceId : null;
  const groomerId = resourceRole === "GROOMER" ? resourceId : null;

  await assertUserCanBeResource({
    veterinarianId,
    groomerId,
  });

  const blockTime = await prisma.$transaction(async (tx) => {
    const updatedBlockTime = await tx.blockTime.update({
      where: {
        blockTimeId,
      },
      data: {
        title,
        description,
        blockType: blockTypeRaw,
        startDateTime,
        endDateTime,
        veterinarianId,
        groomerId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "UPDATE_BLOCK_TIME",
        entityName: "BlockTime",
        entityId: updatedBlockTime.blockTimeId,
        oldValue: buildBlockTimeAuditValue(existingBlockTime),
        newValue: buildBlockTimeAuditValue(updatedBlockTime),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return updatedBlockTime;
  });

  revalidateBlockTimePaths();

  redirect(`/appointments/calendar?date=${blockTime.startDateTime
    .toISOString()
    .slice(0, 10)}`);
}

export async function deleteBlockTime(formData: FormData) {
  const currentUser = await requirePermission("blockTime", "delete");

  const blockTimeId = requiredString(formData.get("blockTimeId"));

  if (!blockTimeId) {
    throw new Error("Block time ID is required.");
  }

  const existingBlockTime = await prisma.blockTime.findFirst({
    where: {
      blockTimeId,
      deletedAt: null,
    },
  });

  if (!existingBlockTime) {
    throw new Error("Block time not found.");
  }

  const blockTime = await prisma.$transaction(async (tx) => {
    const deletedBlockTime = await tx.blockTime.update({
      where: {
        blockTimeId,
      },
      data: {
        activeFlag: false,
        deletedAt: new Date(),
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "DELETE_BLOCK_TIME",
        entityName: "BlockTime",
        entityId: deletedBlockTime.blockTimeId,
        oldValue: buildBlockTimeAuditValue(existingBlockTime),
        newValue: buildBlockTimeAuditValue(deletedBlockTime),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return deletedBlockTime;
  });

  revalidateBlockTimePaths();

  redirect(`/appointments/calendar?date=${blockTime.startDateTime
    .toISOString()
    .slice(0, 10)}`);
}
