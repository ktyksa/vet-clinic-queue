"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { appointmentConfig } from "@/config/appointment.config";
import {
  formatDatePart,
  generateAppointmentNo,
  generateQueueCode,
  generateVisitNo,
  mapAppointmentTypeToVisitType,
  optionalString,
  requiredDate,
  requiredString,
  startOfDay,
  toCalendarDateParam,
  toJsonDate,
} from "@/lib/action-utils";
import {
  Prisma,
  type AppointmentSource,
  type AppointmentStatus,
  type AppointmentType,
} from "@/generated/prisma/client";


const MEDICAL_APPOINTMENT_TYPES: AppointmentType[] = [
  "CHECKUP",
  "VACCINE",
  "SICK",
  "FOLLOW_UP",
  "SURGERY",
  "OTHER",
];

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "BOOKED",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "BOOKED",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
];

const FINAL_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

type AppointmentPayload = {
  appointmentId: string | null;
  ownerId: string;
  petId: string;
  vetId: string | null;
  appointmentType: AppointmentType;
  appointmentDate: Date;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  source: AppointmentSource;
  status: AppointmentStatus | null;
  note: string | null;
  priority: string | null;
  queueType: string | null;
};


function isValidAppointmentType(value: string): value is AppointmentType {
  return MEDICAL_APPOINTMENT_TYPES.includes(value as AppointmentType);
}

function isValidAppointmentStatus(value: string): value is AppointmentStatus {
  return APPOINTMENT_STATUSES.includes(value as AppointmentStatus);
}

function isValidAppointmentSource(value: string): value is AppointmentSource {
  return value === "ADVANCE_BOOKING" || value === "WALK_IN";
}

function getDateRange(date: Date) {
  const start = startOfDay(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function getNextMedicalQueueNo(tx: Prisma.TransactionClient, appointmentDate: Date) {
  const { start } = getDateRange(appointmentDate);

  const rows = await tx.$queryRaw<{ max_num: number | null }[]>`
    SELECT MAX("queueNumber") AS max_num
    FROM "MedicalQueue"
    WHERE "queueDate" = ${start}
      AND "deletedAt" IS NULL
    FOR UPDATE
  `;

  return (rows[0]?.max_num ?? 0) + 1;
}

function getAppointmentPayload(formData: FormData): AppointmentPayload {
  const appointmentId = optionalString(formData.get("appointmentId"));
  const ownerId = requiredString(formData.get("ownerId"));
  const petId = requiredString(formData.get("petId"));
  const vetId = optionalString(formData.get("vetId"));
  const appointmentTypeRaw = requiredString(formData.get("appointmentType"));
  const sourceRaw = optionalString(formData.get("source")) ?? "ADVANCE_BOOKING";
  const statusRaw = optionalString(formData.get("status"));
  const note = optionalString(formData.get("note"));
  const priority = optionalString(formData.get("priority"));
  const queueType = optionalString(formData.get("queueType"));

  if (!ownerId) throw new Error("Owner is required.");
  if (!petId) throw new Error("Pet is required.");
  if (!appointmentTypeRaw) throw new Error("Appointment type is required.");
  if (!isValidAppointmentType(appointmentTypeRaw)) {
    throw new Error("Invalid medical appointment type.");
  }
  if (!isValidAppointmentSource(sourceRaw)) throw new Error("Invalid appointment source.");
  if (statusRaw && !isValidAppointmentStatus(statusRaw)) throw new Error("Invalid appointment status.");

  const isWalkIn = sourceRaw === "WALK_IN";
  const now = new Date();
  const roundedNow = new Date(now);
  roundedNow.setSeconds(0, 0);

  let startAt: Date;
  let endAt: Date;
  let durationMinutes: number;

  if (isWalkIn) {
    startAt = roundedNow;
    endAt = new Date(startAt.getTime() + 30 * 60_000);
    durationMinutes = 30;
  } else {
    startAt = requiredDate(formData.get("startAt") ?? formData.get("appointmentDate"));
    endAt = requiredDate(formData.get("endAt"));
    durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);

    if (!vetId) throw new Error("Veterinarian is required for advance booking.");
    if (endAt <= startAt) throw new Error("End time must be later than start time.");
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new Error("Duration is invalid.");
    }
  }

  return {
    appointmentId,
    ownerId,
    petId,
    vetId,
    appointmentType: appointmentTypeRaw,
    appointmentDate: startAt,
    startAt,
    endAt,
    durationMinutes,
    source: sourceRaw,
    status: statusRaw ? (statusRaw as AppointmentStatus) : null,
    note,
    priority,
    queueType,
  };
}

