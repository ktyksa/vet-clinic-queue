"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import type { InvoiceItemType, PaymentMethod } from "@/generated/prisma/client";

const VALID_ITEM_TYPES: InvoiceItemType[] = ["SERVICE", "MEDICATION", "VACCINE", "LAB", "OTHER"];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "TRANSFER", "OTHER"];

export async function markInvoicePaid(formData: FormData) {
  const currentUser = await requirePermission("payment", "create");

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "") as PaymentMethod;

  if (!invoiceId) throw new Error("Invoice ID is required.");
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new Error("Invalid payment method.");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    select: { status: true, totalAmount: true, invoiceNo: true },
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "WAITING_FOR_PAYMENT") {
    throw new Error("Invoice is not pending payment.");
  }

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
        oldValue: { status: "WAITING_FOR_PAYMENT" },
        newValue: { status: "PAID", paymentMethod, paidAt: now.toISOString() },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/billing");
  revalidatePath("/pharmacy");
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
    select: { status: true },
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "WAITING_FOR_PAYMENT") {
    throw new Error("Can only add items to unpaid invoices.");
  }

  const totalPrice = quantity * unitPrice;

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.create({
      data: {
        invoiceId,
        itemType,
        itemName,
        quantity,
        unitPrice,
        totalPrice,
        note,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    const allItems = await tx.invoiceItem.findMany({ where: { invoiceId } });
    const newTotal = allItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);

    await tx.invoice.update({
      where: { invoiceId },
      data: { totalAmount: newTotal, updatedByUserId: currentUser.userId },
    });
  });

  revalidatePath("/billing");
}

export async function removeInvoiceItem(invoiceItemId: string) {
  const currentUser = await requirePermission("payment", "create");

  const item = await prisma.invoiceItem.findUnique({
    where: { invoiceItemId },
    include: { invoice: { select: { status: true, invoiceId: true } } },
  });

  if (!item) throw new Error("Item not found.");
  if (item.invoice.status !== "WAITING_FOR_PAYMENT") {
    throw new Error("Cannot remove items from a paid or voided invoice.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.delete({ where: { invoiceItemId } });

    const remaining = await tx.invoiceItem.findMany({
      where: { invoiceId: item.invoiceId },
    });
    const newTotal = remaining.reduce((sum, i) => sum + Number(i.totalPrice), 0);

    await tx.invoice.update({
      where: { invoiceId: item.invoiceId },
      data: { totalAmount: newTotal, updatedByUserId: currentUser.userId },
    });
  });

  revalidatePath("/billing");
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
        oldValue: { status: "WAITING_FOR_PAYMENT" },
        newValue: { status: "VOIDED", voidReason },
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });
  });

  revalidatePath("/billing");
}
