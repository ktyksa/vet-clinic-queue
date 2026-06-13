"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { requiredString, optionalString, startOfDay } from "@/lib/action-utils";
import { Prisma, type GroomingQueueStatus } from "@/generated/prisma/client";

const FINAL_STATUSES: GroomingQueueStatus[] = ["COMPLETED", "BILLED", "CANCELLED", "NO_SHOW"];

async function getNextGroomingQueueNumber(
  tx: Prisma.TransactionClient,
  queueDate: Date,
): Promise<number> {
  const rows = await tx.$queryRaw<{ max_num: number | null }[]>`
    SELECT MAX("queueNumber") AS max_num
    FROM "GroomingQueue"
    WHERE "queueDate" = ${queueDate}
    FOR UPDATE
  `;
  return (rows[0]?.max_num ?? 0) + 1;
}

export async function createWalkInGrooming(formData: FormData) {
  const currentUser = await requirePermission("groomer", "create");

  const petId = requiredString(formData.get("petId"));
  const ownerId = requiredString(formData.get("ownerId"));
  const groomerId = optionalString(formData.get("groomerId"));
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);
  const specialRequests = optionalString(formData.get("specialRequests"));
  const notes = optionalString(formData.get("notes"));

  if (!petId) throw new Error("กรุณาเลือกสัตว์เลี้ยง");
  if (!ownerId) throw new Error("กรุณาเลือกเจ้าของ");
  if (serviceIds.length === 0) throw new Error("กรุณาเลือกบริการอย่างน้อย 1 รายการ");

  const now = new Date();
  const queueDate = startOfDay(now);

  const result = await prisma.$transaction(async (tx) => {
    const queueNumber = await getNextGroomingQueueNumber(tx, queueDate);

    const services = await tx.groomingService.findMany({
      where: { groomingServiceId: { in: serviceIds }, isActive: true },
    });
    if (services.length === 0) throw new Error("ไม่พบบริการที่เลือก");

    const queue = await tx.groomingQueue.create({
      data: {
        queueNumber,
        queueDate,
        source: "WALK_IN",
        status: "WAITING",
        ownerId,
        petId,
        groomerId: groomerId ?? null,
        specialRequests,
        notes,
        checkedInAt: now,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
        items: {
          create: services.map((s) => ({
            serviceId: s.groomingServiceId,
            priceSnapshot: s.price,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_GROOMING_WALK_IN",
        entityName: "GroomingQueue",
        entityId: queue.groomingQueueId,
        newValue: { queueNumber, source: "WALK_IN", petId, ownerId, serviceIds },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return queue;
  });

  redirect(`/grooming/${result.groomingQueueId}`);
}

export async function createAppointmentGrooming(formData: FormData) {
  const currentUser = await requirePermission("groomer", "create");

  const appointmentId = requiredString(formData.get("appointmentId"));
  const petId = requiredString(formData.get("petId"));
  const ownerId = requiredString(formData.get("ownerId"));
  const groomerId = optionalString(formData.get("groomerId"));
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);
  const specialRequests = optionalString(formData.get("specialRequests"));
  const notes = optionalString(formData.get("notes"));

  if (!appointmentId) throw new Error("กรุณาระบุนัดหมาย");
  if (!petId) throw new Error("กรุณาเลือกสัตว์เลี้ยง");
  if (!ownerId) throw new Error("กรุณาเลือกเจ้าของ");

  const now = new Date();
  const queueDate = startOfDay(now);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.groomingQueue.findUnique({ where: { appointmentId } });
    if (existing) throw new Error("นัดหมายนี้มีในคิวอาบน้ำตัดขนแล้ว");

    const queueNumber = await getNextGroomingQueueNumber(tx, queueDate);

    const services =
      serviceIds.length > 0
        ? await tx.groomingService.findMany({
            where: { groomingServiceId: { in: serviceIds }, isActive: true },
          })
        : [];

    const queue = await tx.groomingQueue.create({
      data: {
        queueNumber,
        queueDate,
        source: "APPOINTMENT",
        status: "WAITING",
        ownerId,
        petId,
        appointmentId,
        groomerId: groomerId ?? null,
        specialRequests,
        notes,
        checkedInAt: now,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
        items: {
          create: services.map((s) => ({
            serviceId: s.groomingServiceId,
            priceSnapshot: s.price,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_GROOMING_APPOINTMENT",
        entityName: "GroomingQueue",
        entityId: queue.groomingQueueId,
        newValue: { queueNumber, source: "APPOINTMENT", appointmentId, petId, ownerId },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return queue;
  });

  revalidatePath("/grooming");
  redirect(`/grooming/${result.groomingQueueId}`);
}

export async function startGroomingService(groomingQueueId: string) {
  const currentUser = await requirePermission("groomer", "update");

  const queue = await prisma.groomingQueue.findUnique({
    where: { groomingQueueId },
    select: { status: true },
  });
  if (!queue) throw new Error("ไม่พบคิวอาบน้ำตัดขน");
  if (queue.status !== "WAITING") throw new Error("เริ่มบริการได้เฉพาะคิวที่รอบริการเท่านั้น");

  await prisma.$transaction(async (tx) => {
    await tx.groomingQueue.update({
      where: { groomingQueueId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        updatedByUserId: currentUser.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "START_GROOMING",
        entityName: "GroomingQueue",
        entityId: groomingQueueId,
        oldValue: { status: "WAITING" },
        newValue: { status: "IN_PROGRESS" },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/grooming");
  revalidatePath(`/grooming/${groomingQueueId}`);
}

export async function completeGroomingService(groomingQueueId: string) {
  const currentUser = await requirePermission("groomer", "complete");

  const queue = await prisma.groomingQueue.findUnique({
    where: { groomingQueueId },
    select: { status: true },
  });
  if (!queue) throw new Error("ไม่พบคิวอาบน้ำตัดขน");
  if (queue.status !== "IN_PROGRESS") throw new Error("เสร็จสิ้นบริการได้เฉพาะคิวที่กำลังบริการเท่านั้น");

  await prisma.$transaction(async (tx) => {
    await tx.groomingQueue.update({
      where: { groomingQueueId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        updatedByUserId: currentUser.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "COMPLETE_GROOMING",
        entityName: "GroomingQueue",
        entityId: groomingQueueId,
        oldValue: { status: "IN_PROGRESS" },
        newValue: { status: "COMPLETED" },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/grooming");
  revalidatePath(`/grooming/${groomingQueueId}`);
}

export async function cancelGroomingQueue(formData: FormData) {
  const currentUser = await requirePermission("groomer", "cancel");

  const groomingQueueId = requiredString(formData.get("groomingQueueId"));
  const cancelReason = optionalString(formData.get("cancelReason"));

  const queue = await prisma.groomingQueue.findUnique({
    where: { groomingQueueId },
    select: { status: true },
  });
  if (!queue) throw new Error("ไม่พบคิวอาบน้ำตัดขน");
  if (FINAL_STATUSES.includes(queue.status)) {
    throw new Error(`ไม่สามารถยกเลิกคิวที่มีสถานะ ${queue.status} ได้`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.groomingQueue.update({
      where: { groomingQueueId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason,
        updatedByUserId: currentUser.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CANCEL_GROOMING",
        entityName: "GroomingQueue",
        entityId: groomingQueueId,
        oldValue: { status: queue.status },
        newValue: { status: "CANCELLED", cancelReason },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/grooming");
  revalidatePath(`/grooming/${groomingQueueId}`);
}

export async function getTodayGroomingQueues() {
  await requirePermission("groomer", "view");
  const today = startOfDay(new Date());

  return prisma.groomingQueue.findMany({
    where: { queueDate: today },
    include: {
      owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
      pet: {
        include: {
          species: { select: { speciesName: true } },
        },
      },
      groomer: { select: { userId: true, fullName: true } },
      items: {
        include: {
          groomingService: { select: { groomingServiceId: true, serviceName: true } },
        },
      },
    },
    orderBy: [{ queueNumber: "asc" }],
  });
}

export async function getGroomingQueueById(groomingQueueId: string) {
  await requirePermission("groomer", "view");

  return prisma.groomingQueue.findUnique({
    where: { groomingQueueId },
    include: {
      owner: { select: { ownerId: true, fullName: true, phoneNo: true, email: true } },
      pet: {
        include: {
          species: { select: { speciesName: true } },
          breed: { select: { breedName: true } },
        },
      },
      groomer: { select: { userId: true, fullName: true } },
      appointment: { select: { appointmentId: true, appointmentNo: true, appointmentDate: true } },
      items: {
        include: {
          groomingService: { select: { groomingServiceId: true, serviceName: true, durationMin: true } },
        },
      },
      invoice: { select: { invoiceId: true, invoiceNo: true, status: true } },
    },
  });
}