function buildAppointmentAuditValue(appointment: {
  appointmentId: string;
  appointmentNo: string;
  ownerId: string;
  petId: string;
  vetId: string | null;
  appointmentType: AppointmentType;
  appointmentDate: Date;
  startAt?: Date | null;
  endAt?: Date | null;
  durationMinutes?: number | null;
  source?: AppointmentSource | null;
  status: AppointmentStatus;
  note: string | null;
  cancelReason?: string | null;
  cancelledAt?: Date | null;
  checkedInAt?: Date | null;
  completedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}): Prisma.InputJsonObject {
  return {
    appointmentId: appointment.appointmentId,
    appointmentNo: appointment.appointmentNo,
    ownerId: appointment.ownerId,
    petId: appointment.petId,
    vetId: appointment.vetId,
    appointmentType: appointment.appointmentType,
    appointmentDate: toJsonDate(appointment.appointmentDate),
    startAt: toJsonDate(appointment.startAt),
    endAt: toJsonDate(appointment.endAt),
    durationMinutes: appointment.durationMinutes ?? null,
    source: appointment.source ?? null,
    status: appointment.status,
    note: appointment.note,
    cancelReason: appointment.cancelReason ?? null,
    cancelledAt: toJsonDate(appointment.cancelledAt),
    checkedInAt: toJsonDate(appointment.checkedInAt),
    completedAt: toJsonDate(appointment.completedAt),
    deletedAt: toJsonDate(appointment.deletedAt),
    createdAt: toJsonDate(appointment.createdAt),
    updatedAt: toJsonDate(appointment.updatedAt),
    createdByUserId: appointment.createdByUserId ?? null,
    updatedByUserId: appointment.updatedByUserId ?? null,
  };
}

async function assertOwnerExists(ownerId: string) {
  const owner = await prisma.owner.findFirst({
    where: { ownerId, deletedAt: null },
    select: { ownerId: true },
  });
  if (!owner) throw new Error("Owner not found.");
}

async function assertPetBelongsToOwner(petId: string, ownerId: string) {
  const pet = await prisma.pet.findFirst({
    where: { petId, ownerId, deletedAt: null },
    select: { petId: true },
  });
  if (!pet) throw new Error("Pet not found or pet does not belong to selected owner.");
}

async function assertVetIsActive(vetId: string | null) {
  if (!vetId) return;

  const vet = await prisma.user.findFirst({
    where: {
      userId: vetId,
      role: "VETERINARIAN",
      status: "ACTIVE",
      activeFlag: true,
    },
    select: { userId: true },
  });

  if (!vet) throw new Error("Veterinarian not found or inactive.");
}

async function assertNoOverlappingPetAppointment(params: {
  petId: string;
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string | null;
}) {
  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      petId: params.petId,
      deletedAt: null,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      startAt: { lt: params.endAt },
      endAt: { gt: params.startAt },
      ...(params.excludeAppointmentId ? { appointmentId: { not: params.excludeAppointmentId } } : {}),
    },
    select: { appointmentId: true },
  });

  if (existingAppointment) throw new Error("Pet already has an overlapping appointment.");
}

async function assertNoOverlappingVetAppointment(params: {
  vetId: string | null;
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string | null;
}) {
  if (!params.vetId) return;

  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      vetId: params.vetId,
      deletedAt: null,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      startAt: { lt: params.endAt },
      endAt: { gt: params.startAt },
      ...(params.excludeAppointmentId ? { appointmentId: { not: params.excludeAppointmentId } } : {}),
    },
    select: { appointmentId: true },
  });

  if (existingAppointment) throw new Error("Veterinarian already has an overlapping appointment.");
}

async function getExistingAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({ where: { appointmentId } });
  if (!appointment || appointment.deletedAt) throw new Error("Appointment not found.");
  return appointment;
}

function assertAppointmentCanBeChanged(status: AppointmentStatus) {
  if (FINAL_APPOINTMENT_STATUSES.includes(status)) {
    throw new Error("Finalized appointment cannot be changed.");
  }
}

