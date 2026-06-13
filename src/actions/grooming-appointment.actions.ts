"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import {
  requiredString,
  optionalString,
  generateAppointmentNo,
  toCalendarDateParam,
  startOfDay,
} from "@/lib/action-utils";
import { Prisma } from "@/generated/prisma/client";

const BOOKABLE_STATUSES = ["BOOKED", "CONFIRMED"] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function assertNoGroomerConflict(
  tx: Prisma.TransactionClient,
  groomerId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string,
) {
  const conflict = await tx.appointment.findFirst({
    where: {
      vetId: groomerId,
      appointmentType: "GROOMING",
      deletedAt: null,
      status: { in: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId ? { appointmentId: { not: excludeId } } : {}),
    },
    select: { appointmentId: true },
  });
  if (conflict) throw new Error("ช่างแต่งขนมีนัดหมายซ้อนกันในช่วงเวลานี้แล้ว");
}

async function getNextGroomingQueueNo(tx: Prisma.TransactionClient, queueDate: Date) {
  const rows = await tx.$queryRaw<{ max_num: number | null }[]>`
    SELECT MAX("queueNumber") AS max_num
    FROM "GroomingQueue"
    WHERE "queueDate" = ${queueDate}
    FOR UPDATE
  `;
  return (rows[0]?.max_num ?? 0) + 1;
}

// ── Create Grooming Appointment ─────────────────────────────────────────────

export async function createGroomingAppointment(formData: FormData) {
  const currentUser = await requirePermission("groomer", "create");

  const ownerId = requiredString(formData.get("ownerId"));
  const petId = requiredString(formData.get("petId"));
  const groomerId = optionalString(formData.get("groomerId"));
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);
  const startAtRaw = requiredString(formData.get("startAt"));
  const endAtRaw = requiredString(formData.get("endAt"));
  const notes = optionalString(formData.get("notes"));

  if (!ownerId) throw new Error("กรุณาเลือกเจ้าของ");
  if (!petId) throw new Error("กรุณาเลือกสัตว์เลี้ยง");

  const startAt = new Date(startAtRaw);
  const endAt = new Date(endAtRaw);

  if (isNaN(startAt.getTime())) throw new Error("วันเวลาเริ่มต้นไม่ถูกต้อง");
  if (isNaN(endAt.getTime())) throw new Error("วันเวลาสิ้นสุดไม่ถูกต้อง");
  if (endAt <= startAt) throw new Error("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น");

  const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);

  const result = await prisma.$transaction(async (tx) => {
    const pet = await tx.pet.findFirst({
      where: { petId, ownerId, deletedAt: null },
      select: { petId: true },
    });
    if (!pet) throw new Error("ไม่พบสัตว์เลี้ยงหรือสัตว์เลี้ยงไม่ใช่ของเจ้าของที่เลือก");

    if (groomerId) {
      const groomer = await tx.user.findFirst({
        where: { userId: groomerId, role: "GROOMER", status: "ACTIVE" },
        select: { userId: true },
      });
      if (!groomer) throw new Error("ไม่พบช่างแต่งขนหรือช่างแต่งขนไม่ได้ใช้งาน");
      await assertNoGroomerConflict(tx, groomerId, startAt, endAt);
    }

    const validServices =
      serviceIds.length > 0
        ? await tx.groomingService.findMany({
            where: { groomingServiceId: { in: serviceIds }, isActive: true },
            select: { groomingServiceId: true },
          })
        : [];

    const appointment = await tx.appointment.create({
      data: {
        appointmentNo: generateAppointmentNo(startAt),
        ownerId,
        petId,
        vetId: groomerId ?? null,
        appointmentType: "GROOMING",
        appointmentDate: startAt,
        startAt,
        endAt,
        durationMinutes,
        source: "ADVANCE_BOOKING",
        status: "BOOKED",
        note: notes,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
        statusHistories: {
          create: {
            fromStatus: null,
            toStatus: "BOOKED",
            actionCode: "CREATE_GROOMING_APPOINTMENT",
            changedByUserId: currentUser.userId,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          },
        },
        groomingServices:
          validServices.length > 0
            ? { create: validServices.map((s) => ({ serviceId: s.groomingServiceId })) }
            : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_GROOMING_APPOINTMENT",
        entityName: "Appointment",
        entityId: appointment.appointmentId,
        newValue: {
          appointmentNo: appointment.appointmentNo,
          ownerId,
          petId,
          groomerId,
          startAt: startAt.toISOString(),
          serviceIds,
        },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return appointment;
  });

  revalidatePath("/grooming/appointments");
  redirect(`/grooming/appointments?date=${toCalendarDateParam(startAt)}`);
}

// ── Check-in → Create GroomingQueue ────────────────────────────────────────

export async function checkInGroomingAppointment(appointmentId: string) {
  const currentUser = await requirePermission("groomer", "create");

  const queue = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { appointmentId },
      include: {
        groomingServices: {
          include: { service: { select: { groomingServiceId: true, price: true } } },
        },
      },
    });

    if (!appointment) throw new Error("ไม่พบนัดหมาย");
    if (appointment.appointmentType !== "GROOMING")
      throw new Error("นัดหมายนี้ไม่ใช่นัดอาบน้ำตัดขน");
    if (!(BOOKABLE_STATUSES as readonly string[]).includes(appointment.status))
      throw new Error("เช็คอินได้เฉพาะนัดหมายที่มีสถานะ BOOKED หรือ CONFIRMED เท่านั้น");

    const existing = await tx.groomingQueue.findUnique({ where: { appointmentId } });
    if (existing) throw new Error("มีคิวอาบน้ำตัดขนสำหรับนัดหมายนี้แล้ว");

    const now = new Date();
    const queueDate = startOfDay(now);
    const queueNumber = await getNextGroomingQueueNo(tx, queueDate);

    const newQueue = await tx.groomingQueue.create({
      data: {
        queueNumber,
        queueDate,
        source: "APPOINTMENT",
        status: "WAITING",
        ownerId: appointment.ownerId,
        petId: appointment.petId,
        groomerId: appointment.vetId,
        appointmentId,
        notes: appointment.note,
        checkedInAt: now,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
        items: {
          create: appointment.groomingServices.map((s) => ({
            serviceId: s.serviceId,
            priceSnapshot: s.service.price,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          })),
        },
      },
    });

    await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "ARRIVED",
        checkedInAt: now,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CHECK_IN_GROOMING_APPOINTMENT",
        entityName: "GroomingQueue",
        entityId: newQueue.groomingQueueId,
        newValue: { appointmentId, queueNumber, groomingQueueId: newQueue.groomingQueueId },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return newQueue;
  });

  revalidatePath("/grooming/appointments");
  revalidatePath("/grooming");
  redirect(`/grooming/${queue.groomingQueueId}`);
}

// ── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelGroomingAppointment(appointmentId: string, formData: FormData) {
  const currentUser = await requirePermission("groomer", "cancel");
  const cancelReason = optionalString(formData.get("cancelReason"));

  const appointment = await prisma.appointment.findUnique({
    where: { appointmentId },
    select: { status: true, appointmentType: true },
  });

  if (!appointment) throw new Error("ไม่พบนัดหมาย");
  if (appointment.appointmentType !== "GROOMING") throw new Error("ไม่ใช่นัดอาบน้ำตัดขน");
  if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status))
    throw new Error("ไม่สามารถยกเลิกนัดหมายที่จบแล้วได้");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { appointmentId },
      data: {
        status: "CANCELLED",
        cancelReason,
        cancelledAt: now,
        updatedByUserId: currentUser.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CANCEL_GROOMING_APPOINTMENT",
        entityName: "Appointment",
        entityId: appointmentId,
        oldValue: { status: appointment.status },
        newValue: { status: "CANCELLED", cancelReason },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/grooming/appointments");
}

// ── Query ────────────────────────────────────────────────────────────────────

export async function getGroomingAppointmentsByDateRange(start: Date, end: Date) {
  await requirePermission("groomer", "view");

  return prisma.appointment.findMany({
    where: {
      appointmentType: "GROOMING",
      deletedAt: null,
      startAt: { gte: start, lt: end },
    },
    orderBy: { startAt: "asc" },
    select: {
      appointmentId: true,
      appointmentNo: true,
      status: true,
      startAt: true,
      endAt: true,
      durationMinutes: true,
      note: true,
      cancelReason: true,
      checkedInAt: true,
      owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
      pet: { select: { petId: true, petName: true, species: { select: { speciesName: true } } } },
      vet: { select: { userId: true, fullName: true } },
      groomingQueue: { select: { groomingQueueId: true, queueNumber: true, status: true } },
      groomingServices: {
        select: {
          serviceId: true,
          service: { select: { serviceName: true, price: true } },
        },
      },
    },
  });
}
