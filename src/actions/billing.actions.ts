"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { formatDatePart, startOfDay } from "@/lib/action-utils";
import { Prisma, type InvoiceItemType, type PaymentMethod } from "@/generated/prisma/client";

const VALID_ITEM_TYPES: InvoiceItemType[] = ["SERVICE", "MEDICATION", "VACCINE", "LAB", "OTHER"];
const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  "CASH", "CREDIT_CARD", "DEBIT_CARD", "TRANSFER", "QR_CODE", "OTHER",
];
const EDITABLE_STATUSES = ["PENDING", "WAITING_FOR_PAYMENT"] as const;

async function generateInvoiceNo(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const dateStr = formatDatePart(date);
  const prefix = `INV-${dateStr}-`;
  const rows = await tx.$queryRaw<{ invoiceNo: string }[]>`
    SELECT "invoiceNo" FROM "Invoice"
    WHERE "invoiceNo" LIKE ${prefix + "%"}
    ORDER BY "invoiceNo" DESC
    LIMIT 1
    FOR UPDATE
  `;
  let seq = 1;
  if (rows.length > 0) {
    const parsed = parseInt(rows[0].invoiceNo.slice(prefix.length), 10);
    if (!isNaN(parsed)) seq = parsed + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

// ── Create from Grooming ────────────────────────────────────────────────────

export async function createInvoiceFromGrooming(groomingQueueId: string) {
  const currentUser = await requirePermission("payment", "create");

  const invoice = await prisma.$transaction(async (tx) => {
    const queue = await tx.groomingQueue.findUnique({
      where: { groomingQueueId },
      include: { items: { include: { groomingService: true } } },
    });

    if (!queue) throw new Error("ไม่พบคิวอาบน้ำตัดขน");
    if (queue.status !== "COMPLETED")
      throw new Error("สร้างใบแจ้งหนี้ได้เฉพาะคิวที่เสร็จสิ้นแล้วเท่านั้น");

    const existing = await tx.invoice.findUnique({ where: { groomingQueueId } });
    if (existing) throw new Error("มีใบแจ้งหนี้สำหรับคิวนี้แล้ว");

    const now = new Date();
    const invoiceNo = await generateInvoiceNo(tx, now);
    const subtotal = queue.items.reduce((sum, i) => sum + Number(i.priceSnapshot), 0);

    const newInvoice = await tx.invoice.create({
      data: {
        invoiceNo,
        invoiceDate: now,
        source: "GROOMING",
        groomingQueueId,
        petId: queue.petId,
        ownerId: queue.ownerId,
        status: "PENDING",
        subtotal,
        discount: 0,
        totalAmount: subtotal,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
        items: {
          create: queue.items.map((item) => ({
            itemType: "SERVICE" as InvoiceItemType,
            itemName: item.groomingService.serviceName,
            quantity: 1,
            unitPrice: item.priceSnapshot,
            totalPrice: item.priceSnapshot,
            createdByUserId: currentUser.userId,
            updatedByUserId: currentUser.userId,
          })),
        },
      },
    });

    await tx.groomingQueue.update({
      where: { groomingQueueId },
      data: { status: "BILLED", updatedByUserId: currentUser.userId },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_INVOICE_FROM_GROOMING",
        entityName: "Invoice",
        entityId: newInvoice.invoiceId,
        newValue: { invoiceNo, groomingQueueId, totalAmount: subtotal },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return newInvoice;
  });

  revalidatePath("/grooming");
  revalidatePath(`/grooming/${groomingQueueId}`);
  redirect(`/billing/${invoice.invoiceId}`);
}

// ── Create from Visit ───────────────────────────────────────────────────────

export async function createInvoiceFromVisit(visitId: string) {
  const currentUser = await requirePermission("payment", "create");

  const invoice = await prisma.$transaction(async (tx) => {
    const visit = await tx.visit.findUnique({
      where: { visitId },
      select: { visitId: true, petId: true, ownerId: true, status: true, visitNo: true },
    });

    if (!visit) throw new Error("ไม่พบ Visit");
    if (visit.status !== "COMPLETED")
      throw new Error("สร้างใบแจ้งหนี้ได้เฉพาะ Visit ที่เสร็จสิ้นแล้วเท่านั้น");

    const existing = await tx.invoice.findUnique({ where: { visitId } });
    if (existing) throw new Error("มีใบแจ้งหนี้สำหรับ Visit นี้แล้ว");

    const now = new Date();
    const invoiceNo = await generateInvoiceNo(tx, now);

    const newInvoice = await tx.invoice.create({
      data: {
        invoiceNo,
        invoiceDate: now,
        source: "MEDICAL",
        visitId,
        petId: visit.petId,
        ownerId: visit.ownerId,
        status: "PENDING",
        subtotal: 0,
        discount: 0,
        totalAmount: 0,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_INVOICE_FROM_VISIT",
        entityName: "Invoice",
        entityId: newInvoice.invoiceId,
        newValue: { invoiceNo, visitId, visitNo: visit.visitNo },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return newInvoice;
  });

  revalidatePath("/billing");
  redirect(`/billing/${invoice.invoiceId}`);
}

// ── Pay Invoice ─────────────────────────────────────────────────────────────

export async function payInvoice(invoiceId: string, formData: FormData) {
  const currentUser = await requirePermission("payment", "create");
  const paymentMethod = String(formData.get("paymentMethod") ?? "") as PaymentMethod;

  if (!VALID_PAYMENT_METHODS.includes(paymentMethod))
    throw new Error("วิธีชำระเงินไม่ถูกต้อง");

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    select: { status: true, totalAmount: true },
  });

  if (!invoice) throw new Error("ไม่พบใบแจ้งหนี้");
  if (!(EDITABLE_STATUSES as readonly string[]).includes(invoice.status))
    throw new Error("ชำระเงินได้เฉพาะใบแจ้งหนี้ที่รอชำระเท่านั้น");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { invoiceId },
      data: {
        status: "PAID",
        paymentMethod,
        paidAmount: invoice.totalAmount,
        paidAt: now,
        paidByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "PAY_INVOICE",
        entityName: "Invoice",
        entityId: invoiceId,
        oldValue: { status: invoice.status },
        newValue: { status: "PAID", paymentMethod, paidAt: now.toISOString() },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function getInvoiceById(invoiceId: string) {
  await requirePermission("payment", "view");

  return prisma.invoice.findUnique({
    where: { invoiceId },
    include: {
      owner: { select: { ownerId: true, fullName: true, phoneNo: true, email: true } },
      pet: {
        include: {
          species: { select: { speciesName: true } },
          breed: { select: { breedName: true } },
        },
      },
      visit: { select: { visitId: true, visitNo: true, visitDate: true } },
      groomingQueue: { select: { groomingQueueId: true, queueNumber: true, queueDate: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getPendingInvoices() {
  await requirePermission("payment", "view");

  return prisma.invoice.findMany({
    where: { status: { in: ["PENDING", "WAITING_FOR_PAYMENT"] } },
    include: {
      owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
      pet: { select: { petId: true, petName: true, species: { select: { speciesName: true } } } },
      visit: { select: { visitNo: true } },
      groomingQueue: { select: { queueNumber: true, queueDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTodayInvoices() {
  await requirePermission("payment", "view");

  const today = startOfDay(new Date());
  return prisma.invoice.findMany({
    where: { invoiceDate: { gte: today } },
    include: {
      owner: { select: { fullName: true } },
      pet: { select: { petName: true } },
    },
    orderBy: { invoiceDate: "asc" },
  });
}

// ── Legacy form-action wrappers (kept for backward compat) ──────────────────

export async function markInvoicePaid(formData: FormData) {
  const currentUser = await requirePermission("payment", "create");

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "") as PaymentMethod;

  if (!invoiceId) throw new Error("Invoice ID is required.");
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) throw new Error("Invalid payment method.");

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    select: { status: true, totalAmount: true },
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (!(EDITABLE_STATUSES as readonly string[]).includes(invoice.status))
    throw new Error("Invoice is not pending payment.");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { invoiceId },
      data: {
        status: "PAID",
        paymentMethod,
        paidAmount: invoice.totalAmount,
        paidAt: now,
        paidByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "MARK_INVOICE_PAID",
        entityName: "Invoice",
        entityId: invoiceId,
        oldValue: { status: invoice.status },
        newValue: { status: "PAID", paymentMethod, paidAt: now.toISOString() },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/billing");
  revalidatePath("/pharmacy");
  revalidatePath(`/billing/${invoiceId}`);
}

export async function addInvoiceItem(formData: FormData) {
  const currentUser = await requirePermission("payment", "create");

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const itemType = String(formData.get("itemType") ?? "SERVICE") as InvoiceItemType;
  const itemName = String(formData.get("itemName") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  const unitPrice = Number(formData.get("unitPrice") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!invoiceId) throw new Error("Invoice ID is required.");
  if (!itemName) throw new Error("Item name is required.");
  if (!VALID_ITEM_TYPES.includes(itemType)) throw new Error("Invalid item type.");
  if (quantity <= 0) throw new Error("Quantity must be positive.");
  if (unitPrice < 0) throw new Error("Unit price cannot be negative.");

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    select: { status: true, discount: true },
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (!(EDITABLE_STATUSES as readonly string[]).includes(invoice.status))
    throw new Error("Can only add items to unpaid invoices.");

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.create({
      data: {
        invoiceId,
        itemType,
        itemName,
        quantity,
        unitPrice,
        totalPrice: quantity * unitPrice,
        note,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    const allItems = await tx.invoiceItem.findMany({ where: { invoiceId } });
    const newSubtotal = allItems.reduce((sum, i) => sum + Number(i.totalPrice), 0);
    const newTotal = Math.max(0, newSubtotal - Number(invoice.discount));

    await tx.invoice.update({
      where: { invoiceId },
      data: { subtotal: newSubtotal, totalAmount: newTotal, updatedByUserId: currentUser.userId },
    });
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
}

export async function removeInvoiceItem(invoiceItemId: string) {
  const currentUser = await requirePermission("payment", "create");

  const item = await prisma.invoiceItem.findUnique({
    where: { invoiceItemId },
    include: { invoice: { select: { status: true, invoiceId: true, discount: true } } },
  });

  if (!item) throw new Error("Item not found.");
  if (!(EDITABLE_STATUSES as readonly string[]).includes(item.invoice.status))
    throw new Error("Cannot remove items from a paid or voided invoice.");

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.delete({ where: { invoiceItemId } });

    const remaining = await tx.invoiceItem.findMany({ where: { invoiceId: item.invoiceId } });
    const newSubtotal = remaining.reduce((sum, i) => sum + Number(i.totalPrice), 0);
    const newTotal = Math.max(0, newSubtotal - Number(item.invoice.discount));

    await tx.invoice.update({
      where: { invoiceId: item.invoiceId },
      data: { subtotal: newSubtotal, totalAmount: newTotal, updatedByUserId: currentUser.userId },
    });
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/${item.invoiceId}`);
}

export async function voidInvoice(formData: FormData) {
  const currentUser = await requirePermission("payment", "void");

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const voidReason = String(formData.get("voidReason") ?? "").trim();

  if (!invoiceId) throw new Error("Invoice ID is required.");
  if (!voidReason) throw new Error("Void reason is required.");

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    select: { status: true },
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "VOIDED") throw new Error("Invoice is already voided.");
  if (invoice.status === "PAID") throw new Error("Cannot void a paid invoice.");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { invoiceId },
      data: {
        status: "VOIDED",
        voidReason,
        voidedAt: now,
        voidedByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "VOID_INVOICE",
        entityName: "Invoice",
        entityId: invoiceId,
        oldValue: { status: invoice.status },
        newValue: { status: "VOIDED", voidReason },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
}