function assertWithinCheckInWindow(appointment: {
  source?: AppointmentSource | null;
  startAt?: Date | null;
  appointmentDate: Date;
}) {
  if (appointment.source === "WALK_IN") return;

  const windowMinutes = appointmentConfig.scheduling.checkInWindowMinutes ?? 30;
  const appointmentStartAt = appointment.startAt ?? appointment.appointmentDate;
  const earliestCheckInAt = new Date(appointmentStartAt.getTime() - windowMinutes * 60_000);
  const now = new Date();

  if (now < earliestCheckInAt) {
    throw new Error(`Check-in is allowed only within ${windowMinutes} minutes before the appointment time.`);
  }
}

function shouldCheckSamePetAppointment() {
  return !appointmentConfig.scheduling.allowOverbooking &&
    !appointmentConfig.scheduling.allowSamePetMultipleAppointments;
}

function shouldCheckSameVetAppointment() {
  return !appointmentConfig.scheduling.allowOverbooking &&
    !appointmentConfig.scheduling.allowSameVetMultipleAppointments;
}

function getReminderAvailableAt(appointmentDate: Date) {
  const reminderAt = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
  const now = new Date();
  return reminderAt.getTime() > now.getTime() ? reminderAt : now;
}

function revalidateAppointmentPaths(appointmentId?: string) {
  revalidatePath("/appointments");
  revalidatePath("/appointments/calendar");
  revalidatePath("/appointments/new");
  if (appointmentId) {
    revalidatePath(`/appointments/${appointmentId}`);
    revalidatePath(`/appointments/${appointmentId}/edit`);
  }
}

function shouldRedirectToCalendar(formData: FormData) {
  return requiredString(formData.get("redirectToCalendar")) === "1";
}

function redirectAfterAppointmentAction(formData: FormData, appointment: { appointmentId: string; startAt?: Date | null; appointmentDate: Date }) {
  if (shouldRedirectToCalendar(formData)) {
    const calendarDate = toCalendarDateParam(appointment.startAt ?? appointment.appointmentDate);
    redirect(`/appointments/calendar?date=${calendarDate}&view=week`);
  }

  redirect(`/appointments/${appointment.appointmentId}`);
}

