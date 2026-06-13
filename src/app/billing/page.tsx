import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import {
  markInvoicePaid,
  addInvoiceItem,
  removeInvoiceItem,
  voidInvoice,
} from "@/actions/billing.actions";
import type {
  InvoiceStatus,
  InvoiceItemType,
  PaymentMethod,
} from "@/generated/prisma/client";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

const VALID_STATUSES: InvoiceStatus[] = ["WAITING_FOR_PAYMENT", "PAID", "VOIDED"];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  CREDIT_CARD: "บัตรเครดิต",
  DEBIT_CARD: "บัตรเดบิต",
  TRANSFER: "โอนเงิน",
  OTHER: "อื่นๆ",
};

const ITEM_TYPE_LABELS: Record<InvoiceItemType, string> = {
  SERVICE: "บริการ",
  MEDICATION: "ยา",
  VACCINE: "วัคซีน",
  LAB: "ผลแล็บ",
  OTHER: "อื่นๆ",
};

export default async function BillingPage({ searchParams }: Props) {
  await requirePermission("payment", "view");

  const { status: rawStatus } = await searchParams;
  const statusFilter = VALID_STATUSES.includes(rawStatus as InvoiceStatus)
    ? (rawStatus as InvoiceStatus)
    : null;

  const [invoices, stats, todayRevenue] = await Promise.all([
    prisma.invoice.findMany({
      where: statusFilter
        ? { status: statusFilter }
        : { status: "WAITING_FOR_PAYMENT" },
      include: {
        visit: { select: { visitNo: true, visitDate: true } },
        pet: {
          select: {
            petId: true,
            petName: true,
            species: { select: { speciesName: true } },
          },
        },
        owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      _count: { status: true },
      where: { status: { in: ["WAITING_FOR_PAYMENT", "PAID"] } },
    }),
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return prisma.invoice.aggregate({
        where: { status: "PAID", paidAt: { gte: today } },
        _sum: { paidAmount: true },
        _count: true,
      });
    })(),
  ]);

  const countByStatus = Object.fromEntries(
    stats.map((s) => [s.status, s._count.status]),
  ) as Partial<Record<InvoiceStatus, number>>;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">การเงิน (Billing)</h1>
          <p className="mt-1 text-sm text-slate-500">
            จัดการการชำระเงินและใบแจ้งหนี้
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/billing?status=WAITING_FOR_PAYMENT"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 transition hover:opacity-80"
          >
            <p className="text-3xl font-bold text-amber-700">
              {countByStatus["WAITING_FOR_PAYMENT"] ?? 0}
            </p>
            <p className="mt-1 text-sm font-medium text-amber-700">รอชำระเงิน</p>
          </Link>

          <Link
            href="/billing?status=PAID"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 transition hover:opacity-80"
          >
            <p className="text-3xl font-bold text-emerald-700">
              {todayRevenue._count}
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-700">ชำระแล้ววันนี้</p>
          </Link>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-3xl font-bold text-blue-700">
              {Number(todayRevenue._sum.paidAmount ?? 0).toLocaleString("th-TH", {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-sm font-medium text-blue-700">รายได้วันนี้ (฿)</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { value: null, label: "รอชำระ (ค่าเริ่มต้น)" },
              { value: "WAITING_FOR_PAYMENT", label: "WAITING_FOR_PAYMENT" },
              { value: "PAID", label: "PAID" },
              { value: "VOIDED", label: "VOIDED" },
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
          <div className="space-y-6">
            {invoices.map((invoice) => (
              <div
                key={invoice.invoiceId}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Invoice header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-slate-800">
                        {invoice.invoiceNo}
                      </span>
                      <InvoiceStatusBadge status={invoice.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Visit:{" "}
                      <Link
                        href={`/visits/${invoice.visit.visitNo}`}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.visit.visitNo}
                      </Link>{" "}
                      ·{" "}
                      {invoice.visit.visitDate.toLocaleDateString("th-TH", {
                        dateStyle: "medium",
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-medium text-slate-800">
                      <Link
                        href={`/pets/${invoice.pet.petId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.pet.petName}
                      </Link>{" "}
                      <span className="text-sm text-slate-400">
                        ({invoice.pet.species.speciesName})
                      </span>
                    </p>
                    <p className="text-sm text-slate-500">
                      <Link
                        href={`/owners/${invoice.owner.ownerId}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {invoice.owner.fullName}
                      </Link>{" "}
                      · {invoice.owner.phoneNo}
                    </p>
                  </div>
                </div>

                {/* Items table */}
                <div className="px-6 py-4">
                  {invoice.items.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                          <th className="pb-2 font-medium">ประเภท</th>
                          <th className="pb-2 font-medium">รายการ</th>
                          <th className="pb-2 text-right font-medium">จำนวน</th>
                          <th className="pb-2 text-right font-medium">ราคา/หน่วย</th>
                          <th className="pb-2 text-right font-medium">รวม</th>
                          {invoice.status === "WAITING_FOR_PAYMENT" && (
                            <th className="pb-2" />
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {invoice.items.map((item) => (
                          <tr key={item.invoiceItemId}>
                            <td className="py-1.5 pr-3">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                {ITEM_TYPE_LABELS[item.itemType]}
                              </span>
                            </td>
                            <td className="py-1.5 pr-3 text-slate-700">
                              {item.itemName}
                              {item.note && (
                                <span className="ml-1 text-xs text-slate-400">
                                  ({item.note})
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-slate-700">
                              {Number(item.quantity)}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-slate-700">
                              {Number(item.unitPrice).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-1.5 text-right font-medium text-slate-800">
                              {Number(item.totalPrice).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            {invoice.status === "WAITING_FOR_PAYMENT" && (
                              <td className="py-1.5 pl-3">
                                <form
                                  action={removeInvoiceItem.bind(
                                    null,
                                    item.invoiceItemId,
                                  )}
                                >
                                  <button
                                    type="submit"
                                    className="text-xs text-red-500 hover:text-red-700"
                                  >
                                    ลบ
                                  </button>
                                </form>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200">
                          <td
                            colSpan={
                              invoice.status === "WAITING_FOR_PAYMENT" ? 4 : 4
                            }
                            className="pt-3 text-right text-sm font-semibold text-slate-600"
                          >
                            ยอดรวมทั้งหมด
                          </td>
                          <td className="pt-3 text-right text-base font-bold text-slate-900">
                            ฿{" "}
                            {Number(invoice.totalAmount).toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          {invoice.status === "WAITING_FOR_PAYMENT" && (
                            <td />
                          )}
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-400">
                      ยังไม่มีรายการ — เพิ่มรายการด้านล่าง
                    </p>
                  )}
                </div>

                {/* Actions for WAITING_FOR_PAYMENT */}
                {invoice.status === "WAITING_FOR_PAYMENT" && (
                  <div className="space-y-4 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    {/* Add item form */}
                    <form action={addInvoiceItem} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        เพิ่มรายการ
                      </p>
                      <input
                        type="hidden"
                        name="invoiceId"
                        value={invoice.invoiceId}
                      />
                      <div className="flex flex-wrap gap-2">
                        <select
                          name="itemType"
                          defaultValue="SERVICE"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(ITEM_TYPE_LABELS).map(
                            ([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>

                        <input
                          type="text"
                          name="itemName"
                          placeholder="ชื่อรายการ"
                          required
                          className="min-w-[160px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <input
                          type="number"
                          name="quantity"
                          defaultValue={1}
                          min={0.001}
                          step="any"
                          placeholder="จำนวน"
                          required
                          className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <input
                          type="number"
                          name="unitPrice"
                          defaultValue={0}
                          min={0}
                          step="any"
                          placeholder="ราคา/หน่วย"
                          required
                          className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <button
                          type="submit"
                          className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          + เพิ่ม
                        </button>
                      </div>
                    </form>

                    {/* Pay form */}
                    <form
                      action={markInvoicePaid}
                      className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4"
                    >
                      <input
                        type="hidden"
                        name="invoiceId"
                        value={invoice.invoiceId}
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        ยอดที่ต้องชำระ:{" "}
                        <span className="text-xl font-bold text-emerald-700">
                          ฿{" "}
                          {Number(invoice.totalAmount).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </span>

                      <select
                        name="paymentMethod"
                        defaultValue="CASH"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {Object.entries(PAYMENT_METHOD_LABELS).map(
                          ([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>

                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        รับชำระเงิน
                      </button>

                      {/* Void */}
                      <form action={voidInvoice} className="ml-auto flex gap-2">
                        <input
                          type="hidden"
                          name="invoiceId"
                          value={invoice.invoiceId}
                        />
                        <input
                          type="text"
                          name="voidReason"
                          placeholder="เหตุผลยกเลิก"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          ยกเลิกใบแจ้งหนี้
                        </button>
                      </form>
                    </form>
                  </div>
                )}

                {/* Paid info */}
                {invoice.status === "PAID" && invoice.paidAt && (
                  <div className="flex items-center gap-4 border-t border-slate-100 bg-emerald-50 px-6 py-3 text-sm text-emerald-700">
                    <span>
                      ชำระเมื่อ{" "}
                      {invoice.paidAt.toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    {invoice.paymentMethod && (
                      <span>· {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}</span>
                    )}
                    <span className="font-semibold">
                      ฿{" "}
                      {Number(invoice.paidAmount ?? invoice.totalAmount).toLocaleString(
                        "th-TH",
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                  </div>
                )}

                {/* Voided info */}
                {invoice.status === "VOIDED" && (
                  <div className="border-t border-slate-100 bg-red-50 px-6 py-3 text-sm text-red-700">
                    ยกเลิกแล้ว: {invoice.voidReason ?? "-"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    WAITING_FOR_PAYMENT: "bg-amber-50 text-amber-700",
    PAID: "bg-emerald-50 text-emerald-700",
    VOIDED: "bg-red-50 text-red-600",
  };

  const labels: Record<InvoiceStatus, string> = {
    WAITING_FOR_PAYMENT: "รอชำระ",
    PAID: "ชำระแล้ว",
    VOIDED: "ยกเลิก",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
