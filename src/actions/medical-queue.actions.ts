"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { appointmentConfig } from "@/config/appointment.config";
import {
  generateQueueCode,
  generateVisitNo,
  mapAppointmentTypeToVisitType,
  minutesBetween,
  optionalString,
  requiredString,
  startOfDay,
  toJsonDate,
} from "@/lib/action-utils";
import {
  MedicalQueuePriority,
  MedicalQueueStatus,
  Prisma,
  type AppointmentSource,
  type AppointmentType,
} from "@/generated/prisma/client";

const FINAL_STATUSES: MedicalQueueStatus[] = ["COMPLETED", "NO_SHOW", "CANCELLED"];
const MEDICAL_PRIORITIES: MedicalQueuePriority[] = ["NORMAL", "URGENT", "EMERGENCY"];

function normalizePriority(value: FormDataEntryValue | null | undefined): MedicalQueuePriority {
  const priority = requiredString(value).toUpperCase();
  return MEDICAL_PRIORITIES.includes(priority as MedicalQueuePriority) ? (priority as MedicalQueuePriority) : MedicalQueuePriority.NORMAL;
}

function buildQueueAuditValue(queue: {
  queueId: string;
  queueDate: Date;
  queueNumber: number;
  queueCode: string;
  queueStatus: MedicalQueueStatus;
  priority?: MedicalQueuePriority | null;
  source: AppointmentSource;
  reasonType?: AppointmentType | null;
  appointmentId?: string | null;
  visitId?: string | null;
  ownerId: string;
  petId: string;
  veterinarianId?: string | null;
  checkedInAt?: Date | null;
  waitingAt?: Date | null;
  calledAt?: Date | null;
  inServiceAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  noShowAt?: Date | null;
  estimatedWaitMinutes?: number | null;
  actualWaitMinutes?: number | null;
  note?: string | null;
}): Prisma.InputJsonObject {
  return {
    queueId: queue.queueId,
    queueDate: toJsonDate(queue.queueDate),
    queueNumber: queue.queueNumber,
    queueCode: queue.queueCode,
    queueStatus: queue.queueStatus,
    priority: queue.priority ?? MedicalQueuePriority.NORMAL,
    source: queue.source,
    reasonType: queue.reasonType ?? null,
    appointmentId: queue.appointmentId ?? null,
    visitId: queue.visitId ?? null,
    ownerId: queue.ownerId,
    petId: queue.petId,
    veterinarianId: queue.veterinarianId ?? null,
    checkedInAt: toJsonDate(queue.checkedInAt),
    waitingAt: toJsonDate(queue.waitingAt),
    calledAt: toJsonDate(queue.calledAt),
    inServiceAt: toJsonDate(queue.inServiceAt),
    completedAt: toJsonDate(queue.completedAt),
    cancelledAt: toJsonDate(queue.cancelledAt),
    noShowAt: toJsonDate(queue.noShowAt),
    estimatedWaitMinutes: queue.estimatedWaitMinutes ?? null,
    actualWaitMinutes: queue.actualWaitMinutes ?? null,
    note: queue.note ?? null,
  };
}

function revalidateMedicalQueuePaths(appointmentId?: string | null, visitId?: string | null) {
  revalidatePath("/medical-queue");
  revalidatePath("/appointments");
  revalidatePath("/appointments/calendar");
  revalidatePath("/visits");
  if (appointmentId) revalidatePath(`/appointments/${appointmentId}`);
  if (visitId) {
    revalidatePath(`/visits/${visitId}`);
    revalidatePath(`/visits/${visitId}/soap`);
  }
}

