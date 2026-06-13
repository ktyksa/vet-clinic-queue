import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import {
  dispensePrescription as dispenseNew,
} from "@/actions/prescription.actions";
import {
  markPrescriptionReady,
  dispensePrescription as dispenseOld,
  addPrescriptionItem,
  removePrescriptionItem,
  cancelPrescription,
} from "@/actions/pharmacy.actions";
import type { PrescriptionStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

function thb(v: unknown) {
  return Number(String(v ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

const STATUS_LABEL: Record<PrescriptionStatus, string> = {
  DRAFT: "ร่าง (สพ.กำลังเขียน)",
  PREPARING: "กำลังจัดยา",
  FINALIZED: "รอจ่ายยา",
  READY_FOR_DISPENSING: "พร้อมจ่าย",
  DISPENSED: "จ่ายแล้ว",
  CANCELLED: "ยกเลิก",
};

const STATUS_COLOR: Record<PrescriptionStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PREPARING: "bg-amber-50 text-amber-700",
  FINALIZED: "bg-blue-50 text-blue-700",
  READY_FOR_DISPENSING: "bg-indigo-50 text-indigo-700",
  DISPENSED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-600",
};

function PrescriptionBadge({ status }: { status: PrescriptionStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function PharmacyPage({ searchParams }: Props) {
  await requirePermission("prescription", "view");

  const { tab = "dispensing" } = await searchParams;

  const [prescriptions, dispensedToday, statusCounts, drugs] = await Promise.all([
    prisma.prescription.findMany({
      where: { status: { in: ["DRAFT", "PREPARING", "FINALIZED", "READY_FOR_DISPENSING"] } },
      include: {
        visit: {
          select: {
            visitId: true,
            visitNo: true,
            visitDate: true,
            invoice: { select: { invoiceId: true, status: true, totalAmount: true } },
          },
        },
        pet: { select: { petId: true, petName: true, species: { select: { speciesName: true } } } },
        owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
        vet: { select: { fullName: true } },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            prescriptionItemId: true,
            medicationName: true,
            dosage: true,
            frequency: true,
            duration: true,
            quantity: true,
            unit: true,
            instructions: true,
            drugId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.prescription.count({
      where: { status: "DISPENSED", dispensedAt: { gte: todayStart() } },
    }),

    prisma.prescription.groupBy({
      by: ["status"],
      _count: { status: true },
    }),

    prisma.drug.findMany({
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
    }),
  ]);

  const countOf = (s: PrescriptionStatus) =>
    statusCounts.find((x) => x.status === s)?._count.status ?? 0;

  const readyCount = countOf("FINALIZED") + countOf("READY_FOR_DISPENSING");
  const pendingCount = countOf("DRAFT") + countOf("PREPARING");
  const lowStockDrugs = drugs.filter((d) => d.isActive && d.stockQty <= d.minStock);

  const readyRx = prescriptions.filter((rx) =>
    ["FINALIZED", "READY_FOR_DISPENSING"].includes(rx.status)
  );
  const pendingRx = prescriptions.filter((rx) =>
    ["DRAFT", "PREPARING"].includes(rx.status)
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">ห้องยา (Pharmacy)</h1>
          <p className="mt-0.5 text-sm text-slate-500">จัดยาและจ่ายยาตามใบสั่งแพทย์</p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-3xl font-bold text-blue-700">{readyCount}</p>
            <p className="mt-1 text-sm font-medium text-blue-700">รอจ่ายยา</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-3xl font-bold text-amber-700">{pendingCount}</p>
            <p className="mt-1 text-sm font-medium text-amber-700">กำลังดำเนินการ</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-3xl font-bold text-emerald-700">{dispensedToday}</p>
            <p className="mt-1 text-sm font-medium text-emerald-700">จ่ายแล้ววันนี้</p>
          </div>
          <Link
            href="/pharmacy?tab=stock"
            className={`rounded-2xl border p-5 transition hover:opacity-90 ${
              lowStockDrugs.length > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
            }`}
          >
            <p className={`text-3xl font-bold ${lowStockDrugs.length > 0 ? "text-red-600" : "text-slate-700"}`}>
              {lowStockDrugs.length}
            </p>
            <p className={`mt-1 text-sm font-medium ${lowStockDrugs.length > 0 ? "text-red-600" : "text-slate-500"}`}>
              ยา stock ต่ำ{lowStockDrugs.length > 0 ? " ⚠" : ""}
            </p>
          </Link>
        </div>

        {/* Low stock alert */}
        {lowStockDrugs.length > 0 && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-3">
            <span className="text-sm font-semibold text-red-700">⚠ Stock ต่ำ: </span>
            <span className="text-sm text-red-600">
              {lowStockDrugs
                .map((d) => `${d.name} (${d.stockQty}/${d.minStock} ${d.unit})`)
                .join(" · ")}
            </span>
            <Link href="/setup/drugs" className="ml-3 text-xs font-semibold text-red-700 underline">
              จัดการ →
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex gap-2 border-b border-slate-200">
          {[
            { key: "dispensing", label: `จ่ายยา (${readyCount})` },
            { key: "pending", label: `ระหว่างดำเนินการ (${pendingCount})` },
            { key: "stock", label: `คลังยา (${drugs.filter((d) => d.isActive).length})` },
          ].map(({ key, label }) => (
            <Link
              key={key}
              href={`/pharmacy?tab=${key}`}
              className={`border-b-2 px-4 pb-2 text-sm font-semibold transition ${
                tab === key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* ── Tab: Dispensing ── */}
        {tab === "dispensing" && (
          <div className="space-y-6">
            {readyRx.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <p className="text-slate-400">ไม่มีใบสั่งยาที่รอจ่าย</p>
              </div>
            ) : (
              readyRx.map((rx) => {
                const invoice = rx.visit.invoice;
                const invoicePaid = invoice?.status === "PAID";
                const isFinalized = rx.status === "FINALIZED";
                const dispenseAction = isFinalized
                  ? dispenseNew.bind(null, rx.prescriptionId)
                  : dispenseOld.bind(null, rx.prescriptionId);

                return (
                  <div
                    key={rx.prescriptionId}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-slate-800">
                            {rx.prescriptionNo}
                          </span>
                          <PrescriptionBadge status={rx.status} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Visit:{" "}
                          <Link
                            href={`/visits/${rx.visit.visitId}/prescription`}
                            className="text-blue-600 hover:underline"
                          >
                            {rx.visit.visitNo}
                          </Link>{" "}
                          ·{" "}
                          {rx.visit.visitDate.toLocaleDateString("th-TH", { dateStyle: "medium" })}
                          {rx.vet && ` · สพ. ${rx.vet.fullName}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="font-medium text-slate-800">
                          <Link href={`/pets/${rx.pet.petId}`} className="text-blue-600 hover:underline">
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
                          </Link>
                          {rx.owner.phoneNo && ` · ${rx.owner.phoneNo}`}
                        </p>
                      </div>
                    </div>

                    {invoice && (
                      <div
                        className={`flex items-center gap-3 px-6 py-2 text-sm ${
                          invoicePaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        <span className="font-medium">
                          {invoicePaid ? "ชำระเงินแล้ว" : "รอชำระเงิน"}
                        </span>
                        <span>·</span>
                        <span>฿ {thb(invoice.totalAmount)}</span>
                        <Link
                          href={`/billing/${invoice.invoiceId}`}
                          className="ml-auto text-xs underline opacity-75 hover:opacity-100"
                        >
                          ดูใบแจ้งหนี้ →
                        </Link>
                      </div>
                    )}

                    <div className="px-6 py-4">
                      {rx.items.length === 0 ? (
                        <p className="text-sm text-slate-400">ไม่มีรายการยา</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                              <th className="pb-2 font-medium">ชื่อยา</th>
                              <th className="pb-2 font-medium">ขนาด/ครั้ง</th>
                              <th className="pb-2 font-medium">ความถี่</th>
                              <th className="pb-2 font-medium">ระยะเวลา</th>
                              <th className="pb-2 text-right font-medium">จำนวน</th>
                              <th className="pb-2 font-medium">หน่วย</th>
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
                                <td className="py-2 pr-3 text-slate-600">{item.dosage ?? "—"}</td>
                                <td className="py-2 pr-3 text-slate-600">{item.frequency ?? "—"}</td>
                                <td className="py-2 pr-3 text-slate-600">{item.duration ?? "—"}</td>
                                <td className="py-2 pr-3 text-right text-slate-700">
                                  {Number(String(item.quantity))}
                                </td>
                                <td className="py-2 text-slate-600">{item.unit ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4">
                      {invoicePaid ? (
                        <form action={dispenseAction}>
                          <button
                            type="submit"
                            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                          >
                            จ่ายยา (Dispense)
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            disabled
                            className="cursor-not-allowed rounded-lg bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-400"
                          >
                            จ่ายยา (Dispense)
                          </button>
                          <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
                            รอชำระเงินก่อน
                            <Link href="/billing" className="font-semibold underline">
                              ไปหน้าการเงิน →
                            </Link>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab: Pending (DRAFT / PREPARING) ── */}
        {tab === "pending" && (
          <div className="space-y-6">
            {pendingRx.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <p className="text-slate-400">ไม่มีใบสั่งยาที่อยู่ระหว่างดำเนินการ</p>
              </div>
            ) : (
              pendingRx.map((rx) => {
                const isDraft = rx.status === "DRAFT";
                const isPreparing = rx.status === "PREPARING";

                return (
                  <div
                    key={rx.prescriptionId}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-slate-800">
                            {rx.prescriptionNo}
                          </span>
                          <PrescriptionBadge status={rx.status} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Visit:{" "}
                          <Link
                            href={`/visits/${rx.visit.visitId}/prescription`}
                            className="text-blue-600 hover:underline"
                          >
                            {rx.visit.visitNo}
                          </Link>
                          {rx.vet && ` · สพ. ${rx.vet.fullName}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="font-medium text-slate-800">
                          {rx.pet.petName}{" "}
                          <span className="text-sm text-slate-400">({rx.pet.species.speciesName})</span>
                        </p>
                        <p className="text-sm text-slate-500">{rx.owner.fullName}</p>
                      </div>
                    </div>

                    <div className="px-6 py-4">
                      {rx.items.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          ยังไม่มีรายการยา{isPreparing ? " — เพิ่มรายการด้านล่าง" : ""}
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                              <th className="pb-2 font-medium">ชื่อยา</th>
                              <th className="pb-2 font-medium">ขนาด/ครั้ง</th>
                              <th className="pb-2 font-medium">ความถี่</th>
                              <th className="pb-2 text-right font-medium">จำนวน</th>
                              <th className="pb-2 font-medium">หน่วย</th>
                              {isPreparing && <th className="pb-2" />}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {rx.items.map((item) => (
                              <tr key={item.prescriptionItemId}>
                                <td className="py-2 pr-3 font-medium text-slate-800">
                                  {item.medicationName}
                                </td>
                                <td className="py-2 pr-3 text-slate-600">{item.dosage ?? "—"}</td>
                                <td className="py-2 pr-3 text-slate-600">{item.frequency ?? "—"}</td>
                                <td className="py-2 pr-3 text-right text-slate-700">
                                  {Number(String(item.quantity))}
                                </td>
                                <td className="py-2 text-slate-600">{item.unit ?? "—"}</td>
                                {isPreparing && (
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
                      )}
                    </div>

                    {isPreparing && (
                      <div className="space-y-4 border-t border-slate-100 bg-slate-50 px-6 py-4">
                        <form action={addPrescriptionItem} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            เพิ่มรายการยา
                          </p>
                          <input type="hidden" name="prescriptionId" value={rx.prescriptionId} />
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
                              placeholder="ขนาด"
                              className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none"
                            />
                            <input
                              type="text"
                              name="frequency"
                              placeholder="ความถี่"
                              className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none"
                            />
                            <input
                              type="number"
                              name="quantity"
                              defaultValue={1}
                              min={0.001}
                              step="any"
                              required
                              className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none"
                            />
                            <input
                              type="text"
                              name="unit"
                              placeholder="หน่วย"
                              className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                            >
                              + เพิ่ม
                            </button>
                          </div>
                        </form>

                        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
                          <form action={markPrescriptionReady.bind(null, rx.prescriptionId)}>
                            <button
                              type="submit"
                              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                            >
                              จัดยาแล้ว — พร้อมจ่าย
                            </button>
                          </form>
                          <form action={cancelPrescription} className="ml-auto flex gap-2">
                            <input type="hidden" name="prescriptionId" value={rx.prescriptionId} />
                            <input
                              type="text"
                              name="cancelReason"
                              placeholder="เหตุผลยกเลิก"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none"
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

                    {isDraft && (
                      <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
                        <Link
                          href={`/visits/${rx.visit.visitId}/prescription`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          ดูใบสั่งยา (สัตวแพทย์กำลังเขียน) →
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab: Drug Stock ── */}
        {tab === "stock" && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {drugs.filter((d) => d.isActive).length} รายการที่ใช้งาน ·{" "}
                {drugs.filter((d) => !d.isActive).length} รายการปิดใช้
              </p>
              <Link
                href="/setup/drugs"
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                จัดการคลังยา →
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">ชื่อยา / Generic</th>
                    <th className="px-3 py-3 font-medium">หน่วย</th>
                    <th className="px-3 py-3 text-right font-medium">ราคา/หน่วย</th>
                    <th className="px-3 py-3 text-right font-medium">Stock</th>
                    <th className="px-3 py-3 text-right font-medium">ต่ำสุด</th>
                    <th className="px-3 py-3 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {drugs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                        ยังไม่มีรายการยา —{" "}
                        <Link href="/setup/drugs" className="text-blue-600 hover:underline">
                          เพิ่มยาใหม่ →
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    drugs.map((d) => {
                      const isLow = d.isActive && d.stockQty <= d.minStock;
                      return (
                        <tr key={d.drugId} className={!d.isActive ? "opacity-40" : ""}>
                          <td className="px-5 py-3 font-medium text-slate-800">
                            {d.name}
                            {d.genericName && (
                              <div className="text-xs font-normal text-slate-400">
                                {d.genericName}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{d.unit}</td>
                          <td className="px-3 py-3 text-right text-slate-700">
                            ฿{thb(d.pricePerUnit)}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-bold ${
                              isLow ? "text-red-600" : "text-slate-800"
                            }`}
                          >
                            {d.stockQty}
                            {isLow && <span className="ml-1 text-[10px] text-red-500">⚠</span>}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-400">{d.minStock}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                d.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {d.isActive ? "ใช้งาน" : "ปิดใช้"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