export async function createAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "create");
  const payload = getAppointmentPayload(formData);

  if (payload.source === "ADVANCE_BOOKING" && payload.startAt.getTime() < Date.now() - 60_000) {
    throw new Error("Appointment start time cannot be in the past.");
  }

  await assertOwnerExists(payload.ownerId);
  await assertPetBelongsToOwner(payload.petId, payload.ownerId);
  await assertVetIsActive(payload.vetId);

  if (shouldCheckSamePetAppointment()) {
    await assertNoOverlappingPetAppointment({ petId: payload.petId, startAt: payload.startAt, endAt: payload.endAt });
  }

  if (shouldCheckSameVetAppointment()) {
    await assertNoOverlappingVetAppointment({ vetId: payload.vetId, startAt: payload.startAt, endAt: payload.endAt });
  }

  const now = new Date();
  const isWalkIn = payload.source === "WALK_IN";

  const appointment = await prisma.$transaction(async (tx) => {
    const createdAppointment = await tx.appointment.create({
      data: {
        appointmentNo: generateAppointmentNo(payload.appointmentDate),
        ownerId: payload.ownerId,
        petId: payload.petId,
        vetId: payload.vetId,
        appointmentType: payload.appointmentType,
        appointmentDate: payload.startAt,
        startAt: payload.startAt,
        endAt: payload.endAt,
        durationMinutes: payload.durationMinutes,
        source: payload.source,
        status: isWalkIn ? "ARRIVED" : payload.status ?? "BOOKED",
        checkedInAt: isWalkIn ? now : null,
        note: payload.note,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: null,
            toStatus: isWalkIn ? "ARRIVED" : payload.status ?? "BOOKED",
            actionCode: isWalkIn ? "CREATE_WALK_IN_APPOINTMENT" : "CREATE_ADVANCE_BOOKING_APPOINTMENT",
            reason: isWalkIn ? "Walk-in medical appointment created and checked in" : "Advance booking medical appointment created",
            note: payload.note,
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
      },
    });

if (isWalkIn) {
  const queueDate = getDateRange(createdAppointment.appointmentDate).start;
  const queueNumber = await getNextMedicalQueueNo(tx, createdAppointment.appointmentDate);
  const createdVisit = await tx.visit.create({
    data: {
      visitNo: generateVisitNo(now),
      appointmentId: createdAppointment.appointmentId,
      ownerId: createdAppointment.ownerId,
      petId: createdAppointment.petId,
      vetId: createdAppointment.vetId,
      visitDate: now,
      visitType: mapAppointmentTypeToVisitType(createdAppointment.appointmentType),
      reasonType: createdAppointment.appointmentType,
      status: "CHECKED_IN",
      checkedInAt: now,
      chiefComplaint: payload.note,
      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  await tx.medicalQueue.create({
    data: {
      appointmentId: createdAppointment.appointmentId,
      visitId: createdVisit.visitId,

      queueDate,
      queueNumber,
      queueCode: generateQueueCode(queueDate, queueNumber),
      queueStatus: "WAITING_TRIAGE",
      priority: (payload.priority === "URGENT" || payload.priority === "EMERGENCY") ? payload.priority : "NORMAL",

      source: createdAppointment.source,
      reasonType: createdAppointment.appointmentType,
      ownerId: createdAppointment.ownerId,
      petId: createdAppointment.petId,
      veterinarianId: createdAppointment.vetId,

      checkedInAt: now,
      

      note: [
        "Auto-created from walk-in appointment",
        payload.priority ? `Priority: ${payload.priority}` : null,
        payload.queueType ? `Queue type: ${payload.queueType}` : null,
        payload.note ? `Note: ${payload.note}` : null,
      ]
        .filter(Boolean)
        .join(" | "),

      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });
}

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: isWalkIn ? "CREATE_WALK_IN_APPOINTMENT" : "CREATE_APPOINTMENT",
        entityName: "Appointment",
        entityId: createdAppointment.appointmentId,
        newValue: buildAppointmentAuditValue(createdAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    if (!isWalkIn) {
      await tx.jobQueue.create({
        data: {
          jobType: "APPOINTMENT_CREATED_NOTIFICATION",
          payload: {
            appointmentId: createdAppointment.appointmentId,
            appointmentNo: createdAppointment.appointmentNo,
            ownerId: createdAppointment.ownerId,
            petId: createdAppointment.petId,
            vetId: createdAppointment.vetId,
            appointmentDate: toJsonDate(createdAppointment.appointmentDate),
          },
          status: "PENDING",
          availableAt: new Date(),
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        },
      });

      await tx.jobQueue.create({
        data: {
          jobType: "APPOINTMENT_REMINDER",
          payload: {
            appointmentId: createdAppointment.appointmentId,
            appointmentNo: createdAppointment.appointmentNo,
            ownerId: createdAppointment.ownerId,
            petId: createdAppointment.petId,
            vetId: createdAppointment.vetId,
            appointmentDate: toJsonDate(createdAppointment.appointmentDate),
          },
          status: "PENDING",
          availableAt: getReminderAvailableAt(createdAppointment.appointmentDate),
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        },
      });
    }

    return createdAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  if (isWalkIn) {
    redirect("/medical-queue");
  }

  const calendarDate = toCalendarDateParam(appointment.startAt ?? appointment.appointmentDate);
  redirect(`/appointments/calendar?date=${calendarDate}&view=week`);
}

export async function updateAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "update");
  const payload = getAppointmentPayload(formData);

  if (!payload.appointmentId) throw new Error("Appointment ID is required.");

  const existingAppointment = await getExistingAppointment(payload.appointmentId);
  assertAppointmentCanBeChanged(existingAppointment.status);

  await assertOwnerExists(payload.ownerId);
  await assertPetBelongsToOwner(payload.petId, payload.ownerId);
  await assertVetIsActive(payload.vetId);

  if (shouldCheckSamePetAppointment()) {
    await assertNoOverlappingPetAppointment({
      petId: payload.petId,
      startAt: payload.startAt,
      endAt: payload.endAt,
      excludeAppointmentId: payload.appointmentId,
    });
  }

  if (shouldCheckSameVetAppointment()) {
    await assertNoOverlappingVetAppointment({
      vetId: payload.vetId,
      startAt: payload.startAt,
      endAt: payload.endAt,
      excludeAppointmentId: payload.appointmentId,
    });
  }

  const nextStatus = payload.status ?? existingAppointment.status;

  const appointment = await prisma.$transaction(async (tx) => {
    const updatedAppointment = await tx.appointment.update({
      where: { appointmentId: payload.appointmentId! },
      data: {
        ownerId: payload.ownerId,
        petId: payload.petId,
        vetId: payload.vetId,
        appointmentType: payload.appointmentType,
        appointmentDate: payload.startAt,
        startAt: payload.startAt,
        endAt: payload.endAt,
        durationMinutes: payload.durationMinutes,
        source: payload.source,
        status: nextStatus,
        note: payload.note,
        updatedByUserId: currentUser.userId,
        ...(existingAppointment.status !== nextStatus
          ? {
              statusHistories: {
                create: {
                  fromStatus: existingAppointment.status,
                  toStatus: nextStatus,
                  actionCode: "UPDATE_APPOINTMENT_STATUS",
                  reason: "Appointment status updated",
                  note: payload.note,
                  changedByUserId: currentUser.userId,
                  createdByUserId: currentUser.userId,
                  updatedByUserId: currentUser.userId,
                },
              },
            }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "UPDATE_APPOINTMENT",
        entityName: "Appointment",
        entityId: updatedAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(updatedAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return updatedAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  redirectAfterAppointmentAction(formData, appointment);
}

export async function cancelAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "cancel");
  const appointmentId = requiredString(formData.get("appointmentId"));
  const cancelReason = optionalString(formData.get("cancelReason"));

  if (!appointmentId) throw new Error("Appointment ID is required.");

  const existingAppointment = await getExistingAppointment(appointmentId);
  if (existingAppointment.status === "CANCELLED") throw new Error("Appointment is already cancelled.");
  if (existingAppointment.status === "COMPLETED") throw new Error("Completed appointment cannot be cancelled.");

  const appointment = await prisma.$transaction(async (tx) => {
    const cancelledAppointment = await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "CANCELLED",
        cancelReason,
        cancelledAt: new Date(),
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: existingAppointment.status,
            toStatus: "CANCELLED",
            actionCode: "CANCEL_APPOINTMENT",
            reason: cancelReason ?? "Appointment cancelled",
            note: cancelReason,
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CANCEL_APPOINTMENT",
        entityName: "Appointment",
        entityId: cancelledAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(cancelledAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return cancelledAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  redirectAfterAppointmentAction(formData, appointment);
}

export async function confirmAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "confirm");
  const appointmentId = requiredString(formData.get("appointmentId"));
  if (!appointmentId) throw new Error("Appointment ID is required.");

  const existingAppointment = await getExistingAppointment(appointmentId);
  if (existingAppointment.status !== "BOOKED") {
    throw new Error("Only booked appointments can be confirmed.");
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const confirmedAppointment = await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "CONFIRMED",
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: existingAppointment.status,
            toStatus: "CONFIRMED",
            actionCode: "CONFIRM_APPOINTMENT",
            reason: "Appointment confirmed",
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CONFIRM_APPOINTMENT",
        entityName: "Appointment",
        entityId: confirmedAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(confirmedAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return confirmedAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  redirectAfterAppointmentAction(formData, appointment);
}

export async function checkInAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "checkIn");
  const appointmentId = requiredString(formData.get("appointmentId"));
  if (!appointmentId) throw new Error("Appointment ID is required.");

  const existingAppointment = await getExistingAppointment(appointmentId);
  if (!["BOOKED", "CONFIRMED"].includes(existingAppointment.status)) {
    throw new Error("Only booked or confirmed appointments can be checked in.");
  }

  assertWithinCheckInWindow(existingAppointment);

  const appointment = await prisma.$transaction(async (tx) => {
    const checkedInAppointment = await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "ARRIVED",
        checkedInAt: new Date(),
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: existingAppointment.status,
            toStatus: "ARRIVED",
            actionCode: "CHECK_IN_APPOINTMENT",
            reason: "Medical appointment checked in and medical queue created",
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
      },
    });

  const existingQueue = await tx.medicalQueue.findFirst({
    where: {
      appointmentId,
      deletedAt: null,
    },
    select: {
      queueId: true,
    },
  });

if (existingQueue) {
  throw new Error("This appointment has already been checked in");
}

const queueDate = getDateRange(checkedInAppointment.appointmentDate).start;
const queueNumber = await getNextMedicalQueueNo(tx, checkedInAppointment.appointmentDate);
const now = new Date();

const existingVisit = await tx.visit.findFirst({
  where: {
    appointmentId,
    deletedAt: null,
  },
  select: { visitId: true },
});

const visit = existingVisit ?? await tx.visit.create({
  data: {
    visitNo: generateVisitNo(now),
    appointmentId,
    ownerId: checkedInAppointment.ownerId,
    petId: checkedInAppointment.petId,
    vetId: checkedInAppointment.vetId,
    visitDate: now,
    visitType: mapAppointmentTypeToVisitType(checkedInAppointment.appointmentType),
    reasonType: checkedInAppointment.appointmentType,
    status: "CHECKED_IN",
    checkedInAt: checkedInAppointment.checkedInAt ?? now,
    chiefComplaint: checkedInAppointment.note,
    createdByUserId: currentUser.userId,
    updatedByUserId: currentUser.userId,
  },
});

await tx.medicalQueue.create({
  data: {
    appointmentId,
    visitId: visit.visitId,

    queueDate,
    queueNumber,
    queueCode: generateQueueCode(queueDate, queueNumber),
    queueStatus: "WAITING_TRIAGE",

    source: checkedInAppointment.source,
    reasonType: checkedInAppointment.appointmentType,
    ownerId: checkedInAppointment.ownerId,
    petId: checkedInAppointment.petId,
    veterinarianId: checkedInAppointment.vetId,

    checkedInAt: checkedInAppointment.checkedInAt ?? now,
    note: "Created from appointment check-in",

    createdByUserId: currentUser.userId,
    updatedByUserId: currentUser.userId,
  },
});

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CHECK_IN_APPOINTMENT",
        entityName: "Appointment",
        entityId: checkedInAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(checkedInAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return checkedInAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  redirectAfterAppointmentAction(formData, appointment);
}

export async function startTreatmentAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "startTreatment");
  const appointmentId = requiredString(formData.get("appointmentId"));
  if (!appointmentId) throw new Error("Appointment ID is required.");

  const existingAppointment = await getExistingAppointment(appointmentId);
  if (existingAppointment.status !== "ARRIVED") {
    throw new Error("Only arrived appointments can be started.");
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const startedAppointment = await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "IN_PROGRESS",
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: existingAppointment.status,
            toStatus: "IN_PROGRESS",
            actionCode: "START_MEDICAL_SERVICE",
            reason: "Medical service started",
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "START_MEDICAL_SERVICE",
        entityName: "Appointment",
        entityId: startedAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(startedAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return startedAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  redirectAfterAppointmentAction(formData, appointment);
}

export async function completeAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "complete");
  const appointmentId = requiredString(formData.get("appointmentId"));
  if (!appointmentId) throw new Error("Appointment ID is required.");

  const existingAppointment = await getExistingAppointment(appointmentId);
  if (!["ARRIVED", "IN_PROGRESS"].includes(existingAppointment.status)) {
    throw new Error("Only arrived or in-progress appointments can be completed.");
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const completedAppointment = await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: existingAppointment.status,
            toStatus: "COMPLETED",
            actionCode: "COMPLETE_APPOINTMENT",
            reason: "Appointment completed",
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "COMPLETE_APPOINTMENT",
        entityName: "Appointment",
        entityId: completedAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(completedAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return completedAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  redirectAfterAppointmentAction(formData, appointment);
}

export async function markNoShowAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "noShow");
  const appointmentId = requiredString(formData.get("appointmentId"));
  if (!appointmentId) throw new Error("Appointment ID is required.");

  const existingAppointment = await getExistingAppointment(appointmentId);
  if (!["BOOKED", "CONFIRMED"].includes(existingAppointment.status)) {
    throw new Error("Only booked or confirmed appointments can be marked as no-show.");
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const noShowAppointment = await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "NO_SHOW",
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: existingAppointment.status,
            toStatus: "NO_SHOW",
            actionCode: "MARK_NO_SHOW_APPOINTMENT",
            reason: "Appointment marked as no-show",
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "MARK_NO_SHOW_APPOINTMENT",
        entityName: "Appointment",
        entityId: noShowAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(noShowAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return noShowAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  redirectAfterAppointmentAction(formData, appointment);
}

export async function deleteAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "delete");
  const appointmentId = requiredString(formData.get("appointmentId"));
  if (!appointmentId) throw new Error("Appointment ID is required.");

  const existingAppointment = await getExistingAppointment(appointmentId);
  if (existingAppointment.status !== "CANCELLED" && existingAppointment.status !== "NO_SHOW") {
    throw new Error("Only cancelled or no-show appointments can be archived.");
  }

  await prisma.$transaction(async (tx) => {
    const archivedAppointment = await tx.appointment.update({
      where: { appointmentId },
      data: { deletedAt: new Date(), updatedByUserId: currentUser.userId },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "ARCHIVE_APPOINTMENT",
        entityName: "Appointment",
        entityId: archivedAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(archivedAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidateAppointmentPaths(appointmentId);
  redirect("/appointments");
}

export async function rescheduleAppointment(formData: FormData) {
  const currentUser = await requirePermission("appointment", "reschedule");
  const appointmentId = requiredString(formData.get("appointmentId"));
  const appointmentDate = requiredDate(formData.get("appointmentDate"));
  const reason = optionalString(formData.get("reason")) ?? "Appointment rescheduled";
  const nextVetId = optionalString(formData.get("resourceId"));

  if (!appointmentId) throw new Error("Appointment ID is required.");
  if (appointmentDate.getTime() < Date.now() - 60_000) {
    throw new Error("New appointment date cannot be in the past.");
  }

  const existingAppointment = await getExistingAppointment(appointmentId);
  if (!["BOOKED", "CONFIRMED", "ARRIVED", "NO_SHOW", "CANCELLED"].includes(existingAppointment.status)) {
    throw new Error("Only booked, confirmed, checked-in, cancelled, or no-show appointments can be rescheduled.");
  }

  const vetId = nextVetId ?? existingAppointment.vetId;
  await assertVetIsActive(vetId);

  if (shouldCheckSamePetAppointment()) {
    await assertNoOverlappingPetAppointment({
      petId: existingAppointment.petId,
      startAt: appointmentDate,
      endAt: new Date(appointmentDate.getTime() + (existingAppointment.durationMinutes ?? 30) * 60_000),
      excludeAppointmentId: appointmentId,
    });
  }

  if (shouldCheckSameVetAppointment()) {
    await assertNoOverlappingVetAppointment({
      vetId,
      startAt: appointmentDate,
      endAt: new Date(appointmentDate.getTime() + (existingAppointment.durationMinutes ?? 30) * 60_000),
      excludeAppointmentId: appointmentId,
    });
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const rescheduledAppointment = await tx.appointment.update({
      where: { appointmentId },
      data: {
        appointmentDate,
        startAt: appointmentDate,
        endAt: new Date(appointmentDate.getTime() + (existingAppointment.durationMinutes ?? 30) * 60_000),
        vetId,
        status: "BOOKED",
        cancelReason: null,
        cancelledAt: null,
        checkedInAt: null,
        completedAt: null,
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: existingAppointment.status,
            toStatus: "BOOKED",
            actionCode: "RESCHEDULE_APPOINTMENT",
            reason,
            note: reason,
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "RESCHEDULE_APPOINTMENT",
        entityName: "Appointment",
        entityId: rescheduledAppointment.appointmentId,
        oldValue: buildAppointmentAuditValue(existingAppointment),
        newValue: buildAppointmentAuditValue(rescheduledAppointment),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.jobQueue.create({
      data: {
        jobType: "APPOINTMENT_REMINDER",
        payload: {
          appointmentId: rescheduledAppointment.appointmentId,
          appointmentNo: rescheduledAppointment.appointmentNo,
          ownerId: rescheduledAppointment.ownerId,
          petId: rescheduledAppointment.petId,
          vetId: rescheduledAppointment.vetId,
          appointmentDate: toJsonDate(rescheduledAppointment.appointmentDate),
          reason,
        },
        status: "PENDING",
        availableAt: getReminderAvailableAt(rescheduledAppointment.appointmentDate),
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return rescheduledAppointment;
  });

  revalidateAppointmentPaths(appointment.appointmentId);
  redirectAfterAppointmentAction(formData, appointment);
}