async function getNextQueueNumber(tx: Prisma.TransactionClient, queueDate: Date) {
  const day = startOfDay(queueDate);
  // Use raw SQL with FOR UPDATE to serialize concurrent queue number allocation.
  // This prevents duplicate queue numbers when multiple check-ins occur simultaneously.
  const rows = await tx.$queryRaw<{ max_num: number | null }[]>`
    SELECT MAX("queueNumber") AS max_num
    FROM "MedicalQueue"
    WHERE "queueDate" = ${day}
      AND "deletedAt" IS NULL
    FOR UPDATE
  `;
  return (rows[0]?.max_num ?? 0) + 1;
}

async function getActiveQueue(queueId: string) {
  const queue = await prisma.medicalQueue.findFirst({ where: { queueId, deletedAt: null } });
  if (!queue) throw new Error("Medical queue not found.");
  return queue;
}

function assertNotFinal(status: MedicalQueueStatus) {
  if (FINAL_STATUSES.includes(status)) throw new Error("Final medical queue cannot be changed.");
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

export async function getTodayMedicalQueues() {
  await requirePermission("queue", "view");
  const today = new Date();
  const priorityWeight: Record<MedicalQueuePriority, number> = { EMERGENCY: 1, URGENT: 2, NORMAL: 3 };
  const statusWeight: Record<MedicalQueueStatus, number> = {
    TRIAGE_IN_PROGRESS: 1,
    WAITING_TRIAGE: 2,
    WAITING_VET: 3,
    IN_SERVICE: 4,
    COMPLETED: 5,
    NO_SHOW: 6,
    CANCELLED: 7,
  };
  const queues = await prisma.medicalQueue.findMany({
    where: { queueDate: startOfDay(today), deletedAt: null },
    orderBy: [{ queueNumber: "asc" }],
    include: {
      owner: true,
      pet: { include: { species: true, breed: true } },
      veterinarian: true,
      visit: { include: { soapNote: true, diagnoses: { where: { deletedAt: null } } } },
      appointment: { include: { visit: { include: { soapNote: true, diagnoses: { where: { deletedAt: null } } } } } },
    },
  });

  return queues.sort((a, b) => {
    const byStatus = statusWeight[a.queueStatus] - statusWeight[b.queueStatus];
    const byPriority = priorityWeight[a.priority] - priorityWeight[b.priority];
    return byStatus || byPriority || a.queueNumber - b.queueNumber;
  });
}

export async function checkInAppointmentToMedicalQueue(formData: FormData) {
  const currentUser = await requirePermission("appointment", "checkIn");
  const appointmentId = requiredString(formData.get("appointmentId"));
  if (!appointmentId) throw new Error("Appointment ID is required.");

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: { appointmentId, deletedAt: null },
      include: { medicalQueue: true, visit: true },
    });
    if (!appointment) throw new Error("Appointment not found.");
    if (appointment.source !== "ADVANCE_BOOKING") throw new Error("Walk-in must use the walk-in registration flow.");
    if (!["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(appointment.status)) {
      throw new Error("Only booked, confirmed, arrived, or in-progress appointment can be checked in.");
    }

    assertWithinCheckInWindow(appointment);

    const existingVisit = appointment.visit?.deletedAt ? null : appointment.visit;
    const visit = existingVisit ?? await tx.visit.create({
      data: {
        visitNo: generateVisitNo(now),
        appointmentId: appointment.appointmentId,
        ownerId: appointment.ownerId,
        petId: appointment.petId,
        vetId: appointment.vetId,
        visitDate: now,
        visitType: mapAppointmentTypeToVisitType(appointment.appointmentType),
        reasonType: appointment.appointmentType,
        status: "CHECKED_IN",
        checkedInAt: appointment.checkedInAt ?? now,
        chiefComplaint: optionalString(formData.get("note")) ?? appointment.note,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    if (appointment.medicalQueue && !appointment.medicalQueue.deletedAt) {
      const linkedQueue = await tx.medicalQueue.update({
        where: { queueId: appointment.medicalQueue.queueId },
        data: {
          visitId: appointment.medicalQueue.visitId ?? visit.visitId,
          reasonType: appointment.medicalQueue.reasonType ?? appointment.appointmentType,
          queueStatus: appointment.medicalQueue.queueStatus === "IN_SERVICE" ? "IN_SERVICE" : "WAITING_TRIAGE",
          checkedInAt: appointment.medicalQueue.checkedInAt ?? now,
          updatedByUserId: currentUser.userId,
        },
      });
      return { queue: linkedQueue, visitId: visit.visitId };
    }

    const queueDate = startOfDay(now);
    const queueNumber = await getNextQueueNumber(tx, queueDate);
    const createdQueue = await tx.medicalQueue.create({
      data: {
        queueDate,
        queueNumber,
        queueCode: generateQueueCode(queueDate, queueNumber),
        queueStatus: "WAITING_TRIAGE",
        priority: normalizePriority(formData.get("priority")),
        source: appointment.source,
        reasonType: appointment.appointmentType,
        appointmentId: appointment.appointmentId,
        visitId: visit.visitId,
        ownerId: appointment.ownerId,
        petId: appointment.petId,
        veterinarianId: appointment.vetId,
        checkedInAt: appointment.checkedInAt ?? now,
        note: optionalString(formData.get("note")) ?? "Created from appointment check-in",
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "ARRIVED",
        checkedInAt: appointment.checkedInAt ?? now,
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: appointment.status,
            toStatus: "ARRIVED",
            actionCode: "CHECK_IN_TO_MEDICAL_QUEUE",
            reason: "Appointment checked in to medical queue and waiting triage",
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
        action: "CHECK_IN_TO_MEDICAL_QUEUE",
        entityName: "MedicalQueue",
        entityId: createdQueue.queueId,
        newValue: buildQueueAuditValue(createdQueue),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.jobQueue.create({ data: { jobType: "MEDICAL_QUEUE_CHECKED_IN", payload: { queueId: createdQueue.queueId, appointmentId, visitId: visit.visitId }, status: "PENDING", availableAt: now, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    return { queue: createdQueue, visitId: visit.visitId };
  });

  revalidateMedicalQueuePaths(result.queue.appointmentId, result.visitId);
  redirect("/medical-queue");
}

export async function createWalkInMedicalQueue(formData: FormData) {
  const currentUser = await requirePermission("appointment", "create");
  const ownerId = requiredString(formData.get("ownerId"));
  const petId = requiredString(formData.get("petId"));
  const vetId = optionalString(formData.get("vetId"));
  const appointmentType = (requiredString(formData.get("appointmentType")) || "CHECKUP") as AppointmentType;
  if (!ownerId) throw new Error("Owner is required.");
  if (!petId) throw new Error("Pet is required.");

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const queueDate = startOfDay(now);
    const queueNumber = await getNextQueueNumber(tx, queueDate);
    const note = optionalString(formData.get("note"));
    const visit = await tx.visit.create({
      data: {
        visitNo: generateVisitNo(now),
        appointmentId: null,
        ownerId,
        petId,
        vetId,
        visitDate: now,
        visitType: mapAppointmentTypeToVisitType(appointmentType),
        reasonType: appointmentType,
        status: "CHECKED_IN",
        checkedInAt: now,
        chiefComplaint: note,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    const queue = await tx.medicalQueue.create({
      data: {
        queueDate,
        queueNumber,
        queueCode: generateQueueCode(queueDate, queueNumber),
        queueStatus: "WAITING_TRIAGE",
        priority: normalizePriority(formData.get("priority")),
        source: "WALK_IN",
        reasonType: appointmentType,
        appointmentId: null,
        visitId: visit.visitId,
        ownerId,
        petId,
        veterinarianId: vetId,
        checkedInAt: now,
        note: ["Created from native walk-in registration", note].filter(Boolean).join(" | "),
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({ data: { userId: currentUser.userId, action: "CREATE_WALK_IN_MEDICAL_QUEUE", entityName: "MedicalQueue", entityId: queue.queueId, newValue: buildQueueAuditValue(queue), ipAddress: null, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    await tx.jobQueue.create({ data: { jobType: "WALK_IN_MEDICAL_QUEUE_CREATED", payload: { queueId: queue.queueId, visitId: visit.visitId, ownerId, petId }, status: "PENDING", availableAt: now, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    return { queue, visit };
  });

  revalidateMedicalQueuePaths(null, result.visit.visitId);
  redirect("/medical-queue");
}

export async function startMedicalQueueTriage(formData: FormData) {
  const currentUser = await requirePermission("visit", "update");
  const queueId = requiredString(formData.get("queueId"));
  if (!queueId) throw new Error("Queue ID is required.");
  const existingQueue = await getActiveQueue(queueId);
  assertNotFinal(existingQueue.queueStatus);
  if (existingQueue.queueStatus !== "WAITING_TRIAGE") throw new Error("Only waiting-triage queue can start intake.");
  const now = new Date();

  const queue = await prisma.$transaction(async (tx) => {
    let visitId = existingQueue.visitId;

    if (!visitId) {
      const appointment = existingQueue.appointmentId
        ? await tx.appointment.findFirst({ where: { appointmentId: existingQueue.appointmentId, deletedAt: null } })
        : null;
      const existingVisit = existingQueue.appointmentId
        ? await tx.visit.findFirst({ where: { appointmentId: existingQueue.appointmentId, deletedAt: null }, select: { visitId: true } })
        : null;

      const visit = existingVisit ?? await tx.visit.create({
        data: {
          visitNo: generateVisitNo(now),
          appointmentId: existingQueue.appointmentId,
          ownerId: existingQueue.ownerId,
          petId: existingQueue.petId,
          vetId: existingQueue.veterinarianId,
          visitDate: now,
          visitType: appointment ? mapAppointmentTypeToVisitType(appointment.appointmentType) : mapAppointmentTypeToVisitType(existingQueue.reasonType ?? "CHECKUP"),
          reasonType: appointment?.appointmentType ?? existingQueue.reasonType ?? null,
          status: "CHECKED_IN",
          checkedInAt: existingQueue.checkedInAt ?? now,
          chiefComplaint: appointment?.note ?? existingQueue.note,
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        },
      });
      visitId = visit.visitId;
    }

    const updatedQueue = await tx.medicalQueue.update({
      where: { queueId },
      data: {
        visitId,
        queueStatus: "TRIAGE_IN_PROGRESS",
        calledAt: existingQueue.calledAt ?? now,
        updatedByUserId: currentUser.userId,
      },
    });
    await tx.auditLog.create({ data: { userId: currentUser.userId, action: "START_MEDICAL_QUEUE_TRIAGE", entityName: "MedicalQueue", entityId: queueId, oldValue: buildQueueAuditValue(existingQueue), newValue: buildQueueAuditValue(updatedQueue), ipAddress: null, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    return updatedQueue;
  });
  revalidateMedicalQueuePaths(queue.appointmentId, queue.visitId);
  redirect(`/visits/${queue.visitId}?focus=intake`);
}

export async function startMedicalQueueService(formData: FormData) {
  const currentUser = await requirePermission("queue", "update");
  const queueId = requiredString(formData.get("queueId"));
  if (!queueId) throw new Error("Queue ID is required.");
  const existingQueue = await getActiveQueue(queueId);
  assertNotFinal(existingQueue.queueStatus);
  if (existingQueue.queueStatus !== "WAITING_VET") throw new Error("Only waiting-vet queue can start service.");
  if (!existingQueue.visitId) throw new Error("Visit must exist before starting service.");
  const now = new Date();
  const visitId = existingQueue.visitId;

  const queue = await prisma.$transaction(async (tx) => {
    const updatedQueue = await tx.medicalQueue.update({
      where: { queueId },
      data: {
        queueStatus: "IN_SERVICE",
        inServiceAt: existingQueue.inServiceAt ?? now,
        calledAt: existingQueue.calledAt ?? now,
        actualWaitMinutes: existingQueue.actualWaitMinutes ?? minutesBetween(existingQueue.waitingAt ?? existingQueue.checkedInAt, now),
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.visit.update({ where: { visitId }, data: { status: "IN_PROGRESS", updatedByUserId: currentUser.userId } });

    if (updatedQueue.appointmentId) {
      await tx.appointment.update({ where: { appointmentId: updatedQueue.appointmentId }, data: { status: "IN_PROGRESS", updatedByUserId: currentUser.userId, statusHistories: { create: { fromStatus: null, toStatus: "IN_PROGRESS", actionCode: "START_MEDICAL_QUEUE_SERVICE", reason: "Medical queue service started", changedByUserId: currentUser.userId, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } } } });
    }

    await tx.auditLog.create({ data: { userId: currentUser.userId, action: "START_MEDICAL_QUEUE_SERVICE", entityName: "MedicalQueue", entityId: queueId, oldValue: buildQueueAuditValue(existingQueue), newValue: buildQueueAuditValue(updatedQueue), ipAddress: null, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    return updatedQueue;
  });
  revalidateMedicalQueuePaths(queue.appointmentId, queue.visitId);
}

export async function startVisitFromMedicalQueue(formData: FormData) {
  const queueId = requiredString(formData.get("queueId"));
  if (!queueId) throw new Error("Queue ID is required.");
  const queue = await getActiveQueue(queueId);
  if (!queue.visitId) throw new Error("Visit must already exist from check-in or walk-in registration.");
  redirect(`/visits/${queue.visitId}?focus=intake`);
}

export async function completeMedicalQueue(formData: FormData) {
  const currentUser = await requirePermission("queue", "complete");
  const queueId = requiredString(formData.get("queueId"));
  const existingQueue = await getActiveQueue(queueId);

  if (existingQueue.queueStatus !== "IN_SERVICE") throw new Error("Only in-service queue can be completed.");
  if (!existingQueue.visitId) throw new Error("Visit must exist before completing the medical queue.");

  const now = new Date();
  const queue = await prisma.$transaction(async (tx) => {
    const queueWithVisit = await tx.medicalQueue.findFirst({
      where: { queueId, deletedAt: null },
      include: { visit: { include: { soapNote: true, diagnoses: { where: { deletedAt: null } } } }, appointment: true },
    });
    if (!queueWithVisit?.visit) throw new Error("Visit must be created before completing the medical queue.");
    const visit = queueWithVisit.visit;
    if (visit.soapNote?.status !== "FINALIZED") throw new Error("SOAP must be finalized before completing the medical queue.");
    if (visit.diagnoses.length <= 0) throw new Error("At least one diagnosis is required before completing the medical queue.");

    const updatedVisit = await tx.visit.update({ where: { visitId: visit.visitId }, data: { status: "COMPLETED", completedAt: visit.completedAt ?? now, updatedByUserId: currentUser.userId } });
    const updatedQueue = await tx.medicalQueue.update({ where: { queueId }, data: { queueStatus: "COMPLETED", completedAt: now, actualWaitMinutes: queueWithVisit.actualWaitMinutes ?? minutesBetween(queueWithVisit.waitingAt ?? queueWithVisit.checkedInAt, queueWithVisit.inServiceAt ?? now), updatedByUserId: currentUser.userId } });

    if (updatedQueue.appointmentId) {
      await tx.appointment.update({ where: { appointmentId: updatedQueue.appointmentId }, data: { status: "COMPLETED", completedAt: now, updatedByUserId: currentUser.userId, statusHistories: { create: { fromStatus: queueWithVisit.appointment?.status ?? null, toStatus: "COMPLETED", actionCode: "COMPLETE_MEDICAL_QUEUE", reason: "Medical queue completed after finalized SOAP", changedByUserId: currentUser.userId, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } } } });
    }

    await tx.auditLog.create({ data: { userId: currentUser.userId, action: "COMPLETE_MEDICAL_QUEUE", entityName: "MedicalQueue", entityId: queueId, oldValue: buildQueueAuditValue(existingQueue), newValue: { ...buildQueueAuditValue(updatedQueue), visitStatus: updatedVisit.status }, ipAddress: null, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    await tx.jobQueue.create({ data: { jobType: "MEDICAL_QUEUE_COMPLETED", payload: { queueId, appointmentId: updatedQueue.appointmentId, visitId: updatedVisit.visitId, completedAt: toJsonDate(now) }, status: "PENDING", availableAt: now, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    return updatedQueue;
  });

  revalidateMedicalQueuePaths(queue.appointmentId, queue.visitId);
}

export async function markMedicalQueueNoShow(formData: FormData) {
  const currentUser = await requirePermission("appointment", "noShow");
  const queueId = requiredString(formData.get("queueId"));
  const existingQueue = await getActiveQueue(queueId);
  assertNotFinal(existingQueue.queueStatus);
  const now = new Date();
  const queue = await prisma.$transaction(async (tx) => {
    const updatedQueue = await tx.medicalQueue.update({ where: { queueId }, data: { queueStatus: "NO_SHOW", noShowAt: now, note: optionalString(formData.get("note")) ?? existingQueue.note, updatedByUserId: currentUser.userId } });
    if (updatedQueue.appointmentId) await tx.appointment.update({ where: { appointmentId: updatedQueue.appointmentId }, data: { status: "NO_SHOW", updatedByUserId: currentUser.userId } });
    if (updatedQueue.visitId) await tx.visit.update({ where: { visitId: updatedQueue.visitId }, data: { status: "CANCELLED", updatedByUserId: currentUser.userId } });
    await tx.auditLog.create({ data: { userId: currentUser.userId, action: "MARK_MEDICAL_QUEUE_NO_SHOW", entityName: "MedicalQueue", entityId: queueId, oldValue: buildQueueAuditValue(existingQueue), newValue: buildQueueAuditValue(updatedQueue), ipAddress: null, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    return updatedQueue;
  });
  revalidateMedicalQueuePaths(queue.appointmentId, queue.visitId);
}

export async function cancelMedicalQueue(formData: FormData) {
  const currentUser = await requirePermission("queue", "cancel");
  const queueId = requiredString(formData.get("queueId"));
  const existingQueue = await getActiveQueue(queueId);
  assertNotFinal(existingQueue.queueStatus);
  const now = new Date();
  const queue = await prisma.$transaction(async (tx) => {
    const updatedQueue = await tx.medicalQueue.update({ where: { queueId }, data: { queueStatus: "CANCELLED", cancelledAt: now, note: optionalString(formData.get("note")) ?? existingQueue.note, updatedByUserId: currentUser.userId } });
    if (updatedQueue.appointmentId) await tx.appointment.update({ where: { appointmentId: updatedQueue.appointmentId }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: optionalString(formData.get("note")) ?? "Cancelled from medical queue", updatedByUserId: currentUser.userId } });
    if (updatedQueue.visitId) await tx.visit.update({ where: { visitId: updatedQueue.visitId }, data: { status: "CANCELLED", updatedByUserId: currentUser.userId } });
    await tx.auditLog.create({ data: { userId: currentUser.userId, action: "CANCEL_MEDICAL_QUEUE", entityName: "MedicalQueue", entityId: queueId, oldValue: buildQueueAuditValue(existingQueue), newValue: buildQueueAuditValue(updatedQueue), ipAddress: null, createdByUserId: currentUser.userId, updatedByUserId: currentUser.userId } });
    return updatedQueue;
  });
  revalidateMedicalQueuePaths(queue.appointmentId, queue.visitId);
}
