import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  getGroomingQueueById,
  startGroomingService,
  completeGroomingService,
  cancelGroomingQueue,
} from "@/actions/grooming-queue.actions";
import type { GroomingQueueStatus } from "@/generated/prisma/client";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<GroomingQueueStatus, string> = {
  WAITING: "รอบริการ",
  IN_PROGRESS: "กำลังบริการ",
  COMPLETED: "เสร็จสิ้น",
  BILLED: "ชำระแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มา",
};

const STATUS_BADGE: Record<GroomingQueueStatus, string> = {
  WAITING: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-violet-100 text-violet-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  BILLED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-500",
  NO_SHOW: "bg-red-100 text-red-700",
};

function fmt(date: Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return "—";
  return new Date(date).toLocaleString("th-TH", opts ?? { dateStyle: "medium", timeStyle: "short" });
}

function fmtTime(date: Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default async function GroomingDetailPage({ params }: Props) {
  const { id } = await params;
  const queue = await getGroomingQueueById(id);
  if (!queue) notFound();

  const startAction = startGroomingService.bind(null, queue.groomingQueueId);
  const completeAction = completeGroomingService.bind(null, queue.groomingQueueId);

  const total = queue.items.reduce((sum: number, item: typeof queue.items[number]) => sum + Number(item.priceSnapshot), 0);

  const canStart = queue.status === "WAITING";
  const canComplete = queue.status === "IN_PROGRESS";
  const canCancel = !["COMPLETED", "BILLED", "CANCELLED", "NO_SHOW"].includes(queue.status);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Back */}
        <Link href="/grooming" className="text-sm text-indigo-600 hover:underline">
          ← กลับ Grooming Queue
        </Link>

        {/* Header */}
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">
                {queue.queueNumber}
              </span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{queue.pet.petName}</h1>
                <p className="text-sm text-gray-500">
                  {queue.pet.species?.speciesName}
                  {queue.pet.breed && ` · ${queue.pet.breed.breedName}`}
                </p>
              </div>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGE[queue.status as GroomingQueueStatus]}`}
          >
            {STATUS_LABEL[queue.status as GroomingQueueStatus]}
          </span>
        </div>

        {/* Info grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">เจ้าของ</h2>
            <p className="text-base font-medium text-gray-900">{queue.owner.fullName}</p>
            <p className="text-sm text-gray-500">{queue.owner.phoneNo}</p>
            {queue.owner.email && <p className="text-sm text-gray-500">{queue.owner.email}</p>}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">ข้อมูลคิว</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่</span>
                <span className="text-gray-900">
                  {fmt(queue.queueDate, { dateStyle: "medium" })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ประเภท</span>
                <span className="text-gray-900">{queue.source === "WALK_IN" ? "Walk-in" : "นัดหมาย"}</span>
              </div>
              {queue.groomer && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Groomer</span>
                  <span className="text-gray-900">{queue.groomer.fullName}</span>
                </div>
              )}
              {queue.appointment && (
                <div className="flex justify-between">
                  <span className="text-gray-500">นัดหมาย</span>
                  <span className="text-gray-900">{queue.appointment.appointmentNo}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-700">บริการ</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {queue.items.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">ยังไม่มีบริการ</p>
            ) : (
              queue.items.map((item: NonNullable<typeof queue>["items"][number]) => (
                <div key={item.groomingQueueItemId} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.groomingService.serviceName}
                    </p>
                    <p className="text-xs text-gray-400">{item.groomingService.durationMin} นาที</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    ฿{Number(item.priceSnapshot).toLocaleString("th-TH")}
                  </span>
                </div>
              ))
            )}
          </div>
          {queue.items.length > 0 && (
            <div className="flex justify-between border-t border-gray-200 bg-gray-50 px-5 py-3">
              <span className="text-sm font-semibold text-gray-700">รวมทั้งหมด</span>
              <span className="text-base font-bold text-gray-900">
                ฿{total.toLocaleString("th-TH")}
              </span>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Timeline</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">เช็คอิน</span>
              <span className="text-gray-900">{fmtTime(queue.checkedInAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">เริ่มบริการ</span>
              <span className="text-gray-900">{fmtTime(queue.startedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">เสร็จสิ้น</span>
              <span className="text-gray-900">{fmtTime(queue.completedAt)}</span>
            </div>
            {queue.cancelledAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">ยกเลิก</span>
                <span className="text-red-600">{fmtTime(queue.cancelledAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Special requests */}
        {(queue.specialRequests || queue.notes) && (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-5 py-4">
            {queue.specialRequests && (
              <div className="mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  คำขอพิเศษ
                </span>
                <p className="mt-1 text-sm text-amber-900">{queue.specialRequests}</p>
              </div>
            )}
            {queue.notes && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  หมายเหตุ
                </span>
                <p className="mt-1 text-sm text-amber-900">{queue.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {(canStart || canComplete || canCancel) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {canStart && (
              <form action={startAction}>
                <button
                  type="submit"
                  className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
                >
                  เริ่มบริการ
                </button>
              </form>
            )}

            {canComplete && (
              <form action={completeAction}>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  เสร็จสิ้น
                </button>
              </form>
            )}

            {canCancel && (
              <form action={cancelGroomingQueue}>
                <input type="hidden" name="groomingQueueId" value={queue.groomingQueueId} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 bg-white px-6 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  ยกเลิกคิว
                </button>
              </form>
            )}

            {queue.status === "CANCELLED" && queue.cancelReason && (
              <p className="w-full rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                เหตุผลการยกเลิก: {queue.cancelReason}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
