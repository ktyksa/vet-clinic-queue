"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { generateVisitNo, generateInvoiceNo, generatePrescriptionNo, toJsonDate } from "@/lib/action-utils";
import {
  AppointmentStatus,
  type AppointmentType,
  Prisma,
  type VisitStatus,
  VisitType,
} from "@/generated/prisma/client";

function sanitizeUploadFileName(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "attachment";
}

async function saveIntakeAttachments(
  tx: Prisma.TransactionClient,
  visitId: string,
  attachments: FormDataEntryValue[],
  userId: string,
) {
  const files = attachments.filter(
    (entry): entry is File =>
      typeof entry === "object" &&
      "arrayBuffer" in entry &&
      "name" in entry &&
      "size" in entry &&
      entry.size > 0,
  );

  if (files.length <= 0) return;

  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  const maxFileSizeBytes = 10 * 1024 * 1024;
  // Store outside public/ — served via authenticated /api/files route
  const uploadDir = path.join(process.cwd(), "uploads", "visit-intake", visitId);

  await mkdir(uploadDir, { recursive: true });

  for (const file of files) {
    if (!allowedTypes.has(file.type)) {
      throw new Error("รองรับเฉพาะไฟล์รูปภาพหรือ PDF เท่านั้น");
    }

    if (file.size > maxFileSizeBytes) {
      throw new Error("ขนาดไฟล์ต้องไม่เกิน 10MB ต่อไฟล์");
    }

    const originalFileName = sanitizeUploadFileName(file.name);
    const fileName = `${Date.now()}-${crypto.randomUUID()}-${originalFileName}`;
    const absolutePath = path.join(uploadDir, fileName);
    const publicPath = `/api/files/visit-intake/${visitId}/${fileName}`;

    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    await tx.visitAttachment.create({
      data: {
        visitId,
        fileName,
        originalFileName: file.name,
        filePath: publicPath,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        category: "INTAKE",
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
  }
}

function mapAppointmentTypeToVisitType(appointmentType: string): VisitType {
  switch (appointmentType) {
    case "VACCINE":
      return VisitType.VACCINATION;
    case "SURGERY":
      return VisitType.SURGERY;
    case "FOLLOW_UP":
      return VisitType.FOLLOW_UP;
    case "SICK":
    case "CHECKUP":
    case "OTHER":
    default:
      return VisitType.CONSULTATION;
  }
}

function buildVisitAuditValue(visit: {
  visitId: string;
  visitNo: string;
  appointmentId: string | null;
  ownerId: string;
  petId: string;
  vetId: string | null;
  visitDate: Date;
  visitType: VisitType;
  reasonType?: AppointmentType | null;
  status: VisitStatus;
  checkedInAt?: Date | null;
  completedAt?: Date | null;
  chiefComplaint?: string | null;
  clinicalNote?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}): Prisma.InputJsonObject {
  return {
    visitId: visit.visitId,
    visitNo: visit.visitNo,
    appointmentId: visit.appointmentId,
    ownerId: visit.ownerId,
    petId: visit.petId,
    vetId: visit.vetId,
    visitDate: toJsonDate(visit.visitDate),
    visitType: visit.visitType,
    reasonType: visit.reasonType ?? null,
    status: visit.status,
    checkedInAt: toJsonDate(visit.checkedInAt),
    completedAt: toJsonDate(visit.completedAt),
    chiefComplaint: visit.chiefComplaint ?? null,
    clinicalNote: visit.clinicalNote ?? null,
    deletedAt: toJsonDate(visit.deletedAt),
    createdAt: toJsonDate(visit.createdAt),
    updatedAt: toJsonDate(visit.updatedAt),
    createdByUserId: visit.createdByUserId ?? null,
    updatedByUserId: visit.updatedByUserId ?? null,
  };
}

function revalidateVisitPaths(
  visitId?: string | null,
  appointmentId?: string | null,
) {
  revalidatePath("/visits");
  revalidatePath("/appointments");
  revalidatePath("/appointments/calendar");

  if (visitId) {
    revalidatePath(`/visits/${visitId}`);
    revalidatePath(`/visits/${visitId}/soap`);
  }

  if (appointmentId) {
    revalidatePath(`/appointments/${appointmentId}`);
  }
}

async function getExistingVisit(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: {
      visitId,
    },
  });

  if (!visit || visit.deletedAt) {
    throw new Error("Visit not found.");
  }

  return visit;
}

function assertValidVisitStatusTransition(
  currentStatus: VisitStatus,
  nextStatus: VisitStatus,
) {
  const allowedTransitions: Record<VisitStatus, VisitStatus[]> = {
    CHECKED_IN: ["WAITING_VET", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
    WAITING_VET: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  if (currentStatus === nextStatus) return;

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new Error(
      `Invalid visit status transition: ${currentStatus} to ${nextStatus}.`,
    );
  }
}

export async function createVisitFromAppointment(appointmentId: string) {
  const currentUser = await requirePermission("visit", "checkIn");

  const appointment = await prisma.appointment.findFirst({
    where: {
      appointmentId,
      deletedAt: null,
    },
    select: {
      appointmentId: true,
      appointmentNo: true,
      ownerId: true,
      petId: true,
      vetId: true,
      appointmentType: true,
      status: true,
      checkedInAt: true,
      visit: {
        where: {
          deletedAt: null,
        },
        select: {
          visitId: true,
        },
      },
      medicalQueue: {
        select: {
          queueId: true,
          queueStatus: true,
          reasonType: true,
          calledAt: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const queue = appointment.medicalQueue?.deletedAt ? null : appointment.medicalQueue;

  if (appointment.visit) {
    if (queue?.queueStatus === "IN_SERVICE") {
      await prisma.visit.updateMany({
        where: { visitId: appointment.visit.visitId, deletedAt: null, status: { in: ["CHECKED_IN", "WAITING_VET"] } },
        data: { status: "IN_PROGRESS", updatedByUserId: currentUser.userId },
      });
    }
    revalidateVisitPaths(appointment.visit.visitId, appointmentId);
    return appointment.visit;
  }

  if (appointment.status !== AppointmentStatus.ARRIVED && appointment.status !== AppointmentStatus.IN_PROGRESS) {
    throw new Error("Appointment must be checked in before creating a visit.");
  }

  if (!queue) {
    throw new Error("Medical queue is required before creating a visit.");
  }

  if (queue.queueStatus !== "WAITING_TRIAGE" && queue.queueStatus !== "TRIAGE_IN_PROGRESS" && queue.queueStatus !== "WAITING_VET" && queue.queueStatus !== "IN_SERVICE") {
    throw new Error("Medical queue must be active before creating a visit.");
  }

  const now = new Date();

  const visit = await prisma.$transaction(async (tx) => {
    const createdVisit = await tx.visit.create({
      data: {
        visitNo: generateVisitNo(now),
        appointmentId: appointment.appointmentId,
        ownerId: appointment.ownerId,
        petId: appointment.petId,
        vetId: appointment.vetId,
        visitDate: now,
        visitType: mapAppointmentTypeToVisitType(appointment.appointmentType),
        reasonType: queue.reasonType ?? appointment.appointmentType,
        status: queue.queueStatus === "IN_SERVICE" ? "IN_PROGRESS" : "CHECKED_IN",
        checkedInAt: appointment.checkedInAt ?? now,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.medicalQueue.update({
      where: {
        queueId: queue.queueId,
      },
      data: {
        queueStatus: queue.queueStatus === "IN_SERVICE" ? "IN_SERVICE" : "TRIAGE_IN_PROGRESS",
        reasonType: queue.reasonType ?? appointment.appointmentType,
        calledAt: queue.calledAt ?? now,
        updatedByUserId: currentUser.userId,
      },
    });

    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      await tx.appointment.update({
        where: {
          appointmentId,
        },
        data: {
          status: AppointmentStatus.IN_PROGRESS,
          updatedByUserId: currentUser.userId,
          statusHistories: {
            create: {
              fromStatus: appointment.status,
              toStatus: AppointmentStatus.IN_PROGRESS,
              actionCode: "CREATE_VISIT_FROM_MEDICAL_QUEUE",
              reason: "Medical visit created from medical queue",
              changedByUserId: currentUser.userId,
              createdByUserId: currentUser.userId,
              updatedByUserId: currentUser.userId,
            },
          },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_VISIT_FROM_MEDICAL_QUEUE",
        entityName: "Visit",
        entityId: createdVisit.visitId,
        newValue: buildVisitAuditValue(createdVisit),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.jobQueue.create({
      data: {
        jobType: "VISIT_CREATED_NOTIFICATION",
        payload: {
          visitId: createdVisit.visitId,
          visitNo: createdVisit.visitNo,
          appointmentId: createdVisit.appointmentId,
          ownerId: createdVisit.ownerId,
          petId: createdVisit.petId,
          vetId: createdVisit.vetId,
          visitDate: toJsonDate(createdVisit.visitDate),
        },
        status: "PENDING",
        availableAt: now,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return createdVisit;
  });

  revalidateVisitPaths(visit.visitId, appointmentId);

  return visit;
}

export async function getVisitById(visitId: string) {
  await requirePermission("visit", "view");

  return prisma.visit.findFirst({
    where: {
      visitId,
      deletedAt: null,
    },
    include: {
      owner: true,
      pet: {
        include: {
          species: true,
          breed: true,
        },
      },
      vet: true,
      appointment: {
        include: {
          medicalQueue: true,
        },
      },
      medicalQueue: true,
      intakeAttachments: {
        where: {
          deletedAt: null,
          category: "INTAKE",
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      soapNote: {
        include: {
          vet: true,
          addendums: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              addedAt: "desc",
            },
          },
        },
      },
      diagnoses: {
        where: {
          deletedAt: null,
        },
        include: {
          diagnosisCode: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      vaccineRecords: {
        where: {
          deletedAt: null,
        },
        include: {
          vaccine: true,
        },
        orderBy: {
          injectionDate: "desc",
        },
      },
    },
  });
}

export async function getVisitMedicalHistoryByVisitId(visitId: string) {
  await requirePermission("visit", "view");

  const currentVisit = await prisma.visit.findFirst({
    where: {
      visitId,
      deletedAt: null,
    },
    select: {
      visitId: true,
      petId: true,
    },
  });

  if (!currentVisit) {
    return [];
  }

  return prisma.visit.findMany({
    where: {
      petId: currentVisit.petId,
      deletedAt: null,
      NOT: {
        visitId: currentVisit.visitId,
      },
    },
    include: {
      vet: true,
      appointment: true,
      soapNote: true,
      diagnoses: {
        where: {
          deletedAt: null,
        },
        include: {
          diagnosisCode: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      vaccineRecords: {
        where: {
          deletedAt: null,
        },
        include: {
          vaccine: true,
        },
        orderBy: {
          injectionDate: "desc",
        },
      },
    },
    orderBy: {
      visitDate: "desc",
    },
    take: 5,
  });
}

export async function updateVisitStatus(visitId: string, status: VisitStatus) {
  const permissionAction = status === "COMPLETED" ? "complete" : "update";
  const currentUser = await requirePermission("visit", permissionAction);

  const existingVisit = await getExistingVisit(visitId);
  assertValidVisitStatusTransition(existingVisit.status, status);

  if (status === "COMPLETED") {
    const soapReadiness = await prisma.visit.findFirst({
      where: { visitId, deletedAt: null },
      select: {
        soapNote: { select: { status: true, deletedAt: true } },
        diagnoses: { where: { deletedAt: null }, select: { visitDiagnosisId: true } },
      },
    });

    if (!soapReadiness?.soapNote || soapReadiness.soapNote.deletedAt || soapReadiness.soapNote.status !== "FINALIZED") {
      throw new Error("SOAP must be finalized before completing the visit.");
    }

    if (soapReadiness.diagnoses.length <= 0) {
      throw new Error("At least one diagnosis is required before completing the visit.");
    }
  }

  const updatedVisit = await prisma.$transaction(async (tx) => {
    const result = await tx.visit.update({
      where: {
        visitId,
      },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : existingVisit.completedAt,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: status === "COMPLETED" ? "COMPLETE_VISIT" : "UPDATE_VISIT_STATUS",
        entityName: "Visit",
        entityId: visitId,
        oldValue: buildVisitAuditValue(existingVisit),
        newValue: buildVisitAuditValue(result),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    if (status === "IN_PROGRESS") {
      await tx.medicalQueue.updateMany({
        where: { visitId: result.visitId, deletedAt: null, queueStatus: { in: ["WAITING_VET"] } },
        data: { queueStatus: "IN_SERVICE", inServiceAt: new Date(), updatedByUserId: currentUser.userId },
      });
    }

    if (status === "IN_PROGRESS" && result.appointmentId) {
      await tx.appointment.update({
        where: { appointmentId: result.appointmentId },
        data: { status: AppointmentStatus.IN_PROGRESS, updatedByUserId: currentUser.userId },
      });

      await tx.medicalQueue.updateMany({
        where: { appointmentId: result.appointmentId, deletedAt: null, queueStatus: { in: ["WAITING_VET"] } },
        data: { queueStatus: "IN_SERVICE", inServiceAt: new Date(), updatedByUserId: currentUser.userId },
      });
    }

    if (status === "COMPLETED") {
      await tx.medicalQueue.updateMany({
        where: { visitId: result.visitId, deletedAt: null, queueStatus: { notIn: ["COMPLETED", "CANCELLED"] } },
        data: { queueStatus: "COMPLETED", completedAt: new Date(), updatedByUserId: currentUser.userId },
      });
    }

    if (status === "COMPLETED" && result.appointmentId) {
      await tx.appointment.update({
        where: { appointmentId: result.appointmentId },
        data: {
          status: AppointmentStatus.COMPLETED,
          completedAt: new Date(),
          updatedByUserId: currentUser.userId,
          statusHistories: {
            create: {
              fromStatus: null,
              toStatus: AppointmentStatus.COMPLETED,
              actionCode: "COMPLETE_VISIT_AND_APPOINTMENT",
              reason: "Medical visit completed",
              changedByUserId: currentUser.userId,
              createdByUserId: currentUser.userId,
              updatedByUserId: currentUser.userId,
            },
          },
        },
      });

      await tx.medicalQueue.updateMany({
        where: {
          appointmentId: result.appointmentId,
          deletedAt: null,
          queueStatus: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        data: {
          queueStatus: "COMPLETED",
          completedAt: new Date(),
          updatedByUserId: currentUser.userId,
        },
      });
    }

    if (status === "COMPLETED") {
      await tx.jobQueue.create({
        data: {
          jobType: "VISIT_COMPLETED_NOTIFICATION",
          payload: {
            visitId: result.visitId,
            visitNo: result.visitNo,
            appointmentId: result.appointmentId,
            ownerId: result.ownerId,
            petId: result.petId,
            vetId: result.vetId,
            completedAt: toJsonDate(result.completedAt),
          },
          status: "PENDING",
          availableAt: new Date(),
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        },
      });
    }

    if (status === "COMPLETED") {
      // Auto-create Invoice + Prescription; upsert so repeat calls are idempotent
      const vaccineRecords = await tx.vaccineRecord.findMany({
        where: { visitId, deletedAt: null },
        include: { vaccine: { select: { vaccineName: true, price: true } } },
      });

      const invoiceItems = vaccineRecords.flatMap((r) => {
        if (!r.vaccine.price) return [];
        return [{
          itemType: "VACCINE" as const,
          itemName: r.vaccine.vaccineName,
          quantity: new Prisma.Decimal(1),
          unitPrice: r.vaccine.price,
          totalPrice: r.vaccine.price,
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        }];
      });

      const totalAmount = invoiceItems.reduce(
        (sum, item) => sum.add(item.totalPrice),
        new Prisma.Decimal(0),
      );

      await tx.invoice.upsert({
        where: { visitId },
        update: {},
        create: {
          invoiceNo: generateInvoiceNo(),
          visitId,
          petId: result.petId,
          ownerId: result.ownerId,
          totalAmount,
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
          ...(invoiceItems.length > 0 && { items: { create: invoiceItems } }),
        },
      });

      await tx.prescription.upsert({
        where: { visitId },
        update: {},
        create: {
          prescriptionNo: generatePrescriptionNo(),
          visitId,
          petId: result.petId,
          ownerId: result.ownerId,
          vetId: result.vetId ?? currentUser.userId,
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        },
      });
    }

    return result;
  });

  revalidateVisitPaths(updatedVisit.visitId, updatedVisit.appointmentId);
  if (status === "COMPLETED") {
    revalidatePath("/billing");
    revalidatePath("/pharmacy");
  }

  return updatedVisit;
}

export async function updateVisitClinicalInfo(formData: FormData) {
  const currentUser = await requirePermission("visit", "update");

  const visitId = String(formData.get("visitId") ?? "");
  const readyForVet = String(formData.get("readyForVet") ?? "") === "true";

  if (!visitId) {
    throw new Error("Visit ID is required.");
  }

  const existingVisit = await getExistingVisit(visitId);

  const activeQueue = await prisma.medicalQueue.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { visitId: existingVisit.visitId },
        existingVisit.appointmentId ? { appointmentId: existingVisit.appointmentId } : undefined,
      ].filter(Boolean) as Prisma.MedicalQueueWhereInput[],
    },
    select: { queueStatus: true },
  });

  const intakeEditable =
    existingVisit.status === "CHECKED_IN" &&
    (!activeQueue || ["WAITING_TRIAGE", "TRIAGE_IN_PROGRESS"].includes(activeQueue.queueStatus));

  if (!intakeEditable) {
    throw new Error("Intake has already been sent to the veterinarian and is read-only.");
  }

  const weightKg = formData.get("weightKg");
  const temperatureC = formData.get("temperatureC");
  const heartRateBpm = formData.get("heartRateBpm");
  const respiratoryRateBpm = formData.get("respiratoryRateBpm");
  const bodyConditionScore = formData.get("bodyConditionScore");
  const painScore = formData.get("painScore");
  const attachments = formData.getAll("attachments");
  const deleteAttachmentIds = formData
    .getAll("deleteAttachmentIds")
    .map((value) => String(value))
    .filter(Boolean);

  const nextStatus =
    readyForVet && existingVisit.status === "CHECKED_IN"
      ? "WAITING_VET"
      : existingVisit.status;

  if (readyForVet && existingVisit.status === "COMPLETED") {
    throw new Error("Completed visit cannot be sent back to vet queue.");
  }

  if (readyForVet && existingVisit.status === "CANCELLED") {
    throw new Error("Cancelled visit cannot be sent to vet queue.");
  }

  assertValidVisitStatusTransition(existingVisit.status, nextStatus);

  const updatedVisit = await prisma.$transaction(async (tx) => {
    const result = await tx.visit.update({
      where: {
        visitId,
      },
      data: {
        status: nextStatus,
        weightKg: weightKg ? String(weightKg) : null,
        temperatureC: temperatureC ? String(temperatureC) : null,
        heartRateBpm: heartRateBpm ? Number(heartRateBpm) : null,
        respiratoryRateBpm: respiratoryRateBpm
          ? Number(respiratoryRateBpm)
          : null,
        bodyConditionScore: bodyConditionScore
          ? Number(bodyConditionScore)
          : null,
        painScore: painScore ? Number(painScore) : null,
        hydrationStatus: String(formData.get("hydrationStatus") ?? "") || null,
        mucousMembrane: String(formData.get("mucousMembrane") ?? "") || null,
        capillaryRefillTime:
          String(formData.get("capillaryRefillTime") ?? "") || null,
        appetiteStatus: String(formData.get("appetiteStatus") ?? "") || null,
        mentalStatus: String(formData.get("mentalStatus") ?? "") || null,
        waterIntakeStatus: String(formData.get("waterIntakeStatus") ?? "") || null,
        urinationStatus: String(formData.get("urinationStatus") ?? "") || null,
        defecationStatus: String(formData.get("defecationStatus") ?? "") || null,
        chiefComplaint: String(formData.get("chiefComplaint") ?? "") || null,
        clinicalNote: String(formData.get("clinicalNote") ?? "") || null,
        updatedByUserId: currentUser.userId,
      },
    });

    if (deleteAttachmentIds.length > 0) {
      await tx.visitAttachment.updateMany({
        where: {
          visitId: result.visitId,
          visitAttachmentId: {
            in: deleteAttachmentIds,
          },
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          updatedByUserId: currentUser.userId,
        },
      });
    }

    await saveIntakeAttachments(tx, result.visitId, attachments, currentUser.userId);

    if (readyForVet) {
      await tx.medicalQueue.updateMany({
        where: { visitId: result.visitId, deletedAt: null, queueStatus: { in: ["WAITING_TRIAGE", "TRIAGE_IN_PROGRESS"] } },
        data: { queueStatus: "WAITING_VET", waitingAt: new Date(), updatedByUserId: currentUser.userId },
      });
    }

    if (readyForVet && result.appointmentId) {
      await tx.medicalQueue.updateMany({
        where: {
          appointmentId: result.appointmentId,
          deletedAt: null,
          queueStatus: {
            in: ["WAITING_TRIAGE", "TRIAGE_IN_PROGRESS"],
          },
        },
        data: {
          queueStatus: "WAITING_VET",
          waitingAt: new Date(),
          updatedByUserId: currentUser.userId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: readyForVet
          ? "SAVE_VISIT_INTAKE_READY_FOR_VET"
          : "UPDATE_VISIT_CLINICAL_INFO",
        entityName: "Visit",
        entityId: visitId,
        oldValue: buildVisitAuditValue(existingVisit),
        newValue: buildVisitAuditValue(result),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    if (readyForVet) {
      await tx.jobQueue.create({
        data: {
          jobType: "VISIT_READY_FOR_VET_NOTIFICATION",
          payload: {
            visitId: result.visitId,
            visitNo: result.visitNo,
            appointmentId: result.appointmentId,
            ownerId: result.ownerId,
            petId: result.petId,
            vetId: result.vetId,
          },
          status: "PENDING",
          availableAt: new Date(),
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        },
      });
    }

    return result;
  });

  revalidateVisitPaths(updatedVisit.visitId, updatedVisit.appointmentId);
  revalidatePath("/medical-queue");

  if (readyForVet) {
    redirect("/medical-queue?notice=ready-for-vet");
  }

  redirect(`/visits/${updatedVisit.visitId}?focus=intake-saved&notice=intake-saved`);
}
