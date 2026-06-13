"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { Prisma } from "@/generated/prisma/client";

// ── Sequential RX number ─────────────────────────────────────────────────────

function fmtDatePart(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

async function generateRxNo(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const dateStr = fmtDatePart(date);
  const prefix = `RX-${dateStr}-`;
  const rows = await tx.$queryRaw<{ prescriptionNo: string }[]>`
    SELECT "prescriptionNo" FROM "Prescription"
    WHERE "prescriptionNo" LIKE ${prefix + "%"}
    ORDER BY "prescriptionNo" DESC
    LIMIT 1
    FOR UPDATE
  `;
  let seq = 1;
  if (rows.length > 0) {
    const parsed = parseInt(rows[0].prescriptionNo.slice(prefix.length), 10);
    if (!isNaN(parsed)) seq = parsed + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

// ── Create prescription for a visit ─────────────────────────────────────────

export async function createPrescription(visitId: string) {
  const currentUser = await requirePermission("prescription", "create");

  const visit = await prisma.visit.findUnique({
    where: { visitId },
    select: {
      visitId: true,
      petId: true,
      ownerId: true,
      vetId: true,
      status: true,
      soapNote: { select: { status: true } },
      prescription: { select: { prescriptionId: true } },
    },
  });

  if (!visit) throw new Error("ไม่พบ Visit");
  if (visit.prescription) throw new Error("มีใบสั่งยาสำหรับ Visit นี้แล้ว");
  if (!visit.vetId) throw new Error("ยังไม่มีสัตวแพทย์รับผิดชอบ Visit นี้");
  if (visit.soapNote?.status !== "FINALIZED")
    throw new Error("กรุณา Finalize SOAP ก่อนสร้างใบสั่งยา");

  const rx = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const rxNo = await generateRxNo(tx, now);
    return tx.prescription.create({
      data: {
        prescriptionNo: rxNo,
        visitId,
        petId: visit.petId,
        ownerId: visit.ownerId,
        vetId: visit.vetId!,
        status: "DRAFT",
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
      select: { prescriptionId: true },
    });
  });

  revalidatePath(`/visits/${visitId}/prescription`);
  redirect(`/visits/${visitId}/prescription`);
}

// ── Add item to prescription ─────────────────────────────────────────────────

export async function addPrescriptionItem(prescriptionId: string, formData: FormData) {
  const currentUser = await requirePermission("prescription", "update");

  const drugId = String(formData.get("drugId") ?? "").trim() || null;
  const manualName = String(formData.get("medicationName") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim() || null;
  const frequency = String(formData.get("frequency") ?? "").trim() || null;
  const durationDays = String(formData.get("durationDays") ?? "").trim() || null;
  const quantity = Number(formData.get("quantity") ?? 1);
  const instructions = String(formData.get("instructions") ?? "").trim() || null;

  if (quantity <= 0) throw new Error("จำนวนต้องมากกว่า 0");

  const prescription = await prisma.prescription.findUnique({
    where: { prescriptionId },
    select: { status: true },
  });
  if (!prescription) throw new Error("ไม่พบใบสั่งยา");
  if (prescription.status !== "DRAFT")
    throw new Error("แก้ไขได้เฉพาะใบสั่งยาสถานะ DRAFT เท่านั้น");

  let medicationName = manualName;
  let unit: string | null = null;
  let pricePerUnit: Prisma.Decimal | null = null;

  if (drugId) {
    const drug = await prisma.drug.findUnique({
      where: { drugId },
      select: { name: true, unit: true, pricePerUnit: true, stockQty: true },
    });
    if (!drug) throw new Error("ไม่พบยาในฐานข้อมูล");
    if (drug.stockQty < quantity) throw new Error(`Stock ไม่เพียงพอ (คงเหลือ ${drug.stockQty} ${drug.unit})`);
    medicationName = drug.name;
    unit = drug.unit;
    pricePerUnit = drug.pricePerUnit;
  }

  if (!medicationName) throw new Error("กรุณาระบุชื่อยา");

  await prisma.prescriptionItem.create({
    data: {
      prescriptionId,
      drugId,
      medicationName,
      dosage,
      frequency,
      duration: durationDays ? `${durationDays} วัน` : null,
      quantity,
      unit,
      pricePerUnit,
      instructions,
      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  const rx = await prisma.prescription.findUnique({
    where: { prescriptionId },
    select: { visitId: true },
  });
  revalidatePath(`/visits/${rx?.visitId}/prescription`);
}

// ── Remove item ──────────────────────────────────────────────────────────────

export async function removePrescriptionItem(itemId: string) {
  const currentUser = await requirePermission("prescription", "update");

  const item = await prisma.prescriptionItem.findUnique({
    where: { prescriptionItemId: itemId },
    include: {
      prescription: { select: { status: true, visitId: true } },
    },
  });
  if (!item) throw new Error("ไม่พบรายการยา");
  if (item.prescription.status !== "DRAFT")
    throw new Error("ลบได้เฉพาะใบสั่งยาสถานะ DRAFT");

  await prisma.prescriptionItem.delete({ where: { prescriptionItemId: itemId } });
  revalidatePath(`/visits/${item.prescription.visitId}/prescription`);
}

// ── Finalize prescription (DRAFT → FINALIZED) ─────────────────────────────

export async function finalizePrescription(prescriptionId: string) {
  const currentUser = await requirePermission("prescription", "update");

  const rx = await prisma.prescription.findUnique({
    where: { prescriptionId },
    select: { status: true, visitId: true, items: { select: { prescriptionItemId: true } } },
  });
  if (!rx) throw new Error("ไม่พบใบสั่งยา");
  if (rx.status !== "DRAFT") throw new Error("ใบสั่งยาไม่อยู่ในสถานะ DRAFT");
  if (rx.items.length === 0) throw new Error("กรุณาเพิ่มรายการยาก่อน Finalize");

  await prisma.prescription.update({
    where: { prescriptionId },
    data: { status: "FINALIZED", updatedByUserId: currentUser.userId },
  });

  revalidatePath(`/visits/${rx.visitId}/prescription`);
  revalidatePath("/pharmacy");
}

// ── Dispense (FINALIZED → DISPENSED + deduct stock) ──────────────────────────

export async function dispensePrescription(prescriptionId: string) {
  const currentUser = await requirePermission("prescription", "update");

  const rx = await prisma.prescription.findUnique({
    where: { prescriptionId },
    include: {
      visit: { select: { invoice: { select: { status: true } } } },
      items: {
        select: {
          prescriptionItemId: true,
          drugId: true,
          quantity: true,
          drug: { select: { stockQty: true, name: true, unit: true } },
        },
      },
    },
  });

  if (!rx) throw new Error("ไม่พบใบสั่งยา");
  if (rx.status !== "FINALIZED") throw new Error("ใบสั่งยาต้องอยู่ในสถานะ FINALIZED");
  if (rx.visit.invoice?.status !== "PAID")
    throw new Error("ต้องชำระเงินก่อนจ่ายยา");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const item of rx.items) {
      if (!item.drugId || !item.drug) continue;
      const qty = Number(String(item.quantity));
      if (item.drug.stockQty < qty) {
        throw new Error(
          `Stock ไม่เพียงพอสำหรับ ${item.drug.name} (คงเหลือ ${item.drug.stockQty} ${item.drug.unit}, ต้องการ ${qty})`
        );
      }
      await tx.drug.update({
        where: { drugId: item.drugId },
        data: { stockQty: { decrement: qty }, updatedByUserId: currentUser.userId },
      });
    }

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
        oldValue: { status: "FINALIZED" },
        newValue: { status: "DISPENSED", dispensedAt: now.toISOString() },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/pharmacy");
  revalidatePath(`/visits/${rx.visitId}/prescription`);
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getActiveDrugs() {
  await requirePermission("prescription", "view");
  return prisma.drug.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      drugId: true,
      name: true,
      genericName: true,
      unit: true,
      stockQty: true,
      pricePerUnit: true,
    },
  });
}

export async function getDrugStock() {
  await requirePermission("prescription", "view");
  return prisma.drug.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      drugId: true,
      name: true,
      genericName: true,
      unit: true,
      stockQty: true,
      minStock: true,
      pricePerUnit: true,
      isActive: true,
    },
  });
}
