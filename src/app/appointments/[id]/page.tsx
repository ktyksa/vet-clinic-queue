import Link from "next/link";
import { notFound } from "next/navigation";
import type { MedicalQueueStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import {
  cancelAppointment,
  confirmAppointment,
  deleteAppointment,
  markNoShowAppointment,
} from "@/actions/appointment.actions";
import {
  cancelMedicalQueue,
  checkInAppointmentToMedicalQueue,
  markMedicalQueueNoShow,
  startMedicalQueueService,
  startMedicalQueueTriage,
} from "@/actions/medical-queue.actions";

type AppointmentDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string; returnLabel?: string }>;
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "BOOKED": return "bg-blue-50 text-blue-700 ring-blue-700/10";
    case "CONFIRMED": return "bg-indigo-50 text-indigo-700 ring-indigo-700/10";
    case "ARRIVED": return "bg-green-50 text-green-700 ring-green-700/10";
    case "IN_PROGRESS": return "bg-purple-50 text-purple-700 ring-purple-700/10";
    case "COMPLETED": return "bg-emerald-50 text-emerald-700 ring-emerald-700/10";
    case "CANCELLED": return "bg-red-50 text-red-700 ring-red-700/10";
    case "NO_SHOW": return "bg-zinc-100 text-zinc-700 ring-zinc-700/10";
    default: return "bg-slate-50 text-slate-700 ring-slate-700/10";
  }
}

function queueStatusBadgeClass(status: MedicalQueueStatus) {
  switch (status) {
    case "WAITING_TRIAGE": return "bg-sky-50 text-sky-700 ring-sky-700/10";
    case "TRIAGE_IN_PROGRESS": return "bg-cyan-50 text-cyan-700 ring-cyan-700/10";
    case "WAITING_VET": return "bg-blue-50 text-blue-700 ring-blue-700/10";
    case "IN_SERVICE": return "bg-amber-50 text-amber-700 ring-amber-700/10";
    case "COMPLETED": return "bg-emerald-50 text-emerald-700 ring-emerald-700/10";
    case "NO_SHOW": return "bg-zinc-100 text-zinc-700 ring-zinc-700/10";
    case "CANCELLED": return "bg-red-50 text-red-700 ring-red-700/10";
    default: return "bg-slate-50 text-slate-700 ring-slate-700/10";
  }
}

