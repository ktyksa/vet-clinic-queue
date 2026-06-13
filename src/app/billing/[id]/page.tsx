import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  getInvoiceById,
  payInvoice,
  addInvoiceItem,
  removeInvoiceItem,
  voidInvoice,
} from "@/actions/billing.actions";
import type { InvoiceStatus, InvoiceSource, InvoiceItemType, PaymentMethod } from "@/generated/prisma/client";

interface Props {
  params: Promise<{ id: string }>;
}

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
  PENDING: "bg-amber-100 text-amber-800",
  WAITING_FOR_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  VOIDED: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "รอชำระ",
  WAITING_FOR_PAYMENT: "รอชำระ",
  PAID: "ชำระแล้ว",
  CANCELLED: "ยกเลิก",
  VOIDED: "โมฆะ",
};

const ITEM_TYPE_LABELS: Record<InvoiceItemType, string> = {
  SERVICE: "บริการ",
  MEDICATION: "ยา",
  VACCINE: "วัคซีน",
  LAB: "ผลแล็บ",
  OTHER: "อื่นๆ",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  CREDIT_CARD: "บัตรเครดิต",
  DEBIT_CARD: "บัตรเดบิต",
  TRANSFER: "โอนเงิน",
  QR_CODE: "QR Code",
  OTHER: "อื่นๆ",
};

