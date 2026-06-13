"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";

export async function markPrescriptionReady(prescriptionId: string) {
  const currentUser = await requirePermission("prescription", "update");

  const prescription = await prisma.prescription.findUnique({
    where: { prescriptionId },
    select: { status: true },
  });

  if (!prescription) throw new Error("Prescription not found.");
  if (prescription.status !== "PREPARING") {
    throw new Error("Prescription is not in PREPARING status.");
  }

  await prisma.prescription.update({
    where: { prescriptionId },
    data: {
      status: "READY_FOR_DISPENSING",
      updatedByUserId: currentUser.userId,
    },
  });

  revalidatePath("/pharmacy");
  revalidatePath("/billing");
}

export async function dispensePrescription(prescriptionId: string) {
  const currentUser = await requirePermission("prescription", "update");

  const prescription = await prisma.prescription.findUnique({
    where: { prescriptionId },
    include: {
      visit: {
        select: {
          invoice: { select: { status: true } },
        },
      },
    },
  });

  if (!prescription) throw new Error("Prescription not found.");
  if (prescription.status !== "READY_FOR_DISPENSING") {
    throw new Error("Prescription is not ready for dispensing.");
  }

  if (prescription.visit.invoice?.status !== "PAID") {
    throw new Error("Cannot dispense: invoice has not been paid yet.");
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.prescription.update({
      where: { prescriptionId },
      data: {
        status: "DISPENSED",
        dispensedAt: now,
        dispensedByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "DISPENSE_PRESCRIPTION",
        entityName: "Prescription",
        entityId: prescriptionId,
        oldValue: { status: "READY_FOR_DISPENSING" },
        newValue: { status: "DISPENSED", dispensedAt: now.toISOString() },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/pharmacy");
}

export async function addPrescriptionItem(formData: FormData) {
  const currentUser = await requirePermission("prescription", "update");

  const prescriptionId = String(formData.get("prescriptionId") ?? "").trim();
  const medicationName = String(formData.get("medicationName") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim() || null;
  const frequency = String(formData.get("frequency") ?? "").trim() || null;
  const duration = String(formData.get("duration") ?? "").trim() || null;
  const quantity = Number(formData.get("quantity") ?? 1);
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;

  if (!prescriptionId) throw new Error("Prescription ID is required.");
  if (!medicationName) throw new Error("Medication name is required.");
  if (quantity <= 0) throw new Error("Quantity must be positive.");

  const prescription = await prisma.prescription.findUnique({
    where: { prescriptionId },
    select: { status: true },
  });

  if (!prescription) throw new Error("Prescription not found.");
  if (prescription.status !== "PREPARING") {
    throw new Error("Can only add items to prescriptions in PREPARING status.");
  }

  await prisma.prescriptionItem.create({
    data: {
      prescriptionId,
      medicationName,
      dosage,
      frequency,
      duration,
      quantity,
      unit,
      instructions,
      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  revalidatePath("/pharmacy");
}

export async function removePrescriptionItem(prescriptionItemId: string) {
  const currentUser = await requirePermission("prescription", "update");

  const item = await prisma.prescriptionItem.findUnique({
    where: { prescriptionItemId },
    include: { prescription: { select: { status: true } } },
  });

  if (!item) throw new Error("Item not found.");
  if (item.prescription.status !== "PREPARING") {
    throw new Error("Cannot remove items from this prescription.");
  }

  await prisma.prescriptionItem.delete({ where: { prescriptionItemId } });

  revalidatePath("/pharmacy");
}

export async function cancelPrescription(formData: FormData) {
  const currentUser = await requirePermission("prescription", "update");

  const prescriptionId = String(formData.get("prescriptionId") ?? "").trim();
  const cancelReason = String(formData.get("cancelReason") ?? "").trim();

  if (!prescriptionId) throw new Error("Prescription ID is required.");
  if (!cancelReason) throw new Error("Cancel reason is required.");

  const prescription = await prisma.prescription.findUnique({
    where: { prescriptionId },
    select: { status: true },
  });

  if (!prescription) throw new Error("Prescription not found.");
  if (prescription.status === "DISPENSED" || prescription.status === "CANCELLED") {
    throw new Error("Cannot cancel this prescription.");
  }

  const now = new Date();

  await prisma.prescription.update({
    where: { prescriptionId },
    data: {
      status: "CANCELLED",
      cancelReason,
      cancelledAt: now,
      updatedByUserId: currentUser.userId,
    },
  });

  revalidatePath("/pharmacy");
}
