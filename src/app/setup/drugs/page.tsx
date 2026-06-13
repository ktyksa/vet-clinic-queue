import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// ── Server Actions ────────────────────────────────────────────────────────────

async function createDrug(formData: FormData) {
  "use server";
  const currentUser = await requirePermission("prescription", "create");

  const name = String(formData.get("name") ?? "").trim();
  const genericName = String(formData.get("genericName") ?? "").trim() || null;
  const unit = String(formData.get("unit") ?? "").trim();
  const stockQty = parseInt(String(formData.get("stockQty") ?? "0"), 10);
  const minStock = parseInt(String(formData.get("minStock") ?? "10"), 10);
  const pricePerUnit = parseFloat(String(formData.get("pricePerUnit") ?? "0"));

  if (!name) throw new Error("กรุณาระบุชื่อยา");
  if (!unit) throw new Error("กรุณาระบุหน่วย");
  if (pricePerUnit < 0) throw new Error("ราคาต้องไม่ติดลบ");

  await prisma.drug.create({
    data: {
      name,
      genericName,
      unit,
      stockQty,
      minStock,
      pricePerUnit,
      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  revalidatePath("/setup/drugs");
}

async function adjustStock(formData: FormData) {
  "use server";
  const currentUser = await requirePermission("prescription", "update");

  const drugId = String(formData.get("drugId") ?? "").trim();
  const delta = parseInt(String(formData.get("delta") ?? "0"), 10);

  if (!drugId) throw new Error("ไม่พบ Drug ID");

  await prisma.drug.update({
    where: { drugId },
    data: {
      stockQty: { increment: delta },
      updatedByUserId: currentUser.userId,
    },
  });

  revalidatePath("/setup/drugs");
}

async function toggleDrugActive(formData: FormData) {
  "use server";
  const currentUser = await requirePermission("prescription", "update");

  const drugId = String(formData.get("drugId") ?? "").trim();
  const current = formData.get("isActive") === "true";

  await prisma.drug.update({
    where: { drugId },
    data: { isActive: !current, updatedByUserId: currentUser.userId },
  });

  revalidatePath("/setup/drugs");
}

// ── Page ─────────────────────────────────────────────────────────────────────

function thb(v: unknown) {
  return Number(String(v ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function DrugsSetupPage() {
  await requirePermission("prescription", "create");

  const drugs = await prisma.drug.findMany({
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

  const lowStock = drugs.filter((d) => d.isActive && d.stockQty <= d.minStock);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">จัดการคลังยา</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {drugs.filter((d) => d.isActive).length} รายการที่ใช้งาน · {lowStock.length > 0 && (
                <span className="font-semibold text-red-600">{lowStock.length} รายการ stock ต่ำ</span>
              )}
            </p>
          </div>
        </div>

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="mb-2 text-sm font-semibold text-red-700">⚠ ยาที่ stock ต่ำกว่าเกณฑ์</p>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((d) => (
                <span
                  key={d.drugId}
                  className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700"
                >
                  {d.name} — {d.stockQty}/{d.minStock} {d.unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add drug form */}
        <form action={createDrug} className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-800">เพิ่มยาใหม่</h2>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อยา *</label>
              <input
                name="name"
                required
                placeholder="ชื่อยา"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อสามัญ (Generic)</label>
              <input
                name="genericName"
                placeholder="ชื่อสามัญ"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">หน่วย *</label>
              <input
                name="unit"
                required
                placeholder="เม็ด, ml, mg, แผง"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ราคา/หน่วย (฿) *</label>
              <input
                name="pricePerUnit"
                type="number"
                min={0}
                step="0.01"
                defaultValue={0}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Stock เริ่มต้น</label>
              <input
                name="stockQty"
                type="number"
                min={0}
                defaultValue={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">แจ้งเตือนเมื่อ stock ต่ำกว่า</label>
              <input
                name="minStock"
                type="number"
                min={0}
                defaultValue={10}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-100 px-6 py-4">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + เพิ่มยา
            </button>
          </div>
        </form>

        {/* Drug list */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 bg-slate-50">
                <th className="px-5 py-3 font-medium">ชื่อยา / Generic</th>
                <th className="px-3 py-3 font-medium">หน่วย</th>
                <th className="px-3 py-3 text-right font-medium">ราคา/หน่วย</th>
                <th className="px-3 py-3 text-right font-medium">Stock</th>
                <th className="px-3 py-3 text-right font-medium">ต่ำสุด</th>
                <th className="px-3 py-3 font-medium">ปรับ Stock</th>
                <th className="px-3 py-3 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {drugs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    ยังไม่มีรายการยา
                  </td>
                </tr>
              ) : (
                drugs.map((d) => {
                  const isLow = d.isActive && d.stockQty <= d.minStock;
                  return (
                    <tr key={d.drugId} className={!d.isActive ? "opacity-50" : ""}>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {d.name}
                        {d.genericName && (
                          <div className="text-xs font-normal text-slate-400">{d.genericName}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{d.unit}</td>
                      <td className="px-3 py-3 text-right text-slate-700">฿{thb(d.pricePerUnit)}</td>
                      <td className={`px-3 py-3 text-right font-bold ${isLow ? "text-red-600" : "text-slate-800"}`}>
                        {d.stockQty}
                        {isLow && <span className="ml-1 text-[10px]">⚠</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500">{d.minStock}</td>
                      <td className="px-3 py-3">
                        <form action={adjustStock} className="flex items-center gap-1.5">
                          <input type="hidden" name="drugId" value={d.drugId} />
                          <input
                            type="number"
                            name="delta"
                            defaultValue={1}
                            step={1}
                            className="w-16 rounded border border-slate-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <button
                            type="submit"
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            ปรับ
                          </button>
                        </form>
                      </td>
                      <td className="px-3 py-3">
                        <form action={toggleDrugActive}>
                          <input type="hidden" name="drugId" value={d.drugId} />
                          <input type="hidden" name="isActive" value={String(d.isActive)} />
                          <button
                            type="submit"
                            className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                              d.isActive
                                ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {d.isActive ? "ใช้งาน" : "ปิดใช้"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
