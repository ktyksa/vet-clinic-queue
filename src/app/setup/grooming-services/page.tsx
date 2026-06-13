import { AppShell } from "@/components/layout/AppShell";
import { getAllGroomingServices, createGroomingService, seedGroomingServices, toggleGroomingServiceActive } from "@/actions/grooming-service.actions";
import Link from "next/link";

export default async function GroomingServicesSetupPage() {
  const services = await getAllGroomingServices();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/grooming" className="text-sm text-indigo-600 hover:underline">
              ← กลับ Grooming Queue
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">ตั้งค่าบริการอาบน้ำตัดขน</h1>
          </div>
          {services.length === 0 && (
            <form action={seedGroomingServices}>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                โหลดข้อมูลตัวอย่าง
              </button>
            </form>
          )}
        </div>

        {/* Services list */}
        <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-700">รายการบริการทั้งหมด ({services.length})</h2>
          </div>
          {services.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              ยังไม่มีบริการ กรุณาเพิ่มหรือโหลดข้อมูลตัวอย่าง
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {services.map((svc) => (
                <div key={svc.groomingServiceId} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${svc.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>
                      {svc.serviceName}
                    </p>
                    <p className="text-xs text-gray-400">{svc.durationMin} นาที</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    ฿{Number(svc.price).toLocaleString("th-TH")}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      svc.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {svc.isActive ? "เปิดใช้" : "ปิดใช้"}
                  </span>
                  <form action={toggleGroomingServiceActive.bind(null, svc.groomingServiceId)}>
                    <button
                      type="submit"
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      {svc.isActive ? "ปิดใช้" : "เปิดใช้"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add service form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">เพิ่มบริการใหม่</h2>
          <form action={createGroomingService} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                ชื่อบริการ <span className="text-red-500">*</span>
              </label>
              <input
                name="serviceName"
                required
                placeholder="เช่น อาบน้ำ, ตัดขน..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  ราคา (บาท) <span className="text-red-500">*</span>
                </label>
                <input
                  name="price"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="350"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  ระยะเวลา (นาที) <span className="text-red-500">*</span>
                </label>
                <input
                  name="durationMin"
                  type="number"
                  required
                  min="1"
                  placeholder="60"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              เพิ่มบริการ
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
