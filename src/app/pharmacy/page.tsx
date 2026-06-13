import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import {
  markPrescriptionReady,
  dispensePrescription,
  addPrescriptionItem,
  removePrescriptionItem,
  cancelPrescription,
} from "@/actions/pharmacy.actions";
import type { PrescriptionStatus, InvoiceStatus } from "@/generated/prisma/client";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

const VALID_STATUSES: PrescriptionStatus[] = [
  "PREPARING",
  "READY_FOR_DISPENSING",
  "DISPENSED",
  "CANCELLED",
];

export default async function PharmacyPage({ searchParams }: Props) {
  await requirePermission("prescription", "view");

  const { status: rawStatus } = await searchParams;
  const statusFilter = VALID_STATUSES.includes(rawStatus as PrescriptionStatus)
    ? (rawStatus as PrescriptionStatus)
    : null;

  const [prescriptions, stats] = await Promise.all([
    prisma.prescription.findMany({
      where: statusFilter
        ? { status: statusFilter }
        : { status: { in: ["PREPARING", "READY_FOR_DISPENSING"] } },
      include: {
        visit: {
          select: {
            visitNo: true,
            visitDate: true,
            invoice: { select: { invoiceId: true, status: true, totalAmount: true } },
          },
        },
        pet: {
          select: {
            petId: true,
            petName: true,
            species: { select: { speciesName: true } },
          },
        },
        owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
        vet: { select: { fullName: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.prescription.groupBy({
      by: ["status"],
      _count: { status: true },
      where: { status: { in: ["PREPARING", "READY_FOR_DISPENSING", "DISPENSED"] } },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    stats.map((s) => [s.status, s._count.status]),
  ) as Partial<Record<PrescriptionStatus, number>>;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">ห้องยา (Pharmacy)</h1>
          <p className="mt-1 text-sm text-slate-500">
            จัดการใบสั่งยาและการจ่ายยา
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/pharmacy?status=PREPARING"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 transition hover:opacity-80"
          >
            <p className="text-3xl font-bold text-amber-700">
              {countByStatus["PREPARING"] ?? 0}
            </p>
            <p className="mt-1 text-sm font-medium text-amber-700">กำลังจัดยา</p>
          </Link>

          <Link
            href="/pharmacy?status=READY_FOR_DISPENSING"
            className="rounded-2xl border border-blue-200 bg-blue-50 p-5 transition hover:opacity-80"
          >
            <p className="text-3xl font-bold text-blue-700">
              {countByStatus["READY_FOR_DISPENSING"] ?? 0}
            </p>
            <p className="mt-1 text-sm font-medium text-blue-700">
              พร้อมจ่าย (รอจ่ายยา)
            </p>
          </Link>

          <Link
            href="/pharmacy?status=DISPENSED"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 transition hover:opacity-80"
          >
            <p className="text-3xl font-bold text-emerald-700">
              {countByStatus["DISPENSED"] ?? 0}
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-700">
              จ่ายยาแล้ว (วันนี้)
            </p>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { value: null, label: "Active (ค่าเริ่มต้น)" },
              { value: "PREPARING", label: "กำลังจัดยา" },
              { value: "READY_FOR_DISPENSING", label: "พร้อมจ่าย" },
              { value: "DISPENSED", label: "จ่ายแล้ว" },
              { value: "CANCELLED", label: "ยกเลิก" },
            ] as { value: PrescriptionStatus | null; label: string }[]
          ).map(({ value, label }) => (
            <Link
              key={value ?? "all"}
              href={
                value ? `/pharmacy?status=${value}` : "/pharmacy"
              }
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

        {/* Prescription list */}
        {prescriptions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500">ไม่พบใบสั่งยา</p>
          </div>
        ) : (
          <div className="space-y-6">
            {prescriptions.map((rx) => {
              const invoice = rx.visit.invoice;
              const invoicePaid = invoice?.status === "PAID";
              const canDispense =
                rx.status === "READY_FOR_DISPENSING" && invoicePaid;

              return (
                <div
                  key={rx.prescriptionId}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-slate-800">
                          {rx.prescriptionNo}
                        </span>
                        <PrescriptionStatusBadge status={rx.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Visit:{" "}
                        <span className="text-blue-600">{rx.visit.visitNo}</span>{" "}
                        ·{" "}
                        {rx.visit.visitDate.toLocaleDateString("th-TH", {
                          dateStyle: "medium",
                        })}{" "}
                        · สัตวแพทย์: {rx.vet.fullName}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <p className="font-medium text-slate-800">
                        <Link
                          href={`/pets/${rx.pet.petId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {rx.pet.petName}
                        </Link>{" "}
                        <span className="text-sm text-slate-400">
                          ({rx.pet.species.speciesName})
                        </span>
                      </p>
                      <p className="text-sm text-slate-500">
                        <Link
                          href={`/owners/${rx.owner.ownerId}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {rx.owner.fullName}
                        </Link>{" "}
                        · {rx.owner.phoneNo}
                      </p>
                    </div>
                  </div>

                  {/* Invoice payment status banner */}
                  {invoice && (
                    <div
                      className={`flex items-center gap-3 px-6 py-2 text-sm ${
                        invoicePaid
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      <span className="font-medium">
                        {invoicePaid ? "ชำระเงินแล้ว" : "รอชำระเงิน"}
                      </span>
                      <span>·</span>
                      <span>
                        ฿{" "}
                        {Number(invoice.totalAmount).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <Link
                        href="/billing"
                        className="ml-auto text-xs underline opacity-75 hover:opacity-100"
                      >
                        ไปหน้าการเงิน →
                      </Link>
                    </div>
                  )}

                  {/* Items */}
                  <div className="px-6 py-4">
                    {rx.items.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                            <th className="pb-2 font-medium">ชื่อยา</th>
                            <th className="pb-2 font-medium">ขนาด/ครั้ง</th>
                            <th className="pb-2 font-medium">ความถี่</th>
                            <th className="pb-2 font-medium">ระยะเวลา</th>
                            <th className="pb-2 text-right font-medium">
                              จำนวน
                            </th>
                            <th className="pb-2 font-medium">หน่วย</th>
                            {rx.status === "PREPARING" && <th className="pb-2" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {rx.items.map((item) => (
                            <tr key={item.prescriptionItemId}>
                              <td className="py-2 pr-3 font-medium text-slate-800">
                                {item.medicationName}
                                {item.instructions && (
                                  <div className="text-xs font-normal text-slate-400">
                                    {item.instructions}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-slate-600">
                                {item.dosage ?? "-"}
                              </td>
                              <td className="py-2 pr-3 text-slate-600">
                                {item.frequency ?? "-"}
                              </td>
                              <td className="py-2 pr-3 text-slate-600">
                                {item.duration ?? "-"}
                              </td>
                              <td className="py-2 pr-3 text-right text-slate-700">
                                {Number(item.quantity)}
                              </td>
                              <td className="py-2 text-slate-600">
                                {item.unit ?? "-"}
                              </td>
                              {rx.status === "PREPARING" && (
                                <td className="py-2 pl-3">
                                  <form
                                    action={removePrescriptionItem.bind(
                                      null,
                                      item.prescriptionItemId,
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
                      </table>
                    ) : (
                      <p className="text-sm text-slate-400">
                        ยังไม่มีรายการยา
                        {rx.status === "PREPARING" && " — เพิ่มรายการด้านล่าง"}
                      </p>
                    )}
                  </div>

                  {/* Actions for PREPARING */}
                  {rx.status === "PREPARING" && (
                    <div className="space-y-4 border-t border-slate-100 bg-slate-50 px-6 py-4">
                      {/* Add item form */}
                      <form action={addPrescriptionItem} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          เพิ่มรายการยา
                        </p>
                        <input
                          type="hidden"
                          name="prescriptionId"
                          value={rx.prescriptionId}
                        />
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            name="medicationName"
                            placeholder="ชื่อยา *"
                            required
                            className="min-w-[140px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            name="dosage"
                            placeholder="ขนาด (เช่น 10mg)"
                            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            name="frequency"
                            placeholder="ความถี่ (เช่น วันละ 2 ครั้ง)"
                            className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            name="duration"
                            placeholder="ระยะเวลา (เช่น 7 วัน)"
                            className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            name="quantity"
                            defaultValue={1}
                            min={0.001}
                            step="any"
                            placeholder="จำนวน"
                            required
                            className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            name="unit"
                            placeholder="หน่วย (เม็ด/ml)"
                            className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                          >
                            + เพิ่ม
                          </button>
                        </div>
                        <input
                          type="text"
                          name="instructions"
                          placeholder="คำแนะนำพิเศษ"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </form>

                      {/* Mark ready + cancel */}
                      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
                        <form
                          action={markPrescriptionReady.bind(
                            null,
                            rx.prescriptionId,
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                          >
                            จัดยาแล้ว — พร้อมจ่าย
                          </button>
                        </form>

                        <form action={cancelPrescription} className="ml-auto flex gap-2">
                          <input
                            type="hidden"
                            name="prescriptionId"
                            value={rx.prescriptionId}
                          />
                          <input
                            type="text"
                            name="cancelReason"
                            placeholder="เหตุผลยกเลิก"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            ยกเลิก
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Actions for READY_FOR_DISPENSING */}
                  {rx.status === "READY_FOR_DISPENSING" && (
                    <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4">
                      {canDispense ? (
                        <form
                          action={dispensePrescription.bind(
                            null,
                            rx.prescriptionId,
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            จ่ายยา (Dispense)
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-lg bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-400"
                          >
                            จ่ายยา (Dispense)
                          </button>
                          <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
                            <span>รอชำระเงินก่อน</span>
                            <Link
                              href="/billing"
                              className="font-semibold underline"
                            >
                              ไปหน้าการเงิน →
                            </Link>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dispensed info */}
                  {rx.status === "DISPENSED" && rx.dispensedAt && (
                    <div className="border-t border-slate-100 bg-emerald-50 px-6 py-3 text-sm text-emerald-700">
                      จ่ายยาแล้วเมื่อ{" "}
                      {rx.dispensedAt.toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  )}

                  {/* Cancelled info */}
                  {rx.status === "CANCELLED" && (
                    <div className="border-t border-slate-100 bg-red-50 px-6 py-3 text-sm text-red-700">
                      ยกเลิกแล้ว: {rx.cancelReason ?? "-"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  const styles: Record<PrescriptionStatus, string> = {
    PREPARING: "bg-amber-50 text-amber-700",
    READY_FOR_DISPENSING: "bg-blue-50 text-blue-700",
    DISPENSED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-red-50 text-red-600",
  };

  const labels: Record<PrescriptionStatus, string> = {
    PREPARING: "กำลังจัดยา",
    READY_FOR_DISPENSING: "พร้อมจ่าย",
    DISPENSED: "จ่ายแล้ว",
    CANCELLED: "ยกเลิก",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
