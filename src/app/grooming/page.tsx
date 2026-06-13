import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  getTodayGroomingQueues,
  startGroomingService,
  completeGroomingService,
} from "@/actions/grooming-queue.actions";
import type { GroomingQueueStatus } from "@/generated/prisma/client";

type QueueItem = Awaited<ReturnType<typeof getTodayGroomingQueues>>[number];

const STATUS_CONFIG: Record<
  GroomingQueueStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  WAITING: { label: "รอบริการ", bg: "bg-amber-50 border-amber-200", text: "text-amber-800", dot: "bg-amber-400" },
  IN_PROGRESS: { label: "กำลังบริการ", bg: "bg-violet-50 border-violet-200", text: "text-violet-800", dot: "bg-violet-500" },
  COMPLETED: { label: "เสร็จสิ้น", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", dot: "bg-emerald-500" },
  BILLED: { label: "ชำระแล้ว", bg: "bg-green-50 border-green-200", text: "text-green-800", dot: "bg-green-500" },
  CANCELLED: { label: "ยกเลิก", bg: "bg-gray-50 border-gray-200", text: "text-gray-500", dot: "bg-gray-400" },
  NO_SHOW: { label: "ไม่มา", bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-400" },
};

const COLUMN_STATUSES: GroomingQueueStatus[][] = [
  ["WAITING"],
  ["IN_PROGRESS"],
  ["COMPLETED", "BILLED"],
];

const COLUMN_HEADERS = [
  { label: "รอบริการ", colorClass: "bg-amber-500" },
  { label: "กำลังบริการ", colorClass: "bg-violet-500" },
  { label: "เสร็จสิ้น", colorClass: "bg-emerald-500" },
];

function formatTime(date: Date | null | undefined) {
  if (!date) return null;
  return new Date(date).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function GroomingCard({ queue }: { queue: QueueItem }) {
  const cfg = STATUS_CONFIG[queue.status as GroomingQueueStatus];
  const total = queue.items.reduce((sum: number, item: QueueItem["items"][number]) => sum + Number(item.priceSnapshot), 0);
  const startAction = startGroomingService.bind(null, queue.groomingQueueId);
  const completeAction = completeGroomingService.bind(null, queue.groomingQueueId);

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cfg.dot} text-white`}>
            {queue.queueNumber}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900">{queue.pet.petName}</div>
            <div className="text-xs text-gray-500">
              {queue.pet.species?.speciesName} · {queue.owner.fullName}
            </div>
          </div>
        </div>
        <Link
          href={`/grooming/${queue.groomingQueueId}`}
          className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
        >
          รายละเอียด
        </Link>
      </div>

      {queue.items.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {queue.items.map((item: QueueItem["items"][number]) => (
            <span
              key={item.groomingQueueItemId}
              className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-gray-700"
            >
              {item.groomingService.serviceName}
            </span>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
        <span>฿{total.toLocaleString("th-TH")}</span>
        <span>{queue.groomer ? `Groomer: ${queue.groomer.fullName}` : "ยังไม่กำหนด Groomer"}</span>
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-400">
        {queue.checkedInAt && <span>เช็คอิน {formatTime(queue.checkedInAt)}</span>}
        {queue.startedAt && <span>· เริ่ม {formatTime(queue.startedAt)}</span>}
        {queue.completedAt && <span>· เสร็จ {formatTime(queue.completedAt)}</span>}
      </div>

      {queue.status === "WAITING" && (
        <form action={startAction} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-700"
          >
            เริ่มบริการ
          </button>
        </form>
      )}

      {queue.status === "IN_PROGRESS" && (
        <form action={completeAction} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-medium text-white hover:bg-emerald-700"
          >
            เสร็จสิ้น
          </button>
        </form>
      )}
    </div>
  );
}

export default async function GroomingPage() {
  const queues = await getTodayGroomingQueues();

  const today = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const columns = COLUMN_STATUSES.map((statuses) =>
    queues.filter((q) => statuses.includes(q.status)),
  );

  const totalToday = queues.filter((q: QueueItem) => q.status !== "CANCELLED" && q.status !== "NO_SHOW").length;
  const completed = queues.filter((q: QueueItem) => q.status === "COMPLETED" || q.status === "BILLED").length;
  const inProgress = queues.filter((q: QueueItem) => q.status === "IN_PROGRESS").length;
  const waiting = queues.filter((q: QueueItem) => q.status === "WAITING").length;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Grooming Queue</h1>
            <p className="mt-0.5 text-sm text-gray-500">{today}</p>
          </div>
          <Link
            href="/grooming/walk-in"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <span>+</span> Walk-in ใหม่
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "ทั้งหมดวันนี้", value: totalToday, color: "text-gray-900" },
            { label: "รอบริการ", value: waiting, color: "text-amber-600" },
            { label: "กำลังบริการ", value: inProgress, color: "text-violet-600" },
            { label: "เสร็จสิ้น", value: completed, color: "text-emerald-600" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="mt-0.5 text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMN_HEADERS.map((col, colIdx) => (
            <div key={col.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-3">
                <span className={`h-2.5 w-2.5 rounded-full ${col.colorClass}`} />
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {columns[colIdx].length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {columns[colIdx].length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                    ไม่มีรายการ
                  </div>
                ) : (
                  columns[colIdx].map((queue: QueueItem) => (
                    <GroomingCard key={queue.groomingQueueId} queue={queue} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
