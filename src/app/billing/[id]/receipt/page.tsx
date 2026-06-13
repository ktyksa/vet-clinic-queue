import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoiceById } from "@/actions/billing.actions";
import { PrintButton } from "./PrintButton";
import type { InvoiceSource, InvoiceItemType, PaymentMethod } from "@/generated/prisma/client";

interface Props {
  params: Promise<{ id: string }>;
}

const SOURCE_LABELS: Record<InvoiceSource, string> = {
  MEDICAL: "การแพทย์",
  GROOMING: "อาบน้ำตัดขน",
  RETAIL: "ร้านค้า",
  MIXED: "รวม",
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
  return new Date(d).toLocaleString("th-TH", opts ?? { dateStyle: "long" });
}

export default async function ReceiptPage({ params }: Props) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const isPaid = invoice.status === "PAID";

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Controls */}
      <div className="flex items-center gap-3 bg-white px-6 py-3 shadow-sm print:hidden">
        <Link href={`/billing/${invoice.invoiceId}`} className="text-sm text-blue-600 hover:underline">
          ← กลับ
        </Link>
        <span className="text-slate-300">|</span>
        <span className="text-sm text-slate-500">{invoice.invoiceNo}</span>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      {/* Receipt */}
      <div className="mx-auto max-w-2xl bg-white px-10 py-10 print:max-w-full print:px-8 print:py-6 print:shadow-none md:my-6 md:shadow-lg">
        {/* Clinic header */}
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900">คลินิกสัตวแพทย์</p>
          <p className="mt-1 text-sm text-slate-500">Veterinary Clinic</p>
          <div className="mx-auto mt-4 h-px w-24 bg-slate-200" />
        </div>

        {/* Title */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-800">
            {isPaid ? "ใบเสร็จรับเงิน" : "ใบแจ้งหนี้"}
          </h1>
          <p className="text-xs text-slate-400">{isPaid ? "Receipt" : "Invoice"}</p>
        </div>

        {/* Invoice meta */}
        <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="text-slate-500">เลขที่ใบเสร็จ</div>
          <div className="font-mono font-semibold text-slate-900">{invoice.invoiceNo}</div>
          <div className="text-slate-500">วันที่</div>
          <div className="text-slate-900">{fmt(invoice.invoiceDate)}</div>
          <div className="text-slate-500">ประเภท</div>
          <div className="text-slate-900">{SOURCE_LABELS[invoice.source]}</div>
          {isPaid && invoice.paidAt && (
            <>
              <div className="text-slate-500">วันที่ชำระ</div>
              <div className="text-slate-900">{fmt(invoice.paidAt, { dateStyle: "long", timeStyle: "short" })}</div>
            </>
          )}
          {isPaid && invoice.paymentMethod && (
            <>
              <div className="text-slate-500">วิธีชำระ</div>
              <div className="text-slate-900">{PAYMENT_METHOD_LABELS[invoice.paymentMethod]}</div>
            </>
          )}
        </div>

        <div className="mb-6 h-px bg-slate-200" />

        {/* Owner / Pet */}
        <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="text-slate-500">เจ้าของ</div>
          <div className="font-medium text-slate-900">{invoice.owner.fullName}</div>
          <div className="text-slate-500">เบอร์โทร</div>
          <div className="text-slate-900">{invoice.owner.phoneNo}</div>
          <div className="text-slate-500">สัตว์เลี้ยง</div>
          <div className="text-slate-900">
            {invoice.pet.petName}{" "}
            <span className="text-slate-500">({invoice.pet.species.speciesName})</span>
          </div>
          {invoice.visit && (
            <>
              <div className="text-slate-500">Visit No.</div>
              <div className="font-mono text-slate-900">{invoice.visit.visitNo}</div>
            </>
          )}
          {invoice.groomingQueue && (
            <>
              <div className="text-slate-500">Grooming #</div>
              <div className="text-slate-900">
                #{invoice.groomingQueue.queueNumber} ·{" "}
                {fmt(invoice.groomingQueue.queueDate, { dateStyle: "medium" })}
              </div>
            </>
          )}
        </div>

        <div className="mb-6 h-px bg-slate-200" />

        {/* Items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="pb-2 font-medium">รายการ</th>
              <th className="pb-2 text-center font-medium">จำนวน</th>
              <th className="pb-2 text-right font-medium">ราคา/หน่วย</th>
              <th className="pb-2 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.invoiceItemId}>
                <td className="py-2 text-slate-700">
                  <span className="text-xs text-slate-400">[{ITEM_TYPE_LABELS[item.itemType]}]</span>{" "}
                  {item.itemName}
                  {item.note && <span className="ml-1 text-xs text-slate-400">({item.note})</span>}
                </td>
                <td className="py-2 text-center text-slate-700">{Number(item.quantity)}</td>
                <td className="py-2 text-right text-slate-700">{thb(item.unitPrice)}</td>
                <td className="py-2 text-right font-medium text-slate-800">{thb(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="flex justify-between text-sm text-slate-600">
            <span>ราคารวม</span>
            <span>฿ {thb(invoice.subtotal)}</span>
          </div>
          {Number(invoice.discount) > 0 && (
            <div className="mt-1 flex justify-between text-sm text-red-600">
              <span>ส่วนลด</span>
              <span>-฿ {thb(invoice.discount)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>ยอดรวมทั้งหมด</span>
            <span>฿ {thb(invoice.totalAmount)}</span>
          </div>
          {isPaid && (
            <div className="mt-1 flex justify-between text-sm font-semibold text-emerald-700">
              <span>ยอดรับชำระ</span>
              <span>฿ {thb(invoice.paidAmount ?? invoice.totalAmount)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-slate-400">
          <p>ขอบคุณที่ใช้บริการ / Thank you for your visit</p>
          {isPaid && (
            <p className="mt-1 font-medium text-emerald-600">ชำระเงินแล้ว / PAID</p>
          )}
        </div>
      </div>
    </div>
  );
}