function thb(v: unknown): string {
  return Number(String(v ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function fmt(d: Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleString("th-TH", opts ?? { dateStyle: "medium", timeStyle: "short" });
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const canEdit = ["PENDING", "WAITING_FOR_PAYMENT"].includes(invoice.status);
  const payAction = payInvoice.bind(null, invoice.invoiceId);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Back */}
        <Link href="/billing" className="text-sm text-blue-600 hover:underline">
          ← กลับ Billing
        </Link>

        {/* Header */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl font-bold text-slate-900">{invoice.invoiceNo}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SOURCE_BADGE[invoice.source]}`}>
                {SOURCE_LABELS[invoice.source]}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[invoice.status]}`}>
                {STATUS_LABELS[invoice.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              วันที่: {fmt(invoice.invoiceDate, { dateStyle: "long" })}
            </p>
          </div>
          {invoice.status === "PAID" && (
            <Link
              href={`/billing/${invoice.invoiceId}/receipt`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ใบเสร็จ (พิมพ์)
            </Link>
          )}
        </div>

        {/* Owner / Pet */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-600">เจ้าของ</h2>
            <Link href={`/owners/${invoice.owner.ownerId}`} className="text-base font-medium text-blue-600 hover:underline">
              {invoice.owner.fullName}
            </Link>
            <p className="text-sm text-slate-500">{invoice.owner.phoneNo}</p>
            {invoice.owner.email && <p className="text-sm text-slate-500">{invoice.owner.email}</p>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-600">สัตว์เลี้ยง</h2>
            <Link href={`/pets/${invoice.pet.petId}`} className="text-base font-medium text-blue-600 hover:underline">
              {invoice.pet.petName}
            </Link>
            <p className="text-sm text-slate-500">
              {invoice.pet.species.speciesName}
              {invoice.pet.breed && ` · ${invoice.pet.breed.breedName}`}
            </p>
          </div>
        </div>

        {/* Source reference */}
        {invoice.visit && (
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-3">
            <p className="text-sm text-blue-700">
              Visit:{" "}
              <Link href={`/visits/${invoice.visit.visitId}`} className="font-medium hover:underline">
                {invoice.visit.visitNo}
              </Link>
            </p>
          </div>
        )}
        {invoice.groomingQueue && (
          <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 px-5 py-3">
            <p className="text-sm text-violet-700">
              Grooming:{" "}
              <Link
                href={`/grooming/${invoice.groomingQueue.groomingQueueId}`}
                className="font-medium hover:underline"
              >
                #{invoice.groomingQueue.queueNumber} · {fmt(invoice.groomingQueue.queueDate, { dateStyle: "medium" })}
              </Link>
            </p>
          </div>
        )}

        {/* Items */}
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-700">รายการ</h2>
          </div>

          {invoice.items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">ยังไม่มีรายการ</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-5 py-2 font-medium">ประเภท</th>
                  <th className="py-2 font-medium">รายการ</th>
                  <th className="py-2 text-right font-medium">จำนวน</th>
                  <th className="py-2 text-right font-medium">ราคา/หน่วย</th>
                  <th className="py-2 pr-5 text-right font-medium">รวม</th>
                  {canEdit && <th className="py-2 pr-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoice.items.map((item) => (
                  <tr key={item.invoiceItemId}>
                    <td className="px-5 py-2.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {ITEM_TYPE_LABELS[item.itemType]}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-700">
                      {item.itemName}
                      {item.note && <span className="ml-1 text-xs text-slate-400">({item.note})</span>}
                    </td>
                    <td className="py-2.5 text-right text-slate-700">{Number(item.quantity)}</td>
                    <td className="py-2.5 text-right text-slate-700">{thb(item.unitPrice)}</td>
                    <td className="py-2.5 pr-5 text-right font-medium text-slate-800">{thb(item.totalPrice)}</td>
                    {canEdit && (
                      <td className="py-2.5 pr-3">
                        <form action={removeInvoiceItem.bind(null, item.invoiceItemId)}>
                          <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                            ลบ
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={canEdit ? 4 : 4} className="px-5 py-3 text-right text-sm font-semibold text-slate-600">
                    ราคารวม
                  </td>
                  <td className="py-3 pr-5 text-right text-sm text-slate-700">{thb(invoice.subtotal)}</td>
                  {canEdit && <td />}
                </tr>
                {Number(invoice.discount) > 0 && (
                  <tr className="bg-slate-50">
                    <td colSpan={canEdit ? 4 : 4} className="px-5 py-2 text-right text-sm font-semibold text-slate-600">
                      ส่วนลด
                    </td>
                    <td className="py-2 pr-5 text-right text-sm text-red-600">-{thb(invoice.discount)}</td>
                    {canEdit && <td />}
                  </tr>
                )}
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={canEdit ? 4 : 4} className="px-5 py-3 text-right text-base font-bold text-slate-800">
                    ยอดรวมทั้งหมด
                  </td>
                  <td className="py-3 pr-5 text-right text-base font-bold text-slate-900">
                    ฿ {thb(invoice.totalAmount)}
                  </td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Add item form */}
        {canEdit && (
          <form action={addInvoiceItem} className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              เพิ่มรายการ
            </p>
            <input type="hidden" name="invoiceId" value={invoice.invoiceId} />
            <div className="flex flex-wrap gap-2">
              <select
                name="itemType"
                defaultValue="SERVICE"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <input
                name="itemName"
                type="text"
                placeholder="ชื่อรายการ"
                required
                className="min-w-[160px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="quantity"
                type="number"
                defaultValue={1}
                min={0.001}
                step="any"
                placeholder="จำนวน"
                required
                className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="unitPrice"
                type="number"
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
        )}

        {/* Pay & Void */}
        {canEdit && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 space-y-4">
            <form action={payAction} className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-slate-700">
                ยอดที่ต้องชำระ:{" "}
                <span className="text-xl font-bold text-emerald-700">฿ {thb(invoice.totalAmount)}</span>
              </span>
              <select
                name="paymentMethod"
                defaultValue="CASH"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                รับชำระเงิน
              </button>
            </form>

            <form action={voidInvoice} className="flex items-center gap-2 border-t border-slate-200 pt-4">
              <input type="hidden" name="invoiceId" value={invoice.invoiceId} />
              <input
                name="voidReason"
                type="text"
                placeholder="เหตุผลยกเลิก (จำเป็น)"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                type="submit"
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                ยกเลิกใบแจ้งหนี้
              </button>
            </form>
          </div>
        )}

        {/* Paid info */}
        {invoice.status === "PAID" && invoice.paidAt && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-semibold text-emerald-800">ชำระเงินแล้ว</p>
            <div className="mt-2 space-y-1 text-sm text-emerald-700">
              <p>เวลา: {fmt(invoice.paidAt)}</p>
              {invoice.paymentMethod && (
                <p>วิธีชำระ: {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}</p>
              )}
              <p className="text-base font-bold">
                ยอดรับ: ฿ {thb(invoice.paidAmount ?? invoice.totalAmount)}
              </p>
            </div>
            <Link
              href={`/billing/${invoice.invoiceId}/receipt`}
              className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              พิมพ์ใบเสร็จ
            </Link>
          </div>
        )}

        {/* Voided info */}
        {invoice.status === "VOIDED" && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            ยกเลิกแล้ว: {invoice.voidReason ?? "—"}
            {invoice.voidedAt && <span className="ml-2 text-xs">({fmt(invoice.voidedAt)})</span>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
