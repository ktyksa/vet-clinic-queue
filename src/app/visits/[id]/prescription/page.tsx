import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import {
  createPrescription,
  addPrescriptionItem,
  removePrescriptionItem,
  finalizePrescription,
  getActiveDrugs,
} from "@/actions/prescription.actions";
import type { PrescriptionStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function thb(v: unknown) {
  return Number(String(v ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

const STATUS_LABEL: Record<PrescriptionStatus, string> = {
  DRAFT: "ร่าง",
  PREPARING: "กำลังจัดยา",
  FINALIZED: "ส่งห้องยาแล้ว",
  READY_FOR_DISPENSING: "พร้อมจ่าย",
  DISPENSED: "จ่ายยาแล้ว",
  CANCELLED: "ยกเลิก",
};
const STATUS_COLOR: Record<PrescriptionStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PREPARING: "bg-amber-50 text-amber-700",
  FINALIZED: "bg-blue-50 text-blue-700",
  READY_FOR_DISPENSING: "bg-indigo-50 text-indigo-700",
  DISPENSED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-600",
};

export default async function PrescriptionPage({ params }: Props) {
  const { id: visitId } = await params;
  await requirePermission("prescription", "view");

  const visit = await prisma.visit.findUnique({
    where: { visitId },
    select: {
      visitId: true,
      visitNo: true,
      status: true,
      petId: true,
      ownerId: true,
      pet: { select: { petName: true, species: { select: { speciesName: true } } } },
      owner: { select: { fullName: true } },
      vet: { select: { fullName: true } },
      soapNote: { select: { status: true } },
      prescription: {
        select: {
          prescriptionId: true,
          prescriptionNo: true,
          status: true,
          note: true,
          dispensedAt: true,
          createdAt: true,
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
              pricePerUnit: true,
              instructions: true,
              drugId: true,
              drug: { select: { name: true, stockQty: true, unit: true } },
            },
          },
        },
      },
    },
  });

  if (!visit) notFound();

  const rx = visit.prescription;
  const soapFinalized = visit.soapNote?.status === "FINALIZED";
  const canCreate = !rx && soapFinalized;
  const isDraft = rx?.status === "DRAFT";
  const isFinalized = rx?.status === "FINALIZED";
  const isDispensed = rx?.status === "DISPENSED";

  const drugs = isDraft ? await getActiveDrugs() : [];

  const totalPrice = rx?.items.reduce(
    (sum, i) => sum + Number(String(i.quantity)) * Number(String(i.pricePerUnit ?? 0)),
    0
  ) ?? 0;

  const createAction = createPrescription.bind(null, visitId);
  const finalizeAction = rx ? finalizePrescription.bind(null, rx.prescriptionId) : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href={`/visits/${visitId}/soap`}
            className="text-sm font-medium text-slate-500 hover:text-blue-600"
          >
            ← กลับ SOAP
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              ใบสั่งยา (Prescription)
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Visit: <span className="font-semibold text-slate-700">{visit.visitNo}</span>
              {" · "}
              {visit.pet.petName} ({visit.pet.species?.speciesName ?? "?"})
              {" · "}
              {visit.owner.fullName}
              {visit.vet && ` · สพ. ${visit.vet.fullName}`}
            </p>
          </div>
          {rx && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400">{rx.prescriptionNo}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[rx.status]}`}>
                {STATUS_LABEL[rx.status]}
              </span>
            </div>
          )}
        </div>

        {/* SOAP not finalized warning */}
        {!soapFinalized && !rx && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-center">
            <p className="font-semibold text-amber-800">กรุณา Finalize SOAP ก่อนสร้างใบสั่งยา</p>
            <Link
              href={`/visits/${visitId}/soap`}
              className="mt-2 inline-block rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              ไปที่ SOAP →
            </Link>
          </div>
        )}

        {/* Create prescription */}
        {canCreate && (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-6 py-6 text-center">
            <p className="mb-3 font-semibold text-blue-800">ยังไม่มีใบสั่งยาสำหรับ Visit นี้</p>
            <form action={createAction}>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                สร้างใบสั่งยา
              </button>
            </form>
          </div>
        )}

        {/* Prescription exists */}
        {rx && (
          <div className="space-y-5">
            {/* Items table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="font-semibold text-slate-800">รายการยา</h2>
              </div>

              {rx.items.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-slate-400">
                  ยังไม่มีรายการยา{isDraft ? " — เพิ่มรายการด้านล่าง" : ""}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="px-6 py-3 font-medium">ชื่อยา</th>
                      <th className="px-3 py-3 font-medium">ขนาดยา</th>
                      <th className="px-3 py-3 font-medium">ความถี่</th>
                      <th className="px-3 py-3 font-medium">ระยะเวลา</th>
                      <th className="px-3 py-3 text-right font-medium">จำนวน</th>
                      <th className="px-3 py-3 font-medium">หน่วย</th>
                      <th className="px-3 py-3 text-right font-medium">ราคา/หน่วย</th>
                      {isDraft && <th className="px-6 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rx.items.map((item) => {
                      const removeAction = removePrescriptionItem.bind(
                        null,
                        item.prescriptionItemId
                      );
                      return (
                        <tr key={item.prescriptionItemId}>
                          <td className="px-6 py-3 font-medium text-slate-800">
                            {item.medicationName}
                            {item.drug && (
                              <span className="ml-1 text-xs text-slate-400">
                                (stock: {item.drug.stockQty})
                              </span>
                            )}
                            {item.instructions && (
                              <div className="text-xs font-normal text-slate-400">
                                {item.instructions}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{item.dosage ?? "—"}</td>
                          <td className="px-3 py-3 text-slate-600">{item.frequency ?? "—"}</td>
                          <td className="px-3 py-3 text-slate-600">{item.duration ?? "—"}</td>
                          <td className="px-3 py-3 text-right text-slate-700">
                            {Number(String(item.quantity))}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{item.unit ?? "—"}</td>
                          <td className="px-3 py-3 text-right text-slate-600">
                            {item.pricePerUnit ? `฿${thb(item.pricePerUnit)}` : "—"}
                          </td>
                          {isDraft && (
                            <td className="px-6 py-3">
                              <form action={removeAction}>
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
                      );
                    })}
                  </tbody>
                  {totalPrice > 0 && (
                    <tfoot>
                      <tr className="border-t border-slate-200">
                        <td colSpan={isDraft ? 8 : 7} className="px-6 py-3 text-right text-sm font-semibold text-slate-800">
                          มูลค่ารวม: ฿{thb(totalPrice)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>

            {/* Add item form (DRAFT only) */}
            {isDraft && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h2 className="font-semibold text-slate-800">เพิ่มรายการยา</h2>
                </div>
                <form
                  action={addPrescriptionItem.bind(null, rx.prescriptionId)}
                  className="space-y-4 px-6 py-5"
                >
                  {/* Drug selector */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        เลือกจากคลังยา
                      </label>
                      <select
                        name="drugId"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        onChange={undefined}
                      >
                        <option value="">— ระบุเองด้านล่าง —</option>
                        {drugs.map((d) => (
                          <option key={d.drugId} value={d.drugId}>
                            {d.name}
                            {d.genericName ? ` (${d.genericName})` : ""}
                            {" · "}฿{Number(String(d.pricePerUnit)).toLocaleString("th-TH")}/{d.unit}
                            {" · stock "}
                            {d.stockQty}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-slate-400">
                        เลือกจากคลัง → ระบบเติมชื่อ/หน่วย/ราคาให้อัตโนมัติ
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        ชื่อยา (กรณีไม่มีในคลัง)
                      </label>
                      <input
                        type="text"
                        name="medicationName"
                        placeholder="ชื่อยา (ถ้าเลือกจากคลัง ไม่ต้องกรอก)"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ขนาดยา/ครั้ง</label>
                      <input
                        type="text"
                        name="dosage"
                        placeholder="เช่น 1 เม็ด, 5 ml"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ความถี่</label>
                      <input
                        type="text"
                        name="frequency"
                        placeholder="เช่น วันละ 2 ครั้ง"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ระยะเวลา (วัน)</label>
                      <input
                        type="number"
                        name="durationDays"
                        min={1}
                        placeholder="จำนวนวัน"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">จำนวน *</label>
                      <input
                        type="number"
                        name="quantity"
                        defaultValue={1}
                        min={0.001}
                        step="any"
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">คำแนะนำพิเศษ</label>
                    <input
                      type="text"
                      name="instructions"
                      placeholder="เช่น หลังอาหาร, ห้ามให้กับแมวที่ตั้งท้อง"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                    >
                      + เพิ่มรายการ
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Finalize action */}
            {isDraft && finalizeAction && (
              <div className="flex justify-end gap-3">
                <Link
                  href={`/visits/${visitId}/soap`}
                  className="rounded-lg border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  กลับ SOAP
                </Link>
                <form action={finalizeAction}>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Finalize ส่งห้องยา →
                  </button>
                </form>
              </div>
            )}

            {/* Finalized state */}
            {isFinalized && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5">
                <p className="font-semibold text-blue-800">
                  ส่งห้องยาแล้ว — รอห้องยาจัดยา
                </p>
                <p className="mt-1 text-sm text-blue-600">
                  ใบสั่งยาถูกส่งไปที่ห้องยาแล้ว สามารถติดตามได้ที่{" "}
                  <Link href="/pharmacy" className="underline hover:text-blue-800">
                    ห้องยา →
                  </Link>
                </p>
              </div>
            )}

            {/* Dispensed state */}
            {isDispensed && rx.dispensedAt && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-5">
                <p className="font-semibold text-emerald-800">จ่ายยาแล้ว</p>
                <p className="mt-1 text-sm text-emerald-600">
                  จ่ายยาเมื่อ{" "}
                  {new Date(rx.dispensedAt).toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
