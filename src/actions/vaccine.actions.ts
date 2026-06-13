"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import type { VaccineReminderStatus } from "@/generated/prisma/client";

export async function createVaccineRecord(data: {
  petId: string;
  visitId?: string | null;
  vaccineId: string;
  vetId: string;
  administeredDate: Date;
  lotNo?: string | null;
  manufacturer?: string | null;
  remark?: string | null;
  weightAtInjection?: number | null;
}) {
  const currentUser = await requirePermission("vaccine", "create");

  const vaccine = await prisma.vaccine.findUnique({
    where: { vaccineId: data.vaccineId },
  });

  if (!vaccine || !vaccine.activeFlag) {
    throw new Error("Vaccine not found.");
  }

  // Calculate nextDueDate: prefer defaultIntervalDays, fallback to validMonths
  let nextDueDate: Date | null = null;
  if (vaccine.defaultIntervalDays) {
    nextDueDate = new Date(data.administeredDate);
    nextDueDate.setDate(nextDueDate.getDate() + vaccine.defaultIntervalDays);
  } else if (vaccine.validMonths) {
    nextDueDate = new Date(data.administeredDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.validMonths);
  }

  const record = await prisma.$transaction(async (tx) => {
    const vaccineRecord = await tx.vaccineRecord.create({
      data: {
        petId: data.petId,
        visitId: data.visitId ?? null,
        vaccineId: data.vaccineId,
        vetId: data.vetId,
        injectionDate: data.administeredDate,
        nextDueDate,
        lotNo: data.lotNo ?? null,
        manufacturer: data.manufacturer ?? null,
        remark: data.remark ?? null,
        weightAtInjection: data.weightAtInjection ?? null,
        status: "GIVEN",
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    if (nextDueDate) {
      await tx.vaccineReminder.create({
        data: {
          petId: data.petId,
          vaccineRecordId: vaccineRecord.vaccineRecordId,
          dueDate: nextDueDate,
          status: "UPCOMING",
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_VACCINE_RECORD",
        entityName: "VaccineRecord",
        entityId: vaccineRecord.vaccineRecordId,
        newValue: {
          vaccineRecordId: vaccineRecord.vaccineRecordId,
          petId: vaccineRecord.petId,
          vaccineId: vaccineRecord.vaccineId,
          injectionDate: vaccineRecord.injectionDate.toISOString(),
          nextDueDate: nextDueDate?.toISOString() ?? null,
        },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return vaccineRecord;
  });

  revalidatePath(`/pets/${data.petId}/vaccines`);
  revalidatePath("/vaccines/reminders");

  return record;
}

export async function updateReminderStatus(
  id: string,
  status: VaccineReminderStatus,
) {
  const currentUser = await requirePermission("vaccine", "update");

  const reminder = await prisma.vaccineReminder.findUnique({
    where: { vaccineReminderId: id },
  });

  if (!reminder) {
    throw new Error("Reminder not found.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.vaccineReminder.update({
      where: { vaccineReminderId: id },
      data: {
        status,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "UPDATE_VACCINE_REMINDER_STATUS",
        entityName: "VaccineReminder",
        entityId: id,
        oldValue: { status: reminder.status },
        newValue: { status },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return result;
  });

  revalidatePath(`/pets/${updated.petId}/vaccines`);
  revalidatePath("/vaccines/reminders");

  return updated;
}

export async function linkReminderToAppointment(
  reminderId: string,
  appointmentId: string,
) {
  const currentUser = await requirePermission("vaccine", "update");

  const reminder = await prisma.vaccineReminder.findUnique({
    where: { vaccineReminderId: reminderId },
  });

  if (!reminder) {
    throw new Error("Reminder not found.");
  }

  const appointment = await prisma.appointment.findUnique({
    where: { appointmentId },
  });

  if (!appointment || appointment.deletedAt) {
    throw new Error("Appointment not found.");
  }

  const updated = await prisma.vaccineReminder.update({
    where: { vaccineReminderId: reminderId },
    data: {
      appointmentId,
      updatedByUserId: currentUser.userId,
    },
  });

  revalidatePath("/vaccines/reminders");

  return updated;
}

export async function getVaccinesDueInDays(days: number) {
  await requirePermission("vaccine", "view");

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + days);

  return prisma.vaccineReminder.findMany({
    where: {
      status: { in: ["UPCOMING", "DUE", "OVERDUE"] },
      dueDate: { lte: cutoff },
    },
    include: {
      pet: {
        include: {
          owner: true,
          species: true,
        },
      },
      vaccineRecord: {
        include: {
          vaccine: true,
          vet: true,
        },
      },
      appointment: true,
    },
    orderBy: { dueDate: "asc" },
  });
}
