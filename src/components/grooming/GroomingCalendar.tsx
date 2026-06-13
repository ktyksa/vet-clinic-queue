"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  createGroomingAppointment,
  checkInGroomingAppointment,
  cancelGroomingAppointment,
} from "@/actions/grooming-appointment.actions";
import type { AppointmentStatus } from "@/generated/prisma/client";

// ── Types ────────────────────────────────────────────────────────────────────

export type GAppt = {
  appointmentId: string;
  appointmentNo: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  note: string | null;
  cancelReason: string | null;
  owner: { ownerId: string; fullName: string; phoneNo: string | null };
  pet: { petId: string; petName: string; species: { speciesName: string } | null };
  groomer: { userId: string; fullName: string } | null;
  groomingQueue: { groomingQueueId: string; queueNumber: number; status: string } | null;
  services: { serviceId: string; serviceName: string; price: string }[];
};

export type GroomerItem = { userId: string; fullName: string };
export type PetItem = {
  petId: string;
  petName: string;
  ownerId: string;
  speciesName: string | null;
  ownerFullName: string;
  ownerPhone: string | null;
};
export type ServiceItem = {
  groomingServiceId: string;
  serviceName: string;
  price: string;
  durationMin: number;
};

type Panel =
  | { type: "create"; defaultDate: string }
  | { type: "view"; appt: GAppt };

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const STATUS_TH: Record<AppointmentStatus, string> = {
  BOOKED: "จอง",
  CONFIRMED: "ยืนยัน",
  ARRIVED: "เช็คอิน",
  IN_PROGRESS: "กำลังบริการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
  NO_SHOW: "ไม่มา",
  OVERDUE: "เลยกำหนด",
};
const STATUS_COLOR: Record<AppointmentStatus, string> = {
  BOOKED: "border-blue-300 bg-blue-50 text-blue-800",
  CONFIRMED: "border-indigo-300 bg-indigo-50 text-indigo-800",
  ARRIVED: "border-emerald-300 bg-emerald-50 text-emerald-800",
  IN_PROGRESS: "border-violet-300 bg-violet-50 text-violet-800",
  COMPLETED: "border-slate-300 bg-slate-100 text-slate-500",
  CANCELLED: "border-red-200 bg-red-50 text-red-600",
  NO_SHOW: "border-zinc-300 bg-zinc-50 text-zinc-600",
  OVERDUE: "border-orange-300 bg-orange-50 text-orange-700",
};

