"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { savePetPhoto } from "@/lib/storage/pet-photo.storage";
import {
  Prisma,
  type BodySize,
  type Gender,
  type NeuterStatus,
  type PetStatus,
} from "@/generated/prisma/client";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text ? new Date(text) : null;
}

function optionalDecimalString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function toJsonDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toJsonDecimal(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function validatePetPhotoUrl(petPhotoUrl: string | null) {
  if (!petPhotoUrl) return;

  const isValidUrl =
    petPhotoUrl.startsWith("/uploads/") ||
    petPhotoUrl.startsWith("/storage/") ||
    petPhotoUrl.startsWith("http://") ||
    petPhotoUrl.startsWith("https://");

  if (!isValidUrl) {
    throw new Error("Invalid pet photo URL.");
  }
}

async function assertDuplicateMicrochip(
  microchipNo: string | null,
  excludePetId?: string
) {
  if (!microchipNo) return;

  const existingPet = await prisma.pet.findFirst({
    where: {
      microchipNo,
      deletedAt: null,
      ...(excludePetId
        ? {
            petId: {
              not: excludePetId,
            },
          }
        : {}),
    },
  });

  if (existingPet) {
    throw new Error("Microchip No already exists.");
  }
}

async function resolvePetPhotoUrl(
  formData: FormData,
  existingPhotoUrl?: string | null
) {
  const petPhotoFile = formData.get("petPhoto") as File | null;

  const uploadedPetPhotoUrl =
    petPhotoFile && petPhotoFile.size > 0
      ? await savePetPhoto(petPhotoFile)
      : null;

  const externalPetPhotoUrl = optionalString(formData.get("petPhotoUrl"));

  const petPhotoUrl =
    uploadedPetPhotoUrl ?? externalPetPhotoUrl ?? existingPhotoUrl ?? null;

  validatePetPhotoUrl(petPhotoUrl);

  return petPhotoUrl;
}

function getPetPayload(formData: FormData) {
  const ownerId = String(formData.get("ownerId") || "").trim();
  const petName = String(formData.get("petName") || "").trim();
  const speciesId = String(formData.get("speciesId") || "").trim();
  const breedId = optionalString(formData.get("breedId"));

  const gender = String(formData.get("gender") || "UNKNOWN") as Gender;
  const neuterStatus = String(
    formData.get("neuterStatus") || "UNKNOWN"
  ) as NeuterStatus;
  const bodySize = String(formData.get("bodySize") || "UNKNOWN") as BodySize;
  const status = String(formData.get("status") || "ACTIVE") as PetStatus;

  const birthDate = optionalDate(formData.get("birthDate"));
  const estimatedAge = optionalString(formData.get("estimatedAge"));

  const weight = optionalDecimalString(formData.get("weight"));
  const high = optionalDecimalString(formData.get("high"));

  const bloodType = optionalString(formData.get("bloodType"));
  const pedigreeNo = optionalString(formData.get("pedigreeNo"));
  const pedigreeName = optionalString(formData.get("pedigreeName"));
  const microchipNo = optionalString(formData.get("microchipNo"));
  const insuranceNo = optionalString(formData.get("insuranceNo"));
  const rabiesTagNo = optionalString(formData.get("rabiesTagNo"));

  const coatColorPrimary = optionalString(formData.get("coatColorPrimary"));
  const coatColorSecondary = optionalString(formData.get("coatColorSecondary"));
  const coatPattern = optionalString(formData.get("coatPattern"));
  const hairType = optionalString(formData.get("hairType"));
  const marking = optionalString(formData.get("marking"));
  const remark = optionalString(formData.get("remark"));

  if (!ownerId) {
    throw new Error("Owner is required.");
  }

  if (!petName) {
    throw new Error("Pet Name is required.");
  }

  if (!speciesId) {
    throw new Error("Species is required.");
  }

  return {
    ownerId,
    petName,
    speciesId,
    breedId,
    gender,
    neuterStatus,
    birthDate,
    estimatedAge,
    weight,
    high,
    bodySize,
    bloodType,
    pedigreeNo,
    pedigreeName,
    microchipNo,
    insuranceNo,
    rabiesTagNo,
    coatColorPrimary,
    coatColorSecondary,
    coatPattern,
    hairType,
    marking,
    status,
    remark,
  };
}

function buildPetAuditValue(pet: {
  petId: string;
  ownerId: string;
  petName: string;
  speciesId: string;
  breedId: string | null;
  gender: Gender;
  neuterStatus: NeuterStatus;
  birthDate: Date | null;
  estimatedAge: string | null;
  weight: unknown;
  high: unknown;
  bodySize: BodySize;
  bloodType: string | null;
  pedigreeNo: string | null;
  pedigreeName: string | null;
  microchipNo: string | null;
  microchipVerifiedAt?: Date | null;
  insuranceNo: string | null;
  rabiesTagNo: string | null;
  coatColorPrimary: string | null;
  coatColorSecondary: string | null;
  coatPattern: string | null;
  hairType: string | null;
  marking: string | null;
  status: PetStatus;
  remark: string | null;
  petPhotoUrl: string | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}): Prisma.InputJsonObject {
  return {
    petId: pet.petId,
    ownerId: pet.ownerId,
    petName: pet.petName,
    speciesId: pet.speciesId,
    breedId: pet.breedId,
    gender: pet.gender,
    neuterStatus: pet.neuterStatus,
    birthDate: toJsonDate(pet.birthDate),
    estimatedAge: pet.estimatedAge,
    weight: toJsonDecimal(pet.weight),
    high: toJsonDecimal(pet.high),
    bodySize: pet.bodySize,
    bloodType: pet.bloodType,
    pedigreeNo: pet.pedigreeNo,
    pedigreeName: pet.pedigreeName,
    microchipNo: pet.microchipNo,
    microchipVerifiedAt: toJsonDate(pet.microchipVerifiedAt ?? null),
    insuranceNo: pet.insuranceNo,
    rabiesTagNo: pet.rabiesTagNo,
    coatColorPrimary: pet.coatColorPrimary,
    coatColorSecondary: pet.coatColorSecondary,
    coatPattern: pet.coatPattern,
    hairType: pet.hairType,
    marking: pet.marking,
    status: pet.status,
    remark: pet.remark,
    petPhotoUrl: pet.petPhotoUrl,
    deletedAt: toJsonDate(pet.deletedAt ?? null),
    createdAt: toJsonDate(pet.createdAt ?? null),
    updatedAt: toJsonDate(pet.updatedAt ?? null),
    createdByUserId: pet.createdByUserId ?? null,
    updatedByUserId: pet.updatedByUserId ?? null,
  };
}

export async function createPet(formData: FormData) {
  const currentUser = await requirePermission("pet", "create");

  const payload = getPetPayload(formData);
  const petPhotoUrl = await resolvePetPhotoUrl(formData);

  await assertDuplicateMicrochip(payload.microchipNo);

  const pet = await prisma.pet.create({
    data: {
      ...payload,
      petPhotoUrl,
      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: currentUser.userId,
      action: "CREATE_PET",
      entityName: "Pet",
      entityId: pet.petId,
      newValue: {
        ...buildPetAuditValue(pet),
        createdByUserId: currentUser.userId,
      },
      ipAddress: null,
    },
  });

  redirect("/pets");
}

export async function updatePet(petId: string, formData: FormData) {
  const currentUser = await requirePermission("pet", "update");

  if (!petId) {
    throw new Error("Pet ID is required.");
  }

  const existingPet = await prisma.pet.findUnique({
    where: {
      petId,
    },
  });

  if (!existingPet || existingPet.deletedAt) {
    throw new Error("Pet not found.");
  }

  const payload = getPetPayload(formData);
  const petPhotoUrl = await resolvePetPhotoUrl(
    formData,
    existingPet.petPhotoUrl
  );

  await assertDuplicateMicrochip(payload.microchipNo, petId);

  const pet = await prisma.pet.update({
    where: {
      petId,
    },
    data: {
      ...payload,
      petPhotoUrl,
      updatedByUserId: currentUser.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: currentUser.userId,
      action: "UPDATE_PET",
      entityName: "Pet",
      entityId: pet.petId,
      oldValue: buildPetAuditValue(existingPet),
      newValue: {
        ...buildPetAuditValue(pet),
        updatedByUserId: currentUser.userId,
      },
      ipAddress: null,
    },
  });

  revalidatePath("/pets");
  revalidatePath(`/pets/${pet.petId}`);
  revalidatePath(`/owners/${pet.ownerId}`);

  redirect(`/pets/${pet.petId}`);
}

export async function deletePet(petId: string) {
  const currentUser = await requirePermission("pet", "delete");

  if (!petId) {
    throw new Error("Pet ID is required.");
  }

  const existingPet = await prisma.pet.findUnique({
    where: {
      petId,
    },
  });

  if (!existingPet || existingPet.deletedAt) {
    throw new Error("Pet not found.");
  }

  const pet = await prisma.pet.update({
    where: {
      petId,
    },
    data: {
      deletedAt: new Date(),
      updatedByUserId: currentUser.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: currentUser.userId,
      action: "DELETE_PET",
      entityName: "Pet",
      entityId: pet.petId,
      oldValue: buildPetAuditValue(existingPet),
      newValue: {
        deletedAt: toJsonDate(pet.deletedAt),
        updatedByUserId: currentUser.userId,
      },
      ipAddress: null,
    },
  });

  revalidatePath("/pets");
  revalidatePath(`/owners/${pet.ownerId}`);

  redirect("/pets");
}