function formatQueueNumber(queueNumber: number) {
  return `M-${String(queueNumber).padStart(3, "0")}`;
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function safeReturnPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function formatOwnerAddress(owner: { houseNo?: string | null; villageName?: string | null; buildingName?: string | null; soi?: string | null; road?: string | null; subDistrict?: string | null; district?: string | null; province?: string | null; postalCode?: string | null }) {
  const parts = [
    owner.houseNo,
    owner.villageName ? `หมู่บ้าน${owner.villageName}` : null,
    owner.buildingName,
    owner.soi ? `ซ.${owner.soi}` : null,
    owner.road ? `ถ.${owner.road}` : null,
    owner.subDistrict ? `ต./แขวง ${owner.subDistrict}` : null,
    owner.district ? `อ./เขต ${owner.district}` : null,
    owner.province,
    owner.postalCode,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "-";
}

export default async function AppointmentDetailPage({ params, searchParams }: AppointmentDetailPageProps) {
  await requirePermission("appointment", "view");
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const returnTo = safeReturnPath(query.returnTo);
  const returnLabel = query.returnLabel ? decodeURIComponent(query.returnLabel) : null;
  const backHref = returnTo ?? "/appointments";
  const backLabel = returnLabel ? `← Back to ${returnLabel}` : "← Back to Appointments";

  const appointment = await prisma.appointment.findFirst({
    where: { appointmentId: id, deletedAt: null },
    select: {
      appointmentId: true,
      appointmentNo: true,
      appointmentDate: true,
      startAt: true,
      endAt: true,
      durationMinutes: true,
      appointmentType: true,
      status: true,
      note: true,
      checkedInAt: true,
      completedAt: true,
      cancelReason: true,
      owner: { select: { fullName: true, phoneNo: true, email: true, houseNo: true, villageName: true, buildingName: true, soi: true, road: true, subDistrict: true, district: true, province: true, postalCode: true } },
      pet: {
        select: {
          petName: true,
          gender: true,
          birthDate: true,
          estimatedAge: true,
          weight: true,
          petPhotoUrl: true,
          species: { select: { speciesName: true } },
          breed: { select: { breedName: true } },
        },
      },
      vet: { select: { fullName: true } },
      visit: { select: { visitId: true, visitNo: true, status: true } },
      source: true,
      medicalQueue: {
        select: {
          queueId: true,
          queueNumber: true,
          queueCode: true,
          queueStatus: true,
          priority: true,
          visitId: true,
          estimatedWaitMinutes: true,
          calledAt: true,
          completedAt: true,
          note: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      statusHistories: {
        orderBy: { changedAt: "desc" },
        take: 30,
        select: {
          appointmentStatusHistoryId: true,
          fromStatus: true,
          toStatus: true,
          actionCode: true,
          reason: true,
          note: true,
          changedAt: true,
          changedByUser: { select: { fullName: true } },
        },
      },
    },
  });

  if (!appointment) notFound();
  const queue = appointment.medicalQueue?.deletedAt ? null : appointment.medicalQueue;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href={backHref} className="text-sm font-medium text-blue-600 hover:underline">{backLabel}</Link>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Medical Appointment Detail</h1>
            <p className="mt-1 text-sm text-slate-500">{appointment.appointmentNo}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(appointment.status === "BOOKED" || appointment.status === "CONFIRMED") ? <Link href={`/appointments/${appointment.appointmentId}/edit`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Edit</Link> : null}
            {appointment.visit && appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW" ? <Link href={`/visits/${appointment.visit.visitId}?returnTo=${encodeURIComponent(`/appointments/${appointment.appointmentId}`)}&returnLabel=${encodeURIComponent("Appointment Detail")}`} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">Open Visit</Link> : null}
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Status" value={appointment.status} badgeClass={statusBadgeClass(appointment.status)} />
          <MetricCard label="Medical Type" value={appointment.appointmentType} />
          <MetricCard label="Appointment Time" value={`${formatDateTime(appointment.startAt)} - ${formatDateTime(appointment.endAt)}`} />
          <MetricCard label="Queue" value={queue ? queue.queueCode : "Not checked in"} badgeClass={queue ? queueStatusBadgeClass(queue.queueStatus) : undefined} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <InfoPanel title="Owner" rows={[
            ["Name", appointment.owner.fullName],
            ["Phone", appointment.owner.phoneNo ?? "-"],
            ["Email", appointment.owner.email ?? "-"],
            ["Address", formatOwnerAddress(appointment.owner)],
          ]} />
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {appointment.pet.petPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={appointment.pet.petPhotoUrl} alt={appointment.pet.petName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">🐾</div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-950">{appointment.pet.petName}</h2>
                <p className="mt-1 text-slate-600">{appointment.pet.species?.speciesName ?? "-"} · {appointment.pet.breed?.breedName ?? "-"}</p>
                <p className="mt-1 text-slate-600">{appointment.pet.gender ?? "-"} · {appointment.pet.estimatedAge ?? "-"}</p>
                <p className="mt-1 text-slate-600">น้ำหนักล่าสุด {appointment.pet.weight?.toString() ?? "-"} kg</p>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Medical Flow Action</h2>
            <p className="text-sm text-slate-500">Advance booking: check-in creates Medical Queue. Walk-in already creates Medical Queue when created.</p>
          </div>
          <div className="flex flex-wrap gap-3 p-6">
            {appointment.status === "BOOKED" ? <ActionForm action={confirmAppointment} appointmentId={appointment.appointmentId} label="Confirm" /> : null}
            {(appointment.status === "BOOKED" || appointment.status === "CONFIRMED" || appointment.status === "ARRIVED") && !queue ? <ActionForm action={checkInAppointmentToMedicalQueue} appointmentId={appointment.appointmentId} label="Check-in & Create Medical Queue" primary /> : null}
            {(appointment.status === "BOOKED" || appointment.status === "CONFIRMED") ? <ActionForm action={markNoShowAppointment} appointmentId={appointment.appointmentId} label="No Show" /> : null}
            {appointment.status !== "COMPLETED" && appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW" ? <ActionForm action={cancelAppointment} appointmentId={appointment.appointmentId} label="Cancel" /> : null}
            {(appointment.status === "CANCELLED" || appointment.status === "NO_SHOW") ? <ActionForm action={deleteAppointment} appointmentId={appointment.appointmentId} label="Archive" /> : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Medical Queue</h2>
            <p className="text-sm text-slate-500">Queue is medical-only in this sprint.</p>
          </div>
          <div className="p-6">
            {queue ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard label="Queue No" value={queue.queueCode ?? formatQueueNumber(queue.queueNumber)} />
                  <MetricCard label="Queue Status" value={queue.queueStatus} badgeClass={queueStatusBadgeClass(queue.queueStatus)} />
                  <MetricCard label="Priority" value={queue.priority} />
                  <MetricCard label="Called At" value={formatDateTime(queue.calledAt)} />
                  <MetricCard label="Completed At" value={formatDateTime(queue.completedAt)} />
                </div>
                <div className="flex flex-wrap gap-3">
                  {queue.queueStatus === "WAITING_TRIAGE" ? <QueueActionForm action={startMedicalQueueTriage} queueId={queue.queueId} label="Start Intake" primary /> : null}
                  {queue.queueStatus === "WAITING_VET" ? <QueueActionForm action={startMedicalQueueService} queueId={queue.queueId} label="Start Service" primary /> : null}
                  {(queue.visitId || appointment.visit) && queue.queueStatus !== "CANCELLED" && queue.queueStatus !== "NO_SHOW" ? <Link href={`/visits/${queue.visitId ?? appointment.visit?.visitId}?returnTo=${encodeURIComponent(`/appointments/${appointment.appointmentId}`)}&returnLabel=${encodeURIComponent("Appointment Detail")}`} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">Open Visit</Link> : null}
                  {!["IN_SERVICE", "COMPLETED", "NO_SHOW", "CANCELLED"].includes(queue.queueStatus) ? <QueueActionForm action={markMedicalQueueNoShow} queueId={queue.queueId} label="No Show" /> : null}
                  {queue.queueStatus !== "IN_SERVICE" && queue.queueStatus !== "COMPLETED" && queue.queueStatus !== "NO_SHOW" && queue.queueStatus !== "CANCELLED" ? <QueueActionForm action={cancelMedicalQueue} queueId={queue.queueId} label="Cancel Queue" /> : null}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                No medical queue yet. Check-in this appointment to create queue.
              </div>
            )}
          </div>
        </section>

        <InfoPanel title="Medical Note" rows={[["Note", appointment.note ?? "-"]]} />

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Status History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">From</th>
                  <th className="px-6 py-3">To</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointment.statusHistories.map((history) => (
                  <tr key={history.appointmentStatusHistoryId}>
                    <td className="px-6 py-3">{formatDateTime(history.changedAt)}</td>
                    <td className="px-6 py-3">{history.fromStatus ?? "-"}</td>
                    <td className="px-6 py-3">{history.toStatus}</td>
                    <td className="px-6 py-3">{history.actionCode}</td>
                    <td className="px-6 py-3">{history.changedByUser?.fullName ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value, badgeClass }: { label: string; value: string; badgeClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      <div className="mt-2">
        {badgeClass ? <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ${badgeClass}`}>{value}</span> : <span className="text-sm font-semibold text-slate-900">{value}</span>}
      </div>
    </div>
  );
}

function InfoPanel({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-2 px-6 py-3 text-sm sm:grid-cols-3">
            <div className="font-medium text-slate-500">{label}</div>
            <div className="sm:col-span-2 text-slate-900">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionForm({ action, appointmentId, label, primary }: { action: (formData: FormData) => Promise<void>; appointmentId: string; label: string; primary?: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <button type="submit" className={primary ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" : "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"}>{label}</button>
    </form>
  );
}

function QueueActionForm({ action, queueId, label, primary }: { action: (formData: FormData) => Promise<void>; queueId: string; label: string; primary?: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name="queueId" value={queueId} />
      <button type="submit" className={primary ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" : "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"}>{label}</button>
    </form>
  );
}