function pad(v: number) {
  return String(v).padStart(2, "0");
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfWeek(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - ((day + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}
function isSameDay(a: Date, b: Date) {
  return toDateStr(a) === toDateStr(b);
}
function isToday(d: Date) {
  return isSameDay(d, new Date());
}
function fmtTime(s: string) {
  const d = new Date(s);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
function weekTitle(ws: Date) {
  const we = addDays(ws, 6);
  if (ws.getMonth() === we.getMonth()) {
    return `${ws.getDate()} – ${we.getDate()} ${new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(we)}`;
  }
  return `${new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(ws)} – ${new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(we)}`;
}
function canCheckIn(appt: GAppt) {
  if (!["BOOKED", "CONFIRMED"].includes(appt.status)) return false;
  if (appt.groomingQueue) return false;
  return isSameDay(new Date(appt.startAt), new Date());
}
function thb(v: unknown) {
  return Number(String(v ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 0 });
}

// ── AppointmentCard ──────────────────────────────────────────────────────────

function AppointmentCard({ appt, onClick }: { appt: GAppt; onClick: () => void }) {
  const colorCls = STATUS_COLOR[appt.status] ?? "border-slate-200 bg-white text-slate-700";
  const startD = new Date(appt.startAt);
  const endD = new Date(appt.endAt);

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border px-2.5 py-2 text-left transition hover:opacity-80 ${colorCls}`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-xs font-semibold">
          {fmtTime(appt.startAt)}–{toTimeStr(endD)}
        </span>
        <span className="shrink-0 rounded-full bg-white/60 px-1.5 text-[10px] font-medium">
          {STATUS_TH[appt.status] ?? appt.status}
        </span>
      </div>
      <div className="mt-0.5 truncate text-xs font-bold">{appt.pet.petName}</div>
      <div className="truncate text-[11px] opacity-75">{appt.owner.fullName}</div>
      {appt.groomer && (
        <div className="truncate text-[11px] opacity-60">{appt.groomer.fullName}</div>
      )}
      {appt.services.length > 0 && (
        <div className="mt-0.5 truncate text-[11px] opacity-60">
          {appt.services.map((s) => s.serviceName).join(", ")}
        </div>
      )}
      {appt.groomingQueue && (
        <div className="mt-0.5 text-[10px] font-semibold opacity-80">
          คิว #{appt.groomingQueue.queueNumber}
        </div>
      )}
    </button>
  );
}

// ── Create Form ──────────────────────────────────────────────────────────────

function CreateForm({
  defaultDate,
  pets,
  groomers,
  services,
  onClose,
}: {
  defaultDate: string;
  pets: PetItem[];
  groomers: GroomerItem[];
  services: ServiceItem[];
  onClose: () => void;
}) {
  const [petFilter, setPetFilter] = useState("");
  const filteredPets = pets.filter((p) => {
    const q = petFilter.toLowerCase();
    return (
      !q ||
      p.petName.toLowerCase().includes(q) ||
      p.ownerFullName.toLowerCase().includes(q)
    );
  });

  return (
    <form
      action={async (fd) => {
        await createGroomingAppointment(fd);
        onClose();
      }}
      className="space-y-4"
    >
      {/* Pet */}
      <div>
        <label className="block text-xs font-semibold text-slate-600">สัตว์เลี้ยง / เจ้าของ *</label>
        <input
          type="text"
          placeholder="ค้นหาสัตว์หรือเจ้าของ..."
          value={petFilter}
          onChange={(e) => setPetFilter(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <select
          name="petId"
          required
          size={4}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          onChange={(e) => {
            const pet = pets.find((p) => p.petId === e.target.value);
            const ownerInput = e.currentTarget.form?.querySelector<HTMLInputElement>('[name="ownerId"]');
            if (ownerInput && pet) ownerInput.value = pet.ownerId;
          }}
        >
          {filteredPets.map((p) => (
            <option key={p.petId} value={p.petId}>
              {p.petName} ({p.speciesName ?? "?"}) — {p.ownerFullName}
              {p.ownerPhone ? ` · ${p.ownerPhone}` : ""}
            </option>
          ))}
        </select>
        <input type="hidden" name="ownerId" />
      </div>

      {/* Groomer */}
      <div>
        <label className="block text-xs font-semibold text-slate-600">ช่างแต่งขน</label>
        <select
          name="groomerId"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">— ยังไม่กำหนด —</option>
          {groomers.map((g) => (
            <option key={g.userId} value={g.userId}>
              {g.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600">เริ่มต้น *</label>
          <input
            type="datetime-local"
            name="startAt"
            required
            defaultValue={`${defaultDate}T09:00`}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600">สิ้นสุด *</label>
          <input
            type="datetime-local"
            name="endAt"
            required
            defaultValue={`${defaultDate}T10:00`}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>

      {/* Services */}
      {services.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-600">บริการ</label>
          <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 space-y-1">
            {services.map((s) => (
              <label key={s.groomingServiceId} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50 text-sm">
                <input type="checkbox" name="serviceIds" value={s.groomingServiceId} className="accent-violet-600" />
                <span className="flex-1">{s.serviceName}</span>
                <span className="text-xs text-slate-400">฿{thb(s.price)}</span>
                <span className="text-xs text-slate-400">{s.durationMin}น.</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-600">หมายเหตุ / คำขอพิเศษ</label>
        <textarea
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          placeholder="คำขอพิเศษ, อาการแพ้, ข้อมูลเพิ่มเติม..."
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          บันทึกนัดหมาย
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

// ── Detail View ──────────────────────────────────────────────────────────────

function DetailView({ appt, onClose }: { appt: GAppt; onClose: () => void }) {
  const checkInAction = checkInGroomingAppointment.bind(null, appt.appointmentId);
  const cancelAction = cancelGroomingAppointment.bind(null, appt.appointmentId);
  const totalPrice = appt.services.reduce((s, i) => s + Number(i.price), 0);
  const canCI = canCheckIn(appt);
  const canCancel = !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appt.status);

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${STATUS_COLOR[appt.status]}`}>
          {STATUS_TH[appt.status] ?? appt.status}
        </span>
        <span className="font-mono text-xs text-slate-400">{appt.appointmentNo}</span>
      </div>

      {/* Pet/Owner */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1">
        <div className="text-sm font-semibold text-slate-800">
          <Link href={`/pets/${appt.pet.petId}`} className="text-blue-600 hover:underline">
            {appt.pet.petName}
          </Link>
          {appt.pet.species && (
            <span className="ml-1 text-xs text-slate-400">({appt.pet.species.speciesName})</span>
          )}
        </div>
        <div className="text-sm text-slate-600">
          <Link href={`/owners/${appt.owner.ownerId}`} className="hover:text-blue-600 hover:underline">
            {appt.owner.fullName}
          </Link>
          {appt.owner.phoneNo && (
            <span className="ml-1 text-xs text-slate-400">· {appt.owner.phoneNo}</span>
          )}
        </div>
      </div>

      {/* Time & Groomer */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">วันที่</span>
          <span className="text-slate-800">{fmtDate(new Date(appt.startAt))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">เวลา</span>
          <span className="text-slate-800">
            {fmtTime(appt.startAt)} – {fmtTime(appt.endAt)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">ช่างแต่งขน</span>
          <span className="text-slate-800">{appt.groomer?.fullName ?? "ยังไม่กำหนด"}</span>
        </div>
      </div>

      {/* Services */}
      {appt.services.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">บริการ</p>
          <div className="space-y-1">
            {appt.services.map((s) => (
              <div key={s.serviceId} className="flex justify-between text-sm">
                <span className="text-slate-700">{s.serviceName}</span>
                <span className="text-slate-500">฿{thb(s.price)}</span>
              </div>
            ))}
            {appt.services.length > 1 && (
              <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-semibold">
                <span className="text-slate-600">รวม</span>
                <span className="text-slate-800">฿{thb(totalPrice)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {appt.note && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {appt.note}
        </div>
      )}

      {/* Cancel reason */}
      {appt.cancelReason && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          เหตุผลยกเลิก: {appt.cancelReason}
        </div>
      )}

      {/* Grooming Queue Link */}
      {appt.groomingQueue && (
        <Link
          href={`/grooming/${appt.groomingQueue.groomingQueueId}`}
          className="block rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm font-medium text-emerald-700 hover:bg-emerald-100"
        >
          ดูคิวอาบน้ำตัดขน #{appt.groomingQueue.queueNumber}
        </Link>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {canCI && (
          <form action={checkInAction}>
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              เช็คอิน → สร้างคิวอาบน้ำตัดขน
            </button>
          </form>
        )}

        {!canCI && ["BOOKED", "CONFIRMED"].includes(appt.status) && !appt.groomingQueue && (
          <p className="text-center text-xs text-slate-400">เช็คอินได้เฉพาะวันนัดหมายเท่านั้น</p>
        )}

        {canCancel && (
          <form action={cancelAction} className="flex gap-2">
            <input
              name="cancelReason"
              type="text"
              placeholder="เหตุผลยกเลิก"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <button
              type="submit"
              className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              ยกเลิกนัด
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main Calendar ─────────────────────────────────────────────────────────────

type Props = {
  initialWeekStr: string;
  appointments: GAppt[];
  groomers: GroomerItem[];
  pets: PetItem[];
  services: ServiceItem[];
};

export function GroomingCalendar({ initialWeekStr, appointments, groomers, pets, services }: Props) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [groomerFilter, setGroomerFilter] = useState("");

  const weekStart = startOfWeek(new Date(`${initialWeekStr}T00:00:00`));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const todayStr = toDateStr(new Date());

  const filteredAppts = groomerFilter
    ? appointments.filter((a) => a.groomer?.userId === groomerFilter)
    : appointments;

  const apptsByDay = weekDays.map((day) => ({
    day,
    appts: filteredAppts.filter((a) => isSameDay(new Date(a.startAt), day)),
  }));

  function navWeek(diff: number) {
    const d = addDays(weekStart, diff * 7);
    router.push(`/grooming/appointments?date=${toDateStr(d)}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navWeek(-1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="สัปดาห์ก่อน"
          >
            ←
          </button>
          <button
            onClick={() => router.push(`/grooming/appointments?date=${todayStr}`)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            วันนี้
          </button>
          <button
            onClick={() => navWeek(1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="สัปดาห์ถัดไป"
          >
            →
          </button>
        </div>

        <span className="text-sm font-semibold text-slate-700">{weekTitle(weekStart)}</span>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={groomerFilter}
            onChange={(e) => setGroomerFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="">ช่างทั้งหมด</option>
            {groomers.map((g) => (
              <option key={g.userId} value={g.userId}>
                {g.fullName}
              </option>
            ))}
          </select>

          <button
            onClick={() => setPanel({ type: "create", defaultDate: todayStr })}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            + นัดหมายใหม่
          </button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Week grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid min-w-[640px] grid-cols-7">
            {/* Day headers */}
            {apptsByDay.map(({ day }, i) => (
              <div
                key={toDateStr(day)}
                className={`border-b border-r border-slate-200 px-2 py-2 text-center ${
                  isToday(day) ? "bg-violet-50" : "bg-white"
                }`}
              >
                <div className="text-xs font-medium text-slate-500">{DAY_NAMES_TH[i]}</div>
                <div
                  className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday(day)
                      ? "bg-violet-600 text-white"
                      : "text-slate-700"
                  }`}
                >
                  {day.getDate()}
                </div>
                <button
                  onClick={() => setPanel({ type: "create", defaultDate: toDateStr(day) })}
                  className="mt-1 w-full rounded text-xs text-slate-400 hover:text-violet-600"
                  title="เพิ่มนัดหมาย"
                >
                  +
                </button>
              </div>
            ))}

            {/* Day columns */}
            {apptsByDay.map(({ day, appts }) => (
              <div
                key={toDateStr(day) + "-col"}
                className={`min-h-[300px] border-r border-slate-100 p-1.5 space-y-1.5 ${
                  isToday(day) ? "bg-violet-50/30" : "bg-white"
                }`}
              >
                {appts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-300">ว่าง</div>
                ) : (
                  appts.map((a) => (
                    <AppointmentCard
                      key={a.appointmentId}
                      appt={a}
                      onClick={() => setPanel({ type: "view", appt: a })}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        {panel && (
          <div className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                {panel.type === "create" ? "นัดหมายใหม่" : "รายละเอียดนัดหมาย"}
              </h3>
              <button
                onClick={() => setPanel(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {panel.type === "create" && (
              <CreateForm
                defaultDate={panel.defaultDate}
                pets={pets}
                groomers={groomers}
                services={services}
                onClose={() => setPanel(null)}
              />
            )}
            {panel.type === "view" && (
              <DetailView appt={panel.appt} onClose={() => setPanel(null)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
