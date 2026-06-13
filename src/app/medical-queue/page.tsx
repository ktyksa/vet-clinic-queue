import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import {
  cancelMedicalQueue,
  createWalkInMedicalQueue,
  completeMedicalQueue,
  getTodayMedicalQueues,
  markMedicalQueueNoShow,
  startMedicalQueueService,
  startMedicalQueueTriage,
} from "@/actions/medical-queue.actions";
import type { MedicalQueueStatus } from "@/generated/prisma/client";
import { MedicalQueueAutoRefresh } from "@/components/medical-queue/MedicalQueueAutoRefresh";
import { NewWalkInModalLauncher } from "@/components/medical-queue/NewWalkInModalLauncher";

function formatTime(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function statusBadgeClass(status: MedicalQueueStatus) {
  switch (status) {
    case "WAITING_TRIAGE": return "bg-sky-50 text-sky-700 ring-sky-700/10";
    case "TRIAGE_IN_PROGRESS": return "bg-cyan-50 text-cyan-700 ring-cyan-700/10";
    case "WAITING_VET": return "bg-orange-50 text-orange-700 ring-orange-700/10";
    case "IN_SERVICE": return "bg-violet-50 text-violet-700 ring-violet-700/10";
    case "COMPLETED": return "bg-emerald-50 text-emerald-700 ring-emerald-700/10";
    case "NO_SHOW": return "bg-zinc-100 text-zinc-700 ring-zinc-700/10";
    case "CANCELLED": return "bg-rose-50 text-rose-700 ring-rose-700/10";
    default: return "bg-slate-50 text-slate-700 ring-slate-700/10";
  }
}

function statusLabel(status: MedicalQueueStatus) {
  switch (status) {
    case "WAITING_TRIAGE": return "Waiting Triage";
    case "TRIAGE_IN_PROGRESS": return "Intake In Progress";
    case "WAITING_VET": return "Waiting Vet";
    case "IN_SERVICE": return "In Service";
    case "COMPLETED": return "Completed";
    case "NO_SHOW": return "No Show";
    case "CANCELLED": return "Cancelled";
    default: return status;
  }
}

function priorityBadgeClass(priority?: string | null) {
  switch (priority) {
    case "EMERGENCY": return "bg-red-50 text-red-700 ring-red-700/10";
    case "URGENT": return "bg-amber-50 text-amber-700 ring-amber-700/10";
    default: return "bg-slate-100 text-slate-700 ring-slate-700/10";
  }
}

function soapBadgeClass(status?: string | null) {
  switch (status) {
    case "FINALIZED": return "bg-emerald-50 text-emerald-700 ring-emerald-700/10";
    case "DRAFT": return "bg-amber-50 text-amber-700 ring-amber-700/10";
    default: return "bg-slate-100 text-slate-600 ring-slate-600/10";
  }
}

function getSoapStatusLabel(status?: string | null) {
  if (status === "FINALIZED") return "SOAP Finalized";
  if (status === "DRAFT") return "SOAP Draft";
  return "SOAP ❌";
}

function reasonTypeLabel(reasonType?: string | null, visitType?: string | null) {
  const sourceReason = reasonType;

  if (sourceReason) {
    return sourceReason.replaceAll("_", " ");
  }

  switch (visitType) {
    case "VACCINATION":
      return "VACCINE";
    case "FOLLOW_UP":
      return "FOLLOW UP";
    case "SURGERY":
      return "SURGERY";
    case "CONSULTATION":
      return "CONSULTATION";
    default:
      return visitType ?? "MEDICAL";
  }
}

function canCompleteQueue(queue: Awaited<ReturnType<typeof getTodayMedicalQueues>>[number]) {
  const visit = queue.visit ?? queue.appointment?.visit;
  return Boolean(queue.queueStatus === "IN_SERVICE" && visit && visit.soapNote?.status === "FINALIZED" && visit.diagnoses.length > 0);
}

function completedInfo(queue: Awaited<ReturnType<typeof getTodayMedicalQueues>>[number]) {
  if (queue.queueStatus !== "COMPLETED") return null;
  return {
    completedAt: formatTime(queue.completedAt),
    totalTime: queue.actualWaitMinutes ? `${queue.actualWaitMinutes} min` : "-",
  };
}

const BOARD_COLUMNS: { status: MedicalQueueStatus; titleTh: string; titleEn: string }[] = [
  { status: "WAITING_TRIAGE", titleTh: "รอซักประวัติ", titleEn: "Waiting Triage" },
  { status: "TRIAGE_IN_PROGRESS", titleTh: "กำลังซักประวัติ", titleEn: "Intake In Progress" },
  { status: "WAITING_VET", titleTh: "รอพบหมอ", titleEn: "Waiting Vet" },
  { status: "IN_SERVICE", titleTh: "กำลังตรวจ", titleEn: "In Service" },
  { status: "COMPLETED", titleTh: "เสร็จสิ้น", titleEn: "Completed" },
  { status: "CANCELLED", titleTh: "ยกเลิก", titleEn: "Cancelled" },
  { status: "NO_SHOW", titleTh: "ไม่มา", titleEn: "No Show" },
];

type MedicalQueuePageProps = { searchParams?: Promise<{ notice?: string }> };

function noticeMessage(value?: string | null) {
  if (value === "visit-completed") return "✓ Visit completed successfully. Queue moved to Completed.";
  return null;
}

function formatArrivalNow(language?: string | null) {
  return new Intl.DateTimeFormat(language === "EN" ? "en-US" : "th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

async function getWalkInModalOptions() {
  return prisma.user.findMany({
    where: { role: "VETERINARIAN", activeFlag: true, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { userId: true, fullName: true },
  });
}

export default async function MedicalQueuePage({ searchParams }: MedicalQueuePageProps) {
  const query = searchParams ? await searchParams : {};
  const notice = noticeMessage(query.notice);
  const currentUser = await requirePermission("queue", "view");
  const [queues, vets] = await Promise.all([
    getTodayMedicalQueues(),
    getWalkInModalOptions(),
  ]);

  return (
    <AppShell>
      <MedicalQueueAutoRefresh />
      <div className="space-y-6">
        {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">คิวรักษา</h1>
            <p className="mt-1 text-sm text-slate-500">Medical Queue · นัดหมาย / Walk-in → คิว → ซักประวัติ → พบหมอ → SOAP.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/appointments/calendar" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">ตารางนัดหมาย</Link>
            <NewWalkInModalLauncher
              vets={vets}
              action={createWalkInMedicalQueue}
              arrivalDateTimeLabel={formatArrivalNow(currentUser.preferredLanguage)}
              language={currentUser.preferredLanguage}
            />
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-950">
              คิววันนี้ ({queues.length})
              <span className="ml-2 text-xs font-semibold text-slate-500">Today Queue Board</span>
            </h2>
          </div>

          {queues.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">ยังไม่มีคิวรักษาวันนี้ · No active medical queue today.</div>
          ) : (
            <div className="grid gap-4 p-4 xl:grid-cols-3 2xl:grid-cols-7">
              {BOARD_COLUMNS.map((column) => {
                const items = queues.filter((queue) => queue.queueStatus === column.status);
                return (
                  <div key={column.status} className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${items.length > 0 ? "min-h-72" : "min-h-28"}`}>
                    <div className="mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {column.titleTh}
                          <span className="ml-1 text-[10px] font-semibold text-slate-500">({column.titleEn})</span>
                        </h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{items.length}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {items.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs font-semibold text-slate-400">ว่าง · Empty</div> : null}
                      {items.map((queue) => <QueueCard key={queue.queueId} queue={queue} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function QueueCard({ queue }: { queue: Awaited<ReturnType<typeof getTodayMedicalQueues>>[number] }) {
  const visit = queue.visit ?? queue.appointment?.visit;
  const isCompleted = queue.queueStatus === "COMPLETED";
  const isCancelled = queue.queueStatus === "CANCELLED";
  const doneInfo = completedInfo(queue);
  const reason = reasonTypeLabel(queue.reasonType ?? visit?.reasonType ?? queue.appointment?.appointmentType, visit?.visitType);
  const appointmentTime = queue.appointment?.startAt ? formatTime(queue.appointment.startAt) : formatTime(queue.waitingAt);

  return (
    <article className={`rounded-xl border p-2.5 shadow-sm ${isCompleted ? "border-emerald-100 bg-emerald-50/70" : isCancelled ? "border-rose-100 bg-rose-50/70" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="break-all font-mono text-[13px] font-black leading-5 text-slate-950">{queue.queueCode}</div>
          <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
            <div>No. {queue.queueNumber}</div>
            <div className="font-mono">{visit ? visit.visitNo : "ยังไม่สร้าง Visit"}</div>
          </div>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${statusBadgeClass(queue.queueStatus)}`}>{statusLabel(queue.queueStatus)}</span>
      </div>

      <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5">
        <div className="truncate text-[12px] font-black text-slate-950">{queue.pet.petName}</div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">{queue.owner.fullName} · {queue.owner.phoneNo ?? "-"}</div>
      </div>

      <div className="mt-2 grid gap-1 text-[11px]">
        <Info label="สัตวแพทย์" value={queue.veterinarian?.fullName ?? "ยังไม่ระบุ"} compact />
        {!isCompleted ? (
          <div className="grid grid-cols-2 gap-1">
            <Info label="ลงทะเบียน" value={formatTime(queue.checkedInAt)} compact />
            {queue.queueStatus === "WAITING_VET" || queue.queueStatus === "IN_SERVICE" ? (
              <Info label="เวลานัด/รอพบหมอ" value={appointmentTime} compact />
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            <Info label="เสร็จเวลา" value={doneInfo?.completedAt ?? "-"} compact />
            <Info label="เวลารวม" value={doneInfo?.totalTime ?? "-"} compact />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700" title="Source">
          Source: {queue.source === "WALK_IN" ? "WALK-IN" : "ADV"}
        </span>
        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-700/10" title="Type">
          Type: {reason}
        </span>
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${priorityBadgeClass(queue.priority)}`} title="Priority">
          Priority: {queue.priority}
        </span>
        {visit ? <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${soapBadgeClass(visit.soapNote?.status)}`}>{getSoapStatusLabel(visit.soapNote?.status)} · Dx {visit.diagnoses.length}</span> : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {queue.queueStatus === "WAITING_TRIAGE" ? <QueueActionForm action={startMedicalQueueTriage} queueId={queue.queueId} label="เริ่มซักประวัติ" primary /> : null}
        {queue.queueStatus === "TRIAGE_IN_PROGRESS" && visit ? <Link href={`/visits/${visit.visitId}?focus=intake&returnTo=${encodeURIComponent("/medical-queue")}&returnLabel=${encodeURIComponent("Medical Queue")}`} className="rounded-md bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-cyan-700">ทำ Intake ต่อ</Link> : null}
        {queue.queueStatus === "WAITING_VET" ? <QueueActionForm action={startMedicalQueueService} queueId={queue.queueId} label="เริ่มตรวจ" primary /> : null}
        {queue.queueStatus === "IN_SERVICE" && visit ? <Link href={`/visits/${visit.visitId}/soap?returnTo=${encodeURIComponent("/medical-queue")}&returnLabel=${encodeURIComponent("Medical Queue")}`} className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-violet-700">SOAP</Link> : null}
        {queue.queueStatus === "WAITING_TRIAGE" ? <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-400">ดูข้อมูลซักประวัติ</span> : null}
        {queue.queueStatus === "WAITING_VET" && visit ? <Link href={`/visits/${visit.visitId}?returnTo=${encodeURIComponent("/medical-queue")}&returnLabel=${encodeURIComponent("Medical Queue")}`} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">ดูข้อมูลซักประวัติ</Link> : null}
        {FINAL_STATUS_LABELS.includes(queue.queueStatus) && visit ? <Link href={`/visits/${visit.visitId}?returnTo=${encodeURIComponent("/medical-queue")}&returnLabel=${encodeURIComponent("Medical Queue")}`} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">{isCompleted ? "ดู Visit" : "ดูข้อมูลซักประวัติ"}</Link> : null}
        {canCompleteQueue(queue) ? <QueueActionForm action={completeMedicalQueue} queueId={queue.queueId} label="เสร็จสิ้น" /> : null}
        {queue.queueStatus === "IN_SERVICE" && visit && !canCompleteQueue(queue) ? <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">ปิดคิวไม่ได้: ต้อง finalize SOAP + diagnosis</span> : null}
        {!FINAL_STATUS_LABELS.includes(queue.queueStatus) && queue.queueStatus !== "IN_SERVICE" ? <QueueActionForm action={markMedicalQueueNoShow} queueId={queue.queueId} label="ไม่มา" /> : null}
        {!FINAL_STATUS_LABELS.includes(queue.queueStatus) && queue.queueStatus !== "IN_SERVICE" ? <QueueActionForm action={cancelMedicalQueue} queueId={queue.queueId} label="ยกเลิก" danger /> : null}
        {queue.appointmentId ? <Link href={`/appointments/${queue.appointmentId}?returnTo=${encodeURIComponent("/medical-queue")}&returnLabel=${encodeURIComponent("Medical Queue")}`} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">ดูนัดหมาย</Link> : null}
      </div>
    </article>
  );
}

const FINAL_STATUS_LABELS: MedicalQueueStatus[] = ["COMPLETED", "NO_SHOW", "CANCELLED"];

function Info({
  label,
  value,
  valueClassName = "break-words",
  compact = false,
}: {
  label: string;
  value: string | number | null | undefined;
  valueClassName?: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-md bg-slate-50 px-2 ${compact ? "py-0.5" : "py-1"}`}>
      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-[11px] font-bold text-slate-950 ${valueClassName}`}>{value ?? "-"}</div>
    </div>
  );
}

function QueueActionForm({ action, queueId, label, primary = false, danger = false }: { action: (formData: FormData) => Promise<void>; queueId: string; label: string; primary?: boolean; danger?: boolean }) {
  const className = primary
    ? "rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-700"
    : danger
      ? "rounded-md border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-50"
      : "rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50";
  return (
    <form action={action}>
      <input type="hidden" name="queueId" value={queueId} />
      <button type="submit" className={className}>{label}</button>
    </form>
  );
}
