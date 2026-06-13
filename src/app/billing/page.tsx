import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { startOfDay } from "@/lib/action-utils";
import {
  createInvoiceFromGrooming,
  createInvoiceFromVisit,
} from "@/actions/billing.actions";
import type { InvoiceStatus, InvoiceSource, PaymentMethod } from "@/generated/prisma/client";

type Props = { searchParams: Promise<{ status?: string; source?: string }> };

const VALID_STATUSES: InvoiceStatus[] = [
  "PENDING", "WAITING_FOR_PAYMENT", "PAID", "VOIDED", "CANCELLED",
];

const SOURCE_LABELS: Record<InvoiceSource, string> = {
  MEDICAL: "การแพทย์",
  GROOMING: "อาบน้ำตัดขน",
  RETAIL: "ร้านค้า",
  MIXED: "รวม",
};

const SOURCE_BADGE: Record<InvoiceSource, string> = {
  MEDICAL: "bg-blue-100 text-blue-700",
  GROOMING: "bg-violet-100 text-violet-700",
  RETAIL: "bg-gray-100 text-gray-700",
  MIXED: "bg-indigo-100 text-indigo-700",
};

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  WAITING_FOR_PAYMENT: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  VOIDED: "bg-red-50 text-red-600",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "รอชำระ",
  WAITING_FOR_PAYMENT: "รอชำระ",
  PAID: "ชำระแล้ว",
  CANCELLED: "ยกเลิก",
  VOIDED: "โมฆะ",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  CREDIT_CARD: "บัตรเครดิต",
  DEBIT_CARD: "บัตรเดบิต",
  TRANSFER: "โอนเงิน",
  QR_CODE: "QR Code",
  OTHER: "อื่นๆ",
};

function thb(value: unknown): string {
  return Number(String(value ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("th-TH", { dateStyle: "medium" });
}

export default async function BillingPage({ searchParams }: Props) {
  await requirePermission("payment", "view");

  const { status: rawStatus } = await searchParams;
  const statusFilter = VALID_STATUSES.includes(rawStatus as InvoiceStatus)
    ? (rawStatus as InvoiceStatus)
    : null;

  const today = startOfDay(new Date());

  const [invoices, todayRevenue, pendingCount, readyGrooming, readyVisits] = await Promise.all([
    prisma.invoice.findMany({
      where: statusFilter
        ? { status: statusFilter }
        : { status: { in: ["PENDING", "WAITING_FOR_PAYMENT"] } },
      include: {
        owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
        pet: { select: { petId: true, petName: true, species: { select: { speciesName: true } } } },
        visit: { select: { visitNo: true } },
        groomingQueue: { select: { queueNumber: true, queueDate: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.invoice.aggregate({
      where: { status: "PAID", paidAt: { gte: today } },
      _sum: { paidAmount: true },
      _count: true,
    }),

    prisma.invoice.count({
      where: { status: { in: ["PENDING", "WAITING_FOR_PAYMENT"] } },
    }),

    prisma.groomingQueue.findMany({
      where: { status: "COMPLETED", queueDate: today, invoice: { is: null } },
      include: {
        owner: { select: { fullName: true } },
        pet: { select: { petName: true } },
        items: { select: { priceSnapshot: true } },
      },
      orderBy: { queueNumber: "asc" },
    }),

    prisma.visit.findMany({
      where: {
        status: "COMPLETED",
        visitDate: { gte: today },
        invoice: { is: null },
      },
      include: {
        owner: { select: { fullName: true } },
        pet: { select: { petName: true, species: { select: { speciesName: true } } } },
      },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const hasReadyItems = readyGrooming.length > 0 || readyVisits.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">การเงิน (Billing)</h1>
          <p className="mt-1 text-sm text-slate-500">จัดการการชำระเงินและใบแจ้งหนี้</p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-3xl font-bold text-amber-700">{pendingCount}</p>
            <p className="mt-1 text-sm font-medium text-amber-700">รอชำระเงิน</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-3xl font-bold text-emerald-700">{todayRevenue._count}</p>
            <p className="mt-1 text-sm font-medium text-emerald-700">ชำระแล้ววันนี้</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-3xl font-bold text-blue-700">
              {thb(todayRevenue._sum.paidAmount)}
            </p>
            <p className="mt-1 text-sm font-medium text-blue-700">รายได้วันนี้ (฿)</p>
          </div>
        </div>

        {/* Ready to Bill */}
        {hasReadyItems && (
          <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
            <h2 className="mb-3 text-sm font-semibold text-orange-800">
              รอออกใบแจ้งหนี้วันนี้
            </h2>
            <div className="space-y-2">
              {readyGrooming.map((q) => {
                const total = q.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
                const action = createInvoiceFromGrooming.bind(null, q.groomingQueueId);
                return (
                  <div
                    key={q.groomingQueueId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                        {q.queueNumber}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {q.pet.petName}{" "}
                          <span className="text-xs text-gray-400">· {q.owner.fullName}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          <span className="rounded bg-violet-50 px-1 text-violet-600">อาบน้ำตัดขน</span>{" "}
                          · ฿{thb(total)}
                        </p>
                      </div>
                    </div>
                    <form action={action}>
                      <button
                        type="submit"
                        className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        สร้างใบแจ้งหนี้
                      </button>
                    </form>
                  </div>
                );
              })}

              {readyVisits.map((v) => {
                const action = createInvoiceFromVisit.bind(null, v.visitId);
                return (
                  <div
                    key={v.visitId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        ✓
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {v.pet.petName}{" "}
                          <span className="text-xs text-gray-400">· {v.owner.fullName}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          <span className="rounded bg-blue-50 px-1 text-blue-600">การแพทย์</span>{" "}
                          · เสร็จสิ้นการรักษา
                        </p>
                      </div>
                    </div>
                    <form action={action}>
                      <button
                        type="submit"
                        className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        สร้างใบแจ้งหนี้
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { value: null, label: "รอชำระ" },
              { value: "PAID", label: "ชำระแล้ว" },
              { value: "VOIDED", label: "โมฆะ" },
            ] as { value: InvoiceStatus | null; label: string }[]
          ).map(({ value, label }) => (
            <Link
              key={value ?? "default"}
              href={value ? `/billing?status=${value}` : "/billing"}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                (statusFilter ?? null) === value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500">ไม่พบใบแจ้งหนี้</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <Link
                key={inv.invoiceId}
                href={`/billing/${inv.invoiceId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-blue-300 hover:shadow"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-800">
                        {inv.invoiceNo}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SOURCE_BADGE[inv.source]}`}>
                        {SOURCE_LABELS[inv.source]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[inv.status]}`}>
                        {STATUS_LABELS[inv.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {inv.pet.petName} ({inv.pet.species.speciesName}) · {inv.owner.fullName}
                    </p>
                    {inv.visit && (
                      <p className="text-xs text-slate-400">Visit: {inv.visit.visitNo}</p>
                    )}
                    {inv.groomingQueue && (
                      <p className="text-xs text-slate-400">
                        Grooming #{inv.groomingQueue.queueNumber} · {fmtDate(inv.groomingQueue.queueDate)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">
                    ฿{thb(inv.totalAmount)}
                  </p>
                  {inv.status === "PAID" && inv.paymentMethod && (
                    <p className="text-xs text-emerald-600">
                      {PAYMENT_METHOD_LABELS[inv.paymentMethod]}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">{fmtDate(inv.invoiceDate)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
