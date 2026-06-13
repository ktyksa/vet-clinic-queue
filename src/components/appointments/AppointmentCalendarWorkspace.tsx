"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  updateAppointment,
  markNoShowAppointment,
} from "@/actions/appointment.actions";
import type {
  AppointmentStatus,
  AppointmentType,
  MedicalQueueStatus,
} from "@/generated/prisma/client";

type ViewMode = "day" | "week" | "month" | "year";

type AppointmentItem = {
  appointmentId: string;
  appointmentNo: string;
  appointmentType: AppointmentType;
  source: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  note: string | null;
  owner: { ownerId: string; fullName: string; phoneNo: string | null };
  pet: {
    petId: string;
    petName: string;
    petPhotoUrl: string | null;
    species: { speciesName: string } | null;
    breed: { breedName: string } | null;
  };
  vet: { userId: string; fullName: string } | null;
  medicalQueue: {
    queueNumber: number;
    queueCode: string;
    queueStatus: MedicalQueueStatus;
  } | null;
};

type VetItem = { userId: string; fullName: string };
type PetSearchItem = {
  petId: string;
  petName: string;
  ownerId: string;
  gender: string | null;
  speciesName: string | null;
  breedName: string | null;
  owner: { ownerId: string; fullName: string; phoneNo: string | null };
};

type Props = {
  initialDate: string;
  initialView: ViewMode;
  filters: { vetId: string; appointmentType: string; status: string };
  appointmentTypes: AppointmentType[];
  appointmentStatuses: AppointmentStatus[];
  businessStartTime: string;
  businessEndTime: string;
  intervalMinutes: number;
  appointments: AppointmentItem[];
  vets: VetItem[];
  pets: PetSearchItem[];
};

type SlotDraft = {
  date: Date;
  startAt: Date;
  endAt: Date;
  anchorX?: number;
  anchorY?: number;
  anchorLeft?: number;
  anchorRight?: number;
  anchorBottom?: number;
};

type IconProps = { className?: string };
function SvgIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
function CalendarIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </SvgIcon>
  );
}
function ClockIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </SvgIcon>
  );
}
function UserIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </SvgIcon>
  );
}
function PawIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <circle cx="5" cy="10" r="2" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="19" cy="10" r="2" />
      <path d="M7 19c1.4-4 8.6-4 10 0 1 2.6-2.2 3.2-5 1.5C9.2 22.2 6 21.6 7 19Z" />
    </SvgIcon>
  );
}
function VetIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <path d="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </SvgIcon>
  );
}
function CloseIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </SvgIcon>
  );
}
function EditIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </SvgIcon>
  );
}
function TrashIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />
    </SvgIcon>
  );
}
function ChevronLeftIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <path d="m15 18-6-6 6-6" />
    </SvgIcon>
  );
}
function ChevronRightIcon(p: IconProps) {
  return (
    <SvgIcon {...p}>
      <path d="m9 18 6-6-6-6" />
    </SvgIcon>
  );
}

const ROW_HEIGHT = 60;
const DISPLAY_BUSINESS_START_TIME = "08:00";
const DISPLAY_BUSINESS_END_TIME = "22:00";
const BUSINESS_CLOSE_TIME = "23:00";
const MIN_CREATE_SLOT_MINUTES = 30;
function pad(v: number) {
  return String(v).padStart(2, "0");
}
function parseDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function toTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function toDateTimeLocal(date: Date) {
  return `${toDateValue(date)}T${toTimeValue(date)}`;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function isSameDay(a: Date, b: Date) {
  return toDateValue(a) === toDateValue(b);
}
function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}
function getInitial(text: string) {
  return text.trim().slice(0, 1).toUpperCase() || "P";
}
function getTimeGrid(startTime: string, endTime: string) {
  const start = Number(startTime.slice(0, 2));
  const end = Number(endTime.slice(0, 2));
  return Array.from(
    { length: Math.max(1, end - start + 1) },
    (_, i) => start + i,
  );
}
function getSlotHours(timeGrid: number[]) {
  return timeGrid;
}
function getTop(startAt: Date, startHour: number) {
  return (
    ((startAt.getHours() * 60 + startAt.getMinutes() - startHour * 60) / 60) *
    ROW_HEIGHT
  );
}
function getHeight(startAt: Date, endAt: Date) {
  return Math.max(
    34,
    ((endAt.getTime() - startAt.getTime()) / 3_600_000) * ROW_HEIGHT,
  );
}
function getStatusLabel(a: AppointmentItem) {
  if (a.medicalQueue?.queueStatus === "WAITING_TRIAGE") return "Waiting Triage";
  if (a.medicalQueue?.queueStatus === "TRIAGE_IN_PROGRESS") return "Intake";
  if (a.medicalQueue?.queueStatus === "WAITING_VET") return "Waiting Vet";
  if (a.status === "BOOKED") return "Scheduled";
  if (a.status === "CONFIRMED") return "Confirmed";
  if (a.status === "ARRIVED") return "Checked-in";
  if (a.status === "IN_PROGRESS") return "In Service";
  if (a.status === "COMPLETED") return "✓ Completed";
  if (a.status === "CANCELLED") return "Cancelled";
  if (a.status === "NO_SHOW") return "No Show";
  return a.status;
}
function getSourceLabel(source: string) {
  return source === "WALK_IN" ? "Walk-in" : "Advance Booking";
}
function getTypeLabel(type: AppointmentType) {
  return String(type).replaceAll("_", " ");
}
function canCheckInNow(appointment: AppointmentItem) {
  return ["BOOKED", "CONFIRMED"].includes(appointment.status);
}
function canNoShowAppointment(appointment: AppointmentItem) {
  return ["BOOKED", "CONFIRMED"].includes(appointment.status);
}
function canCancelAppointmentFromCalendar(appointment: AppointmentItem) {
  return (
    ["BOOKED", "CONFIRMED", "ARRIVED"].includes(appointment.status) &&
    !["IN_SERVICE", "COMPLETED", "NO_SHOW", "CANCELLED"].includes(
      appointment.medicalQueue?.queueStatus ?? "",
    )
  );
}
function colorClass(a: AppointmentItem) {
  if (a.status === "CANCELLED")
    return "border-rose-300 bg-rose-50 text-rose-800";
  if (a.status === "NO_SHOW") return "border-zinc-300 bg-zinc-50 text-zinc-700";
  if (a.status === "COMPLETED")
    return "border-slate-300 bg-slate-100 text-slate-500 opacity-75";
  if (a.status === "IN_PROGRESS")
    return "border-violet-300 bg-violet-50 text-violet-800";
  if (
    a.medicalQueue &&
    ["WAITING_TRIAGE", "TRIAGE_IN_PROGRESS", "WAITING_VET"].includes(
      a.medicalQueue.queueStatus,
    )
  )
    return "border-orange-300 bg-orange-50 text-orange-800";
  if (a.status === "ARRIVED")
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  return "border-blue-300 bg-blue-50 text-blue-800";
}
function selectedPetText(pet: PetSearchItem | null) {
  return pet
    ? `${pet.petName} • ${pet.owner.fullName}${pet.owner.phoneNo ? ` • ${pet.owner.phoneNo}` : ""}`
    : "";
}
function ownerOptionText(owner: PetSearchItem["owner"]) {
  return `${owner.fullName}${owner.phoneNo ? ` • ${owner.phoneNo}` : ""}`;
}
function buildHref(date: Date, view: ViewMode, filters: Props["filters"]) {
  const q = new URLSearchParams({ date: toDateValue(date), view });
  if (filters.vetId) q.set("vetId", filters.vetId);
  if (filters.appointmentType)
    q.set("appointmentType", filters.appointmentType);
  if (filters.status) q.set("status", filters.status);
  return `/appointments/calendar?${q.toString()}`;
}
function getViewTitle(date: Date, view: ViewMode) {
  if (view === "week") {
    const s = startOfWeek(date);
    const e = addDays(s, 6);
    return `${s.getDate()} – ${e.getDate()} ${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(e)}`;
  }
  if (view === "month")
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(date);
  if (view === "year") return String(date.getFullYear());
  return formatDate(date);
}
function navDate(date: Date, view: ViewMode, diff: number) {
  const d = new Date(date);
  if (view === "day") d.setDate(d.getDate() + diff);
  else if (view === "week") d.setDate(d.getDate() + diff * 7);
  else if (view === "month") d.setMonth(d.getMonth() + diff);
  else d.setFullYear(d.getFullYear() + diff);
  return d;
}
function isPastSlot(startAt: Date, now = new Date()) {
  return startAt.getTime() < now.getTime();
}
function getBusinessCloseAt(day: Date) {
  const close = new Date(day);
  const [hour, minute] = BUSINESS_CLOSE_TIME.split(":").map(Number);
  close.setHours(hour, minute || 0, 0, 0);
  return close;
}
function getSlotDurationMinutes(startAt: Date, endAt: Date) {
  return Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
}
function hasEnoughRemainingBusinessTime(day: Date, now = new Date()) {
  return (
    getBusinessCloseAt(day).getTime() - now.getTime() >=
    MIN_CREATE_SLOT_MINUTES * 60_000
  );
}
function isSlotPastBusinessClose(startAt: Date, endAt: Date) {
  return endAt.getTime() > getBusinessCloseAt(startAt).getTime();
}
function isSlotCreatable(startAt: Date, endAt: Date, now = new Date()) {
  return (
    startAt.getTime() >= now.getTime() &&
    endAt.getTime() <= getBusinessCloseAt(startAt).getTime() &&
    getSlotDurationMinutes(startAt, endAt) >= MIN_CREATE_SLOT_MINUTES &&
    hasEnoughRemainingBusinessTime(startAt, now)
  );
}
function getFixedLovStyle(input: HTMLInputElement | null): CSSProperties {
  if (typeof window === "undefined" || !input) return {};
  const rect = input.getBoundingClientRect();
  const margin = 16;
  const gap = 4;
  const preferredHeight = 220;
  const belowSpace = window.innerHeight - rect.bottom - margin;
  const aboveSpace = rect.top - margin;
  const openAbove = belowSpace < 140 && aboveSpace > belowSpace;
  const maxHeight = Math.max(
    96,
    Math.min(preferredHeight, openAbove ? aboveSpace - gap : belowSpace - gap),
  );
  const top = openAbove
    ? Math.max(margin, rect.top - maxHeight - gap)
    : Math.min(rect.bottom + gap, window.innerHeight - margin - maxHeight);
  return {
    position: "fixed",
    left: rect.left,
    top,
    width: rect.width,
    maxHeight,
  };
}

export function AppointmentCalendarWorkspace(props: Props) {
  const {
    initialDate,
    initialView,
    filters,
    appointmentTypes,
    appointmentStatuses,
    intervalMinutes,
    appointments,
    vets,
    pets,
  } = props;
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const selectedDate = useMemo(() => parseDate(initialDate), [initialDate]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        addDays(startOfWeek(selectedDate), i),
      ),
    [selectedDate],
  );
  const timeGrid = useMemo(
    () => getTimeGrid(DISPLAY_BUSINESS_START_TIME, DISPLAY_BUSINESS_END_TIME),
    [],
  );
  const [quickSlot, setQuickSlot] = useState<SlotDraft | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [detailItem, setDetailItem] = useState<{
    appointment: AppointmentItem;
    anchorX?: number;
    anchorY?: number;
  } | null>(null);
  const [calendarAlert, setCalendarAlert] = useState<{
    title: string;
    message: string;
    anchorX?: number;
    anchorY?: number;
  } | null>(null);
  const router = useRouter();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotClickRef = useRef<{
    key: string;
    lastAt: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const navigationLockRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!calendarAlert) return;
    const timer = window.setTimeout(() => setCalendarAlert(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [calendarAlert]);

  const dayStartHour = Number(DISPLAY_BUSINESS_START_TIME.slice(0, 2));
  const slotHours = useMemo(() => getSlotHours(timeGrid), [timeGrid]);
  const calendarHeight = slotHours.length * ROW_HEIGHT;
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();
    for (const a of appointments) {
      const start = new Date(a.startAt);
      const hour = start.getHours() + start.getMinutes() / 60;
      if (hour < dayStartHour || start.getTime() >= getBusinessCloseAt(start).getTime())
        continue;
      const key = toDateValue(start);
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [appointments, dayStartHour]);
  const visibleAppointments = useMemo(() => {
    const start =
      initialView === "week"
        ? startOfWeek(selectedDate)
        : initialView === "month"
          ? startOfMonth(selectedDate)
          : initialView === "year"
            ? new Date(selectedDate.getFullYear(), 0, 1)
            : selectedDate;
    const end =
      initialView === "week"
        ? addDays(start, 7)
        : initialView === "month"
          ? addDays(endOfMonth(selectedDate), 1)
          : initialView === "year"
            ? new Date(selectedDate.getFullYear() + 1, 0, 1)
            : addDays(selectedDate, 1);
    return appointments.filter((a) => {
      const d = new Date(a.startAt);
      return d >= start && d < end;
    });
  }, [appointments, selectedDate, initialView]);

  function buildSlot(
    day: Date,
    hour: number,
    minute: number,
    event?: MouseEvent<HTMLElement>,
  ): SlotDraft {
    const s = new Date(day);
    s.setHours(hour, minute, 0, 0);
    const e = new Date(s.getTime() + intervalMinutes * 60_000);
    const rect = event?.currentTarget.getBoundingClientRect();
    const clickX = event?.clientX;
    const clickY = event?.clientY;
    return {
      date: day,
      startAt: s,
      endAt: e,
      anchorX: clickX ?? (rect ? rect.right + 12 : undefined),
      anchorY: clickY ?? rect?.top,
      anchorLeft: clickX ?? rect?.left,
      anchorRight: clickX ?? rect?.right,
      anchorBottom: clickY ?? rect?.bottom,
    };
  }
  function openFullCreate(slot: SlotDraft) {
    router.push(
      `/appointments/new?startAt=${encodeURIComponent(toDateTimeLocal(slot.startAt))}&endAt=${encodeURIComponent(toDateTimeLocal(slot.endAt))}`,
    );
  }
  function showPastSlotWarning(slot: SlotDraft) {
    setCalendarAlert({
      title: "Past date/time cannot be selected",
      message: "Cannot create an appointment in a past date or time.",
      anchorX: slot.anchorRight ?? slot.anchorX,
      anchorY: slot.anchorY,
    });
  }
  function showStartTimeNotAvailableWarning(slot: SlotDraft) {
    setCalendarAlert({
      title: "เวลาเริ่มต้นไม่เพียงพอ / Start time is not available",
      message:
        "กรุณาขยับไปเลือกช่วงเวลาอื่น / Please choose another available time slot.",
      anchorX: slot.anchorRight ?? slot.anchorX,
      anchorY: slot.anchorY,
    });
  }
  function resolveCreatableSlotInHour(
    day: Date,
    hour: number,
    event: MouseEvent<HTMLElement>,
    currentTime: Date,
  ) {
    const candidateMinutes = [0, MIN_CREATE_SLOT_MINUTES];
    const anchorSlot = buildSlot(day, hour, 0, event);

    for (const candidateMinute of candidateMinutes) {
      const slot = buildSlot(day, hour, candidateMinute, event);
      if (isSlotCreatable(slot.startAt, slot.endAt, currentTime)) return slot;
    }

    return anchorSlot;
  }
  function handleSlotClick(
    day: Date,
    hour: number,
    _minute: number,
    event: MouseEvent<HTMLElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const currentTime = new Date();
    const slot = resolveCreatableSlotInHour(day, hour, event, currentTime);

    if (!isSlotCreatable(slot.startAt, slot.endAt, currentTime)) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setQuickSlot(null);
      setDetailItem(null);
      showStartTimeNotAvailableWarning(slot);
      return;
    }

    if (event.detail >= 2) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setQuickSlot(null);
      setDetailItem(null);
      openFullCreate(slot);
      return;
    }

    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      setQuickSlot(slot);
      setDetailItem(null);
      clickTimer.current = null;
    }, 260);
  }
  function handleSlotDoubleClick(
    day: Date,
    hour: number,
    _minute: number,
    event: MouseEvent<HTMLElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = null;
    const currentTime = new Date();
    const slot = resolveCreatableSlotInHour(day, hour, event, currentTime);
    if (!isSlotCreatable(slot.startAt, slot.endAt, currentTime)) {
      setQuickSlot(null);
      setDetailItem(null);
      showStartTimeNotAvailableWarning(slot);
      return;
    }
    setQuickSlot(null);
    setDetailItem(null);
    openFullCreate(slot);
  }
  function handleCardClick(
    item: AppointmentItem,
    event?: MouseEvent<HTMLElement>,
  ) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    const rect = event?.currentTarget.getBoundingClientRect();
    clickTimer.current = setTimeout(() => {
      setDetailItem({
        appointment: item,
        anchorX: rect ? rect.right + 8 : undefined,
        anchorY: rect ? rect.top : undefined,
      });
      setQuickSlot(null);
    }, 260);
  }
  function handleCardDoubleClick(item: AppointmentItem) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = null;
    setDetailItem(null);
    router.push(`/appointments/${item.appointmentId}/edit`);
  }
  function handleTodayClick() {
    router.replace(buildHref(new Date(), initialView, filters));
  }

  const totalCount = visibleAppointments.length;
  const walkInCount = visibleAppointments.filter(
    (a) => a.source === "WALK_IN",
  ).length;
  const waitingTriageCount = visibleAppointments.filter(
    (a) => a.medicalQueue?.queueStatus === "WAITING_TRIAGE",
  ).length;
  const intakeCount = visibleAppointments.filter(
    (a) => a.medicalQueue?.queueStatus === "TRIAGE_IN_PROGRESS",
  ).length;
  const waitingVetCount = visibleAppointments.filter(
    (a) => a.medicalQueue?.queueStatus === "WAITING_VET",
  ).length;
  const inServiceCount = visibleAppointments.filter(
    (a) =>
      a.status === "IN_PROGRESS" ||
      a.medicalQueue?.queueStatus === "IN_SERVICE",
  ).length;
  const completedCount = visibleAppointments.filter(
    (a) => a.status === "COMPLETED",
  ).length;
  const noShowCount = visibleAppointments.filter(
    (a) => a.status === "NO_SHOW",
  ).length;

  return (
    <div className="flex max-h-[calc(100vh-88px)] flex-col gap-3 overflow-hidden">
      <Header />
      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <Toolbar
            selectedDate={selectedDate}
            today={today}
            initialView={initialView}
            filters={filters}
            vets={vets}
            appointmentTypes={appointmentTypes}
            appointmentStatuses={appointmentStatuses}
            onTodayClick={handleTodayClick}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            {initialView === "week" ? (
              <WeekGrid
                weekDays={weekDays}
                timeGrid={timeGrid}
                slotHours={slotHours}
                today={today}
                now={now}
                appointmentsByDate={appointmentsByDate}
                dayStartHour={dayStartHour}
                calendarHeight={calendarHeight}
                intervalMinutes={intervalMinutes}
                onSlotClick={handleSlotClick}
                onSlotDoubleClick={handleSlotDoubleClick}
                onCardClick={handleCardClick}
                onCardDoubleClick={handleCardDoubleClick}
              />
            ) : null}
            {initialView === "day" ? (
              <WeekGrid
                weekDays={[selectedDate]}
                timeGrid={timeGrid}
                slotHours={slotHours}
                today={today}
                now={now}
                appointmentsByDate={appointmentsByDate}
                dayStartHour={dayStartHour}
                calendarHeight={calendarHeight}
                intervalMinutes={intervalMinutes}
                onSlotClick={handleSlotClick}
                onSlotDoubleClick={handleSlotDoubleClick}
                onCardClick={handleCardClick}
                onCardDoubleClick={handleCardDoubleClick}
              />
            ) : null}
            {initialView === "month" ? (
              <MonthView
                date={selectedDate}
                today={today}
                appointmentsByDate={appointmentsByDate}
                onCardClick={handleCardClick}
                onCardDoubleClick={handleCardDoubleClick}
              />
            ) : null}
            {initialView === "year" ? (
              <YearView
                date={selectedDate}
                appointmentsByDate={appointmentsByDate}
                today={today}
              />
            ) : null}
          </div>
          <Legend />
        </section>
        <CalendarSidePanel
          totalCount={totalCount}
          walkInCount={walkInCount}
          waitingTriageCount={waitingTriageCount}
          intakeCount={intakeCount}
          waitingVetCount={waitingVetCount}
          inServiceCount={inServiceCount}
          completedCount={completedCount}
          noShowCount={noShowCount}
        />
      </div>
      {calendarAlert ? (
        <InAppAlertDialog
          title={calendarAlert.title}
          message={calendarAlert.message}
          anchorX={calendarAlert.anchorX}
          anchorY={calendarAlert.anchorY}
          onClose={() => setCalendarAlert(null)}
        />
      ) : null}
      {quickSlot ? (
        <QuickCreatePopover
          slot={quickSlot}
          pets={pets}
          vets={vets}
          appointmentTypes={appointmentTypes}
          onClose={() => setQuickSlot(null)}
          onMoreOptions={() => openFullCreate(quickSlot)}
        />
      ) : null}
      {detailItem ? (
        <DetailPopover
          appointment={detailItem.appointment}
          anchorX={detailItem.anchorX}
          anchorY={detailItem.anchorY}
          vets={vets}
          onClose={() => setDetailItem(null)}
        />
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
        <CalendarIcon className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-[23px] font-semibold tracking-[-0.03em] text-slate-950">
          Appointment Calendar
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Medical scheduling command center.
        </p>
      </div>
    </div>
  );
}
function InAppAlertDialog({
  title,
  message,
  anchorX,
  anchorY,
  onClose,
}: {
  title: string;
  message: string;
  anchorX?: number;
  anchorY?: number;
  onClose: () => void;
}) {
  const width = 360;
  const margin = 16;
  const gap = 12;
  const viewportWidth =
    typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const preferredLeft = (anchorX ?? viewportWidth / 2 - width / 2) + gap;
  const left = Math.min(
    Math.max(preferredLeft, margin),
    Math.max(margin, viewportWidth - width - margin),
  );
  const preferredTop = anchorY ?? viewportHeight / 2 - 64;
  const top = Math.min(
    Math.max(preferredTop, margin),
    Math.max(margin, viewportHeight - 112),
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100]"
      role="alert"
      aria-labelledby="calendar-alert-title"
      aria-describedby="calendar-alert-message"
    >
      <button
        type="button"
        onClick={onClose}
        className="pointer-events-auto fixed w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-lg shadow-slate-300/25 transition hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        style={{ left, top }}
        aria-label={title}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 text-amber-500">
            <SvgIcon className="h-5 w-5">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 4.3 2.7 17.5A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.5L13.7 4.3a2 2 0 0 0-3.4 0Z" />
            </SvgIcon>
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="calendar-alert-title"
              className="text-[13px] font-bold leading-5 text-slate-950"
            >
              {title}
            </h3>
            <p
              id="calendar-alert-message"
              className="mt-1 max-w-full whitespace-normal text-[12px] font-medium leading-5 text-slate-600 [overflow-wrap:normal] [word-break:normal]"
            >
              {message}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

function Toolbar({
  selectedDate,
  today,
  initialView,
  filters,
  vets,
  appointmentTypes,
  appointmentStatuses,
  onTodayClick,
}: {
  selectedDate: Date;
  today: Date;
  initialView: ViewMode;
  filters: Props["filters"];
  vets: VetItem[];
  appointmentTypes: AppointmentType[];
  appointmentStatuses: AppointmentStatus[];
  onTodayClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/80 px-2.5 py-1.5 xl:flex-row xl:items-center xl:justify-between">
      <form className="flex flex-wrap gap-1.5">
        <input type="hidden" name="date" value={toDateValue(selectedDate)} />
        <input type="hidden" name="view" value={initialView} />
        <select
          name="vetId"
          defaultValue={filters.vetId}
          className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm"
        >
          <option value="">All Veterinarians</option>
          {vets.map((v) => (
            <option key={v.userId} value={v.userId}>
              {v.fullName}
            </option>
          ))}
        </select>
        <select
          name="appointmentType"
          defaultValue={filters.appointmentType}
          className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm"
        >
          <option value="">All Types</option>
          {appointmentTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={filters.status}
          className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm"
        >
          <option value="">All Status</option>
          {appointmentStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm">
          Apply
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <Link
            href={buildHref(
              navDate(selectedDate, initialView, -1),
              initialView,
              filters,
            )}
            className="inline-flex h-8 w-8 items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <div className="min-w-[145px] px-2.5 text-center text-xs font-semibold text-slate-900">
            {getViewTitle(selectedDate, initialView)}
          </div>
          <Link
            href={buildHref(
              navDate(selectedDate, initialView, 1),
              initialView,
              filters,
            )}
            className="inline-flex h-8 w-8 items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <Link
          href={buildHref(today, initialView, filters)}
          onClick={onTodayClick}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Today
        </Link>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600 shadow-sm">
          {(["day", "week", "month", "year"] as ViewMode[]).map((m) => (
            <Link
              key={m}
              href={buildHref(selectedDate, m, filters)}
              className={
                m === initialView
                  ? "rounded-lg bg-blue-600 px-2.5 py-1.5 text-white shadow-sm"
                  : "rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
              }
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
function WeekGrid({
  weekDays,
  timeGrid,
  slotHours,
  today,
  now,
  appointmentsByDate,
  dayStartHour,
  calendarHeight,
  intervalMinutes,
  onSlotClick,
  onSlotDoubleClick,
  onCardClick,
  onCardDoubleClick,
}: {
  weekDays: Date[];
  timeGrid: number[];
  slotHours: number[];
  today: Date;
  now: Date;
  appointmentsByDate: Map<string, AppointmentItem[]>;
  dayStartHour: number;
  calendarHeight: number;
  intervalMinutes: number;
  onSlotClick: (
    day: Date,
    hour: number,
    minute: number,
    event: MouseEvent<HTMLElement>,
  ) => void;
  onSlotDoubleClick: (
    day: Date,
    hour: number,
    minute: number,
    event: MouseEvent<HTMLElement>,
  ) => void;
  onCardClick: (a: AppointmentItem, event?: MouseEvent<HTMLElement>) => void;
  onCardDoubleClick: (a: AppointmentItem) => void;
}) {
  const nowTop = getTop(now, dayStartHour);
  const showNowLine = nowTop >= 0 && nowTop <= calendarHeight;
  void intervalMinutes;

  return (
    <div
      className={`grid ${weekDays.length === 1 ? "grid-cols-[56px_minmax(0,1fr)]" : "grid-cols-[56px_repeat(7,minmax(0,1fr))]"}`}
    >
      <div className="border-r border-slate-200 bg-slate-100 px-1 py-1 text-center text-xs font-semibold text-slate-700">
        Time
      </div>
      {weekDays.map((day) => (
        <div
          key={toDateValue(day)}
          className={
            isSameDay(day, today)
              ? "border-r border-slate-200 bg-blue-50 px-1 py-1 text-center"
              : "border-r border-slate-200 bg-slate-100 px-1 py-1 text-center"
          }
        >
          <div className="text-[11px] font-semibold uppercase text-slate-700">
            {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}
          </div>
          <div className="mt-1">
            {isSameDay(day, today) ? (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {day.getDate()}
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-800">
                {day.getDate()}
              </span>
            )}
          </div>
        </div>
      ))}
      <div className="relative border-r border-slate-200">
        {timeGrid.map((h) => (
          <div
            key={h}
            className="border-b border-slate-200 px-1.5 py-1.5 text-right text-sm font-semibold text-slate-700"
            style={{ height: ROW_HEIGHT }}
          >
            {pad(h)}:00
          </div>
        ))}
        {showNowLine ? (
          <div
            className="pointer-events-none absolute right-0 z-20 flex translate-y-[-50%] items-center gap-1 pr-1 text-[10px] font-bold text-rose-600"
            style={{ top: nowTop }}
          >
            <span>{formatTime(now)}</span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
        ) : null}
      </div>
      {weekDays.map((day) => (
        <div
          key={toDateValue(day)}
          className="relative border-r border-slate-200 last:border-r-0"
          style={{ height: calendarHeight }}
        >
          {slotHours.map((h) => (
            <button
              key={h}
              type="button"
              title={`Create appointment ${formatDate(day)} ${pad(h)}:00`}
              onClick={(event) => onSlotClick(day, h, 0, event)}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSlotDoubleClick(day, h, 0, event);
              }}
              className="block w-full border-b border-slate-200 hover:bg-blue-50/40 focus:bg-blue-50/70 focus:outline-none"
              style={{ height: ROW_HEIGHT }}
              aria-label={`Create appointment ${formatDate(day)} ${pad(h)}:00`}
            />
          ))}
          {isSameDay(day, now) && showNowLine ? (
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 h-0.5 bg-rose-500"
              style={{ top: nowTop }}
            />
          ) : null}
          {isSameDay(day, now) && showNowLine ? (
            <div
              className="pointer-events-none absolute left-[-5px] z-20 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-rose-500"
              style={{ top: nowTop }}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0">
            {(appointmentsByDate.get(toDateValue(day)) ?? []).map((a) => {
              const start = new Date(a.startAt);
              const end = new Date(a.endAt);
              return (
                <div
                  key={a.appointmentId}
                  className="pointer-events-auto absolute left-1.5 right-1.5"
                  style={{
                    top: getTop(start, dayStartHour),
                    height: getHeight(start, end),
                  }}
                >
                  <AppointmentCard
                    appointment={a}
                    onClick={(event) => onCardClick(a, event)}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCardDoubleClick(a);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
function AppointmentCard({
  appointment,
  onClick,
  onDoubleClick,
}: {
  appointment: AppointmentItem;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onDoubleClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const s = new Date(appointment.startAt);
  const e = new Date(appointment.endAt);
  const durationMinutes = Math.max(
    1,
    appointment.durationMinutes ||
      Math.round((e.getTime() - s.getTime()) / 60_000),
  );
  const isMiniCard = durationMinutes <= 45;
  const sourceBadge = appointment.source === "WALK_IN" ? "Walk-in" : "ADV";
  const ownerPhoneText = `${appointment.owner.fullName}${appointment.owner.phoneNo ? ` • ${appointment.owner.phoneNo}` : ""}`;

  if (isMiniCard) {
    return (
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={`h-full w-full overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${colorClass(appointment)}`}
        title={`${appointment.pet.petName} • ${ownerPhoneText}`}
      >
        <div className="flex h-full min-h-0 items-start gap-1.5 overflow-hidden">
          <Avatar appointment={appointment} size="sm" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-h-0 items-center justify-between gap-1">
              <span className="min-w-0 truncate rounded-full bg-white/80 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-tight">
                {getStatusLabel(appointment)}
              </span>
              <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-tight">
                {sourceBadge}
              </span>
            </div>
            <div className="mt-[3px] flex min-w-0 items-center justify-between gap-1.5">
              <span className="min-w-[42px] max-w-[42%] truncate text-[11px] font-extrabold leading-[12px] text-slate-950">
                {appointment.pet.petName}
              </span>
              <span className="min-w-0 flex-1 truncate text-right text-[9px] font-semibold leading-[11px] opacity-95">
                {ownerPhoneText}
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`h-full w-full overflow-hidden rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${colorClass(appointment)}`}
      title={`${appointment.pet.petName} • ${ownerPhoneText}`}
    >
      <div className="flex h-full items-start gap-1.5">
        <Avatar appointment={appointment} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
              {getStatusLabel(appointment)}
            </span>
            <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
              {sourceBadge}
            </span>
          </div>
          <div className="mt-1 truncate text-[12px] font-bold text-slate-950">
            {appointment.pet.petName}
          </div>
          <div className="truncate text-[10px] font-semibold opacity-95">
            {ownerPhoneText}
          </div>
        </div>
      </div>
    </button>
  );
}
function Avatar({
  appointment,
  size = "md",
}: {
  appointment: AppointmentItem;
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "h-7 w-7" : "h-12 w-12";
  if (appointment.pet.petPhotoUrl)
    return (
      <Image
        src={appointment.pet.petPhotoUrl}
        alt={appointment.pet.petName}
        width={48}
        height={48}
        className={`${cls} rounded-full object-cover ring-2 ring-white`}
        unoptimized
      />
    );
  return (
    <span
      className={`${cls} flex items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 ring-2 ring-white`}
    >
      {getInitial(appointment.pet.petName)}
    </span>
  );
}
function QuickCreatePopover({
  slot,
  pets,
  vets,
  appointmentTypes,
  onClose,
  onMoreOptions,
}: {
  slot: SlotDraft;
  pets: PetSearchItem[];
  vets: VetItem[];
  appointmentTypes: AppointmentType[];
  onClose: () => void;
  onMoreOptions: () => void;
}) {
  const width = 400;
  const gap = 10;
  const margin = 12;
  const viewportWidth =
    typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const popupHeight = Math.min(
    560,
    viewportHeight * 0.8,
    viewportHeight - margin * 2,
  );
  const anchorLeft = slot.anchorLeft ?? slot.anchorX ?? margin;
  const anchorRight = slot.anchorRight ?? slot.anchorX ?? anchorLeft;
  const anchorTop = slot.anchorY ?? margin;
  const anchorBottom = slot.anchorBottom ?? anchorTop;
  const rightLeft = anchorRight + gap;
  const leftLeft = anchorLeft - width - gap;
  const centerLeft = anchorLeft + (anchorRight - anchorLeft) / 2 - width / 2;
  const preferredLeft =
    rightLeft + width <= viewportWidth - margin
      ? rightLeft
      : leftLeft >= margin
        ? leftLeft
        : centerLeft;
  const left = Math.min(
    Math.max(preferredLeft, margin),
    Math.max(margin, viewportWidth - width - margin),
  );
  const belowTop = anchorBottom + gap;
  const aboveTop = anchorTop - popupHeight - gap;
  const preferredTop =
    belowTop + popupHeight <= viewportHeight - margin
      ? belowTop
      : aboveTop >= margin
        ? aboveTop
        : anchorTop;
  const top = Math.min(
    Math.max(preferredTop, margin),
    Math.max(margin, viewportHeight - popupHeight - margin),
  );

  return (
    <DraggableFloatingCard
      initialLeft={left}
      initialTop={top}
      className="w-[400px] max-w-[calc(100vw-2rem)]"
      title="New Appointment"
      onClose={onClose}
    >
      <AppointmentFormShell
        action={createAppointment}
        slot={slot}
        pets={pets}
        vets={vets}
        appointmentTypes={appointmentTypes}
        compact
        submitLabel="Save"
        onMoreOptions={onMoreOptions}
      />
    </DraggableFloatingCard>
  );
}
function canQuickEditAppointment(appointment: AppointmentItem) {
  return (
    ["BOOKED", "CONFIRMED"].includes(appointment.status) &&
    !appointment.medicalQueue
  );
}

function DetailPopover({
  appointment,
  anchorX,
  anchorY,
  vets,
  onClose,
}: {
  appointment: AppointmentItem;
  anchorX?: number;
  anchorY?: number;
  vets: VetItem[];
  onClose: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const s = new Date(appointment.startAt);
  const e = new Date(appointment.endAt);
  const width = isEditing ? 420 : 360;
  const viewportWidth =
    typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const left = Math.min(
    Math.max(anchorX ?? 96, 16),
    Math.max(16, viewportWidth - width - 16),
  );
  const top = Math.min(
    Math.max(anchorY ?? 96, 16),
    Math.max(16, viewportHeight - (isEditing ? 600 : 440)),
  );
  const appointmentDate = new Date(appointment.startAt);
  const appointmentDay = new Date(appointmentDate);
  appointmentDay.setHours(0, 0, 0, 0);
  const currentDay = new Date();
  currentDay.setHours(0, 0, 0, 0);
  const isTodayAppointment = isSameDay(appointmentDate, currentDay);
  const isFutureAppointment = appointmentDay.getTime() > currentDay.getTime();
  const isTerminalAppointment = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(
    appointment.status,
  );
  const isActiveQueue = Boolean(
    appointment.medicalQueue &&
      !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(
        appointment.medicalQueue.queueStatus,
      ),
  );
  const canEdit =
    isTodayAppointment &&
    !isTerminalAppointment &&
    !isActiveQueue &&
    canQuickEditAppointment(appointment);
  const showQueueAction =
    isTodayAppointment && !isTerminalAppointment && isActiveQueue;
  const showWorkflowActions =
    (isTodayAppointment || isFutureAppointment) &&
    !isTerminalAppointment &&
    !isActiveQueue;
  const showCheckInAction =
    isTodayAppointment && showWorkflowActions && canCheckInNow(appointment);
  const showNoShowAction =
    isTodayAppointment &&
    showWorkflowActions &&
    canNoShowAppointment(appointment);
  const showCancelAction =
    showWorkflowActions && canCancelAppointmentFromCalendar(appointment);

  return (
    <FloatingCard
      className={
        isEditing
          ? "w-[420px] max-w-[calc(100vw-2rem)]"
          : "w-[360px] max-w-[calc(100vw-2rem)]"
      }
      style={{ left, top }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar appointment={appointment} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight text-slate-950">
              {appointment.pet.petName}
            </div>
            <div className="truncate text-xs text-slate-500">
              {appointment.pet.breed?.breedName ??
                appointment.pet.species?.speciesName ??
                "Pet"}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {getSourceLabel(appointment.source)}
              </span>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                {getTypeLabel(appointment.appointmentType)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {getStatusLabel(appointment)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEdit ? (
            <button
              type="button"
              onClick={() => setIsEditing((value) => !value)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
              title="Quick edit date/time"
            >
              <EditIcon className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <QuickEditAppointmentForm
          appointment={appointment}
          vets={vets}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <div className="space-y-2.5 px-3.5 py-3 text-xs">
          <InfoRow
            icon={<UserIcon className="h-4 w-4" />}
            label="Owner"
            value={`${appointment.owner.fullName}${appointment.owner.phoneNo ? ` • ${appointment.owner.phoneNo}` : ""}`}
          />
          <InfoRow
            icon={<VetIcon className="h-4 w-4" />}
            label="Veterinarian"
            value={appointment.vet?.fullName ?? "-"}
          />
          <InfoRow
            icon={<ClockIcon className="h-4 w-4" />}
            label="Time"
            value={`${formatLongDate(s)} • ${formatTime(s)} – ${formatTime(e)} (${appointment.durationMinutes} min)`}
          />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              href={`/appointments/${appointment.appointmentId}?from=calendar`}
              className="rounded-xl bg-blue-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              View Appointment
            </Link>
            {showQueueAction ? (
              <Link
                href="/medical-queue"
                className="rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View Queue
              </Link>
            ) : null}
            {showCheckInAction ? (
              <ActionButton
                action={checkInAppointment}
                appointment={appointment}
                label="Check-In"
              />
            ) : null}
            {showNoShowAction ? (
              <ActionButton
                action={markNoShowAppointment}
                appointment={appointment}
                label="No Show"
                danger
              />
            ) : null}
          </div>
          {showCancelAction ? (
            <form action={cancelAppointment} className="pt-1">
              <input
                type="hidden"
                name="appointmentId"
                value={appointment.appointmentId}
              />
              <input type="hidden" name="redirectToCalendar" value="1" />
              <button className="w-full rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                Cancel Appointment
              </button>
            </form>
          ) : null}
          {!showCheckInAction &&
          isTodayAppointment &&
          showWorkflowActions &&
          ["BOOKED", "CONFIRMED"].includes(appointment.status) ? (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
              Check-in is available today.
            </div>
          ) : null}
        </div>
      )}
    </FloatingCard>
  );
}

function QuickEditAppointmentForm({
  appointment,
  vets,
  onCancel,
}: {
  appointment: AppointmentItem;
  vets: VetItem[];
  onCancel: () => void;
}) {
  const s = new Date(appointment.startAt);
  const e = new Date(appointment.endAt);
  const [date, setDate] = useState(toDateValue(s));
  const [startTime, setStartTime] = useState(toTimeValue(s));
  const [endTime, setEndTime] = useState(toTimeValue(e));
  const [vetId, setVetId] = useState(appointment.vet?.userId ?? "");
  const startAtValue = `${date}T${startTime}`;
  const endAtValue = `${date}T${endTime}`;

  return (
    <form action={updateAppointment} className="space-y-3 px-4 py-3 text-xs">
      <input
        type="hidden"
        name="appointmentId"
        value={appointment.appointmentId}
      />
      <input type="hidden" name="ownerId" value={appointment.owner.ownerId} />
      <input type="hidden" name="petId" value={appointment.pet.petId} />
      <input
        type="hidden"
        name="appointmentType"
        value={appointment.appointmentType}
      />
      <input type="hidden" name="source" value={appointment.source} />
      <input type="hidden" name="status" value={appointment.status} />
      <input type="hidden" name="startAt" value={startAtValue} />
      <input type="hidden" name="endAt" value={endAtValue} />
      <input type="hidden" name="redirectToCalendar" value="1" />

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-medium text-blue-800">
        Quick edit is allowed only before check-in. After check-in, use
        cancel/reschedule flow instead.
      </div>

      <Field icon={<CalendarIcon className="h-4 w-4" />} label="Date" required>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field icon={<ClockIcon className="h-4 w-4" />} label="Start" required>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="input"
          />
        </Field>
        <Field icon={<ClockIcon className="h-4 w-4" />} label="End" required>
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="input"
          />
        </Field>
      </div>

      <Field
        icon={<VetIcon className="h-4 w-4" />}
        label="Veterinarian"
        required
      >
        <select
          name="vetId"
          value={vetId}
          onChange={(event) => setVetId(event.target.value)}
          className="input"
        >
          <option value="">Select veterinarian</option>
          {vets.map((vet) => (
            <option key={vet.userId} value={vet.userId}>
              {vet.fullName}
            </option>
          ))}
        </select>
      </Field>

      <Field icon={<CalendarIcon className="h-4 w-4" />} label="Note">
        <textarea
          name="note"
          defaultValue={appointment.note ?? ""}
          className="input min-h-[84px]"
          placeholder="Update note"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}

function FloatingCard({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`fixed z-50 rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-400/30 ${className}`}
    >
      {children}
    </div>
  );
}
function DraggableFloatingCard({
  children,
  className,
  initialLeft,
  initialTop,
  title,
  onClose,
}: {
  children: ReactNode;
  className: string;
  initialLeft: number;
  initialTop: number;
  title: string;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({
    left: initialLeft,
    top: initialTop,
  });

  function clampPosition(left: number, top: number) {
    if (typeof window === "undefined") return { left, top };
    const rect = cardRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 480;
    const height =
      rect?.height ??
      Math.min(window.innerHeight * 0.8, window.innerHeight - 24);
    return {
      left: Math.min(
        Math.max(left, 8),
        Math.max(8, window.innerWidth - width - 8),
      ),
      top: Math.min(
        Math.max(top, 8),
        Math.max(8, window.innerHeight - height - 8),
      ),
    };
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = position;

    function handleMove(moveEvent: PointerEvent) {
      setPosition(
        clampPosition(
          origin.left + moveEvent.clientX - startX,
          origin.top + moveEvent.clientY - startY,
        ),
      );
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  }

  return (
    <div
      ref={cardRef}
      style={{ left: position.left, top: position.top }}
      className={`fixed z-50 max-h-[80vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-400/30 ${className}`}
    >
      <FormHeader
        title={title}
        onClose={onClose}
        dragHandleProps={{ onPointerDown: handleDragStart }}
      />
      <div className="max-h-[calc(80vh-52px)] overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
function FormHeader({
  title,
  onClose,
  saveButton,
  dragHandleProps,
}: {
  title: string;
  onClose: () => void;
  saveButton?: boolean;
  dragHandleProps?: {
    onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  };
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1">
      <div
        {...dragHandleProps}
        className={
          dragHandleProps
            ? "flex min-w-0 flex-1 cursor-move items-center gap-2.5 select-none"
            : "flex items-center gap-2.5"
        }
      >
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          type="button"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
      </div>
      {saveButton ? (
        <button
          form="appointment-calendar-form"
          className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Save
        </button>
      ) : null}
    </div>
  );
}
function AppointmentFormShell({
  action,
  mode = "create",
  appointment,
  slot,
  pets,
  vets,
  appointmentTypes,
  compact,
  full,
  submitLabel,
  onMoreOptions,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mode?: "create" | "edit";
  appointment?: AppointmentItem;
  slot: SlotDraft;
  pets: PetSearchItem[];
  vets: VetItem[];
  appointmentTypes: AppointmentType[];
  compact?: boolean;
  full?: boolean;
  submitLabel: string;
  onMoreOptions?: () => void;
}) {
  const defaultPet = appointment
    ? (pets.find((p) => p.petId === appointment.pet.petId) ?? null)
    : null;
  const ownerOptions = useMemo(() => {
    const map = new Map<string, PetSearchItem["owner"]>();
    for (const pet of pets) map.set(pet.owner.ownerId, pet.owner);
    return Array.from(map.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    );
  }, [pets]);
  const defaultDurationMinutes = Math.max(
    15,
    Math.round((slot.endAt.getTime() - slot.startAt.getTime()) / 60_000) || 30,
  );
  const [dateValue, setDateValue] = useState(toDateValue(slot.startAt));
  const [startValue, setStartValue] = useState(toDateTimeLocal(slot.startAt));
  const [endValue, setEndValue] = useState(toDateTimeLocal(slot.endAt));
  const [clientError, setClientError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState(defaultPet?.owner.ownerId ?? "");
  const [ownerQuery, setOwnerQuery] = useState(
    defaultPet ? ownerOptionText(defaultPet.owner) : "",
  );
  const [ownerSearchOpen, setOwnerSearchOpen] = useState(false);
  const [petId, setPetId] = useState(defaultPet?.petId ?? "");
  const [petQuery, setPetQuery] = useState(
    defaultPet ? selectedPetText(defaultPet) : "",
  );
  const [petSearchOpen, setPetSearchOpen] = useState(false);
  const ownerLovRef = useRef<HTMLDivElement | null>(null);
  const petLovRef = useRef<HTMLDivElement | null>(null);
  const vetLovRef = useRef<HTMLDivElement | null>(null);
  const appointmentTypeLovRef = useRef<HTMLDivElement | null>(null);
  const ownerInputRef = useRef<HTMLInputElement | null>(null);
  const petInputRef = useRef<HTMLInputElement | null>(null);
  const vetInputRef = useRef<HTMLInputElement | null>(null);
  const appointmentTypeInputRef = useRef<HTMLInputElement | null>(null);
  const [vetId, setVetId] = useState(appointment?.vet?.userId ?? "");
  const [appointmentType, setAppointmentType] = useState(
    appointment?.appointmentType ?? "",
  );
  const [vetQuery, setVetQuery] = useState(appointment?.vet?.fullName ?? "");
  const [vetSearchOpen, setVetSearchOpen] = useState(false);
  const [appointmentTypeQuery, setAppointmentTypeQuery] = useState(
    appointment?.appointmentType ?? "",
  );
  const [appointmentTypeSearchOpen, setAppointmentTypeSearchOpen] =
    useState(false);
  const [source, setSource] = useState(
    appointment?.source === "WALK_IN" ? "WALK_IN" : "ADVANCE_BOOKING",
  );
  const ownerFilteredPets = ownerId
    ? pets.filter((p) => p.owner.ownerId === ownerId)
    : pets;
  const selectedOwner =
    ownerOptions.find((owner) => owner.ownerId === ownerId) ?? null;
  const selectedPet = pets.find((p) => p.petId === petId) ?? null;
  const ownerSearchTerm = ownerQuery.trim().toLowerCase();
  const petSearchTerm = petQuery.trim().toLowerCase();
  const ownerMatches = pets.filter((pet) => {
    const searchableText = [
      pet.owner.fullName,
      pet.owner.phoneNo ?? "",
      pet.petName,
      pet.speciesName ?? "",
      pet.breedName ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(ownerSearchTerm);
  });
  const petMatches = ownerFilteredPets.filter((pet) =>
    selectedPetText(pet).toLowerCase().includes(petSearchTerm),
  );
  const vetSearchTerm = vetQuery.trim().toLowerCase();
  const vetMatches = vets.filter((vet) =>
    vet.fullName.toLowerCase().includes(vetSearchTerm),
  );
  const appointmentTypeSearchTerm = appointmentTypeQuery.trim().toLowerCase();
  const appointmentTypeMatches = appointmentTypes.filter((type) =>
    String(type).toLowerCase().includes(appointmentTypeSearchTerm),
  );
  const missingOwner = !ownerId;
  const missingPet = !petId;
  const missingVet = !vetId;
  const missingType = !appointmentType;
  const canSave = Boolean(
    ownerId && petId && vetId && appointmentType && source,
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (ownerLovRef.current && !ownerLovRef.current.contains(target))
        setOwnerSearchOpen(false);
      if (petLovRef.current && !petLovRef.current.contains(target))
        setPetSearchOpen(false);
      if (vetLovRef.current && !vetLovRef.current.contains(target))
        setVetSearchOpen(false);
      if (
        appointmentTypeLovRef.current &&
        !appointmentTypeLovRef.current.contains(target)
      )
        setAppointmentTypeSearchOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOwnerSearchOpen(false);
        setPetSearchOpen(false);
        setVetSearchOpen(false);
        setAppointmentTypeSearchOpen(false);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function mergeDateAndTime(datePart: string, dateTimeValue: string) {
    const timePart = dateTimeValue.includes("T")
      ? dateTimeValue.split("T")[1]
      : "09:00";
    return `${datePart}T${timePart}`;
  }

  function handleDateChange(value: string) {
    setDateValue(value);
    setStartValue((current) => mergeDateAndTime(value, current));
    setEndValue((current) => mergeDateAndTime(value, current));
  }

  function handleStartChange(value: string) {
    setStartValue(value);
    const start = new Date(value);
    if (!Number.isNaN(start.getTime())) {
      setDateValue(toDateValue(start));
      const end = new Date(endValue);
      if (Number.isNaN(end.getTime()) || end <= start) {
        setEndValue(
          toDateTimeLocal(
            new Date(start.getTime() + defaultDurationMinutes * 60_000),
          ),
        );
      } else if (toDateValue(end) !== toDateValue(start)) {
        setEndValue(mergeDateAndTime(toDateValue(start), endValue));
      }
    }
  }

  function handleEndChange(value: string) {
    setEndValue(value);
    const end = new Date(value);
    if (!Number.isNaN(end.getTime())) setDateValue(toDateValue(end));
  }

  function chooseOwnerPet(pet: PetSearchItem) {
    setOwnerId(pet.owner.ownerId);
    setOwnerQuery(ownerOptionText(pet.owner));
    setPetId(pet.petId);
    setPetQuery(selectedPetText(pet));
    setOwnerSearchOpen(false);
    setPetSearchOpen(false);
  }

  function choosePet(pet: PetSearchItem) {
    setPetId(pet.petId);
    setPetQuery(selectedPetText(pet));
    setOwnerId(pet.owner.ownerId);
    setOwnerQuery(ownerOptionText(pet.owner));
    setPetSearchOpen(false);
    setOwnerSearchOpen(false);
  }

  function clearOwner() {
    setOwnerId("");
    setOwnerQuery("");
    setPetId("");
    setPetQuery("");
    setOwnerSearchOpen(false);
    setPetSearchOpen(false);
    window.setTimeout(() => {
      ownerInputRef.current?.focus();
      setOwnerSearchOpen(false);
    }, 0);
  }

  function clearPet() {
    setPetId("");
    setPetQuery("");
    setPetSearchOpen(false);
    window.setTimeout(() => {
      petInputRef.current?.focus();
      setPetSearchOpen(false);
    }, 0);
  }

  function handleOwnerLovBlur() {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      if (
        ownerLovRef.current &&
        activeElement &&
        ownerLovRef.current.contains(activeElement)
      )
        return;
      setOwnerSearchOpen(false);
    }, 120);
  }

  function handlePetLovBlur() {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      if (
        petLovRef.current &&
        activeElement &&
        petLovRef.current.contains(activeElement)
      )
        return;
      setPetSearchOpen(false);
    }, 120);
  }

  function openOwnerLov() {
    setOwnerSearchOpen(true);
    setPetSearchOpen(false);
  }

  function openPetLov() {
    setPetSearchOpen(true);
    setOwnerSearchOpen(false);
  }

  function handleOwnerInputMouseDown(event: MouseEvent<HTMLInputElement>) {
    if (document.activeElement !== ownerInputRef.current) return;
    event.preventDefault();
    setOwnerSearchOpen((open) => !open);
    setPetSearchOpen(false);
  }

  function handlePetInputMouseDown(event: MouseEvent<HTMLInputElement>) {
    if (document.activeElement !== petInputRef.current) return;
    event.preventDefault();
    setPetSearchOpen((open) => !open);
    setOwnerSearchOpen(false);
  }

  function closeOwnerLovIfOpen() {
    if (ownerSearchOpen) setOwnerSearchOpen(false);
  }

  function closePetLovIfOpen() {
    if (petSearchOpen) setPetSearchOpen(false);
  }

  function openVetLov() {
    setVetSearchOpen(true);
    setOwnerSearchOpen(false);
    setPetSearchOpen(false);
    setAppointmentTypeSearchOpen(false);
  }

  function openAppointmentTypeLov() {
    setAppointmentTypeSearchOpen(true);
    setOwnerSearchOpen(false);
    setPetSearchOpen(false);
    setVetSearchOpen(false);
  }

  function chooseVet(vet: VetItem) {
    setVetId(vet.userId);
    setVetQuery(vet.fullName);
    setVetSearchOpen(false);
  }

  function chooseAppointmentType(type: AppointmentType) {
    setAppointmentType(type);
    setAppointmentTypeQuery(String(type));
    setAppointmentTypeSearchOpen(false);
  }


  function closeVetLovIfOpen() {
    if (vetSearchOpen) setVetSearchOpen(false);
  }

  function closeAppointmentTypeLovIfOpen() {
    if (appointmentTypeSearchOpen) setAppointmentTypeSearchOpen(false);
  }

  function handleVetInputMouseDown(event: MouseEvent<HTMLInputElement>) {
    if (document.activeElement !== vetInputRef.current) return;
    event.preventDefault();
    setVetSearchOpen((open) => !open);
    setOwnerSearchOpen(false);
    setPetSearchOpen(false);
    setAppointmentTypeSearchOpen(false);
  }

  function handleAppointmentTypeInputMouseDown(
    event: MouseEvent<HTMLInputElement>,
  ) {
    if (document.activeElement !== appointmentTypeInputRef.current) return;
    event.preventDefault();
    setAppointmentTypeSearchOpen((open) => !open);
    setOwnerSearchOpen(false);
    setPetSearchOpen(false);
    setVetSearchOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setClientError(null);
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (!source || !canSave) return;
    if (source === "ADVANCE_BOOKING") {
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        event.preventDefault();
        setClientError("Please verify appointment date and time.");
        return;
      }
      if (start.getTime() < Date.now() - 60_000) {
        event.preventDefault();
        setClientError("Appointment start time cannot be in the past.");
      }
    }
  }

  return (
    <form
      id="appointment-calendar-form"
      action={action}
      onSubmit={handleSubmit}
      className={
        full
          ? "grid gap-5 lg:grid-cols-2"
          : "space-y-1.5 px-3 pb-3 text-[12px] [&_.input]:h-[30px] [&_.input]:min-h-[30px] [&_.input]:rounded-lg [&_.input]:px-3 [&_.input]:py-1 [&_.input]:text-[12px] [&_.input]:font-normal [&_.source-option]:h-[30px] [&_.source-option]:rounded-lg [&_.source-option]:px-3 [&_.source-option]:py-1 [&_.source-option]:text-[12px]"
      }
    >
      {mode === "edit" && appointment ? (
        <input
          type="hidden"
          name="appointmentId"
          value={appointment.appointmentId}
        />
      ) : null}
      <input type="hidden" name="redirectToCalendar" value="1" />
      <input
        type="hidden"
        name="status"
        value={appointment?.status ?? "BOOKED"}
      />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="petId" value={petId} />
      {clientError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {clientError}
        </div>
      ) : null}

      <Field icon={<CalendarIcon className="h-4 w-4" />} label="Date">
        <input
          name="appointmentDate"
          type="date"
          value={dateValue}
          onChange={(event) => handleDateChange(event.target.value)}
          className="input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field icon={<ClockIcon className="h-4 w-4" />} label="Start">
          <input
            name="startAt"
            type="datetime-local"
            value={startValue}
            onChange={(event) => handleStartChange(event.target.value)}
            className="input"
          />
        </Field>
        <Field icon={<ClockIcon className="h-4 w-4" />} label="End">
          <input
            name="endAt"
            type="datetime-local"
            value={endValue}
            onChange={(event) => handleEndChange(event.target.value)}
            className="input"
          />
        </Field>
      </div>
      <Field
        icon={<UserIcon className="h-4 w-4" />}
        label="Owner"
        required
        error={missingOwner ? "Owner is required" : undefined}
      >
        <div ref={ownerLovRef} onBlur={handleOwnerLovBlur} className="relative">
          <div className="relative">
            <input
              ref={ownerInputRef}
              value={ownerQuery}
              onMouseDown={handleOwnerInputMouseDown}
              onFocus={openOwnerLov}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeOwnerLovIfOpen();
                if (event.key === "ArrowDown") openOwnerLov();
              }}
              onChange={(e) => {
                const value = e.target.value;
                setOwnerQuery(value);
                openOwnerLov();
                if (!value.trim() || ownerId) {
                  setOwnerId("");
                  setPetId("");
                  setPetQuery("");
                }
              }}
              placeholder="Search owner or phone"
              className={
                missingOwner
                  ? "input pr-16 border-rose-300 focus:border-rose-500"
                  : "input pr-16"
              }
            />
            {ownerQuery ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearOwner}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
              >
                Clear
              </button>
            ) : null}
          </div>
          {ownerSearchOpen ? (
            <div className="absolute left-0 right-0 z-[70] mt-1 w-full min-w-full max-h-[220px] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-300/40">
              {ownerMatches.length ? (
                ownerMatches.map((pet) => (
                  <button
                    key={`${pet.owner.ownerId}-${pet.petId}`}
                    type="button"
                    onClick={() => chooseOwnerPet(pet)}
                    className={
                      pet.petId === petId
                        ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none"
                        : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"
                    }
                  >
                    <span className="block truncate text-xs font-bold text-slate-900">
                      {pet.owner.fullName}
                      {pet.owner.phoneNo ? ` • ${pet.owner.phoneNo}` : ""}
                    </span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">
                      {pet.petName}
                      {pet.speciesName ? ` • ${pet.speciesName}` : ""}
                      {pet.breedName ? ` • ${pet.breedName}` : ""}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                  No owner or pet found
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Field>
      <Field
        icon={<PawIcon className="h-4 w-4" />}
        label="Pet"
        required
        error={missingPet ? "Pet is required" : undefined}
      >
        <div ref={petLovRef} onBlur={handlePetLovBlur} className="relative">
          <div className="relative">
            <input
              ref={petInputRef}
              value={petQuery}
              onMouseDown={handlePetInputMouseDown}
              onFocus={openPetLov}
              onKeyDown={(event) => {
                if (event.key === "Escape") closePetLovIfOpen();
                if (event.key === "ArrowDown") openPetLov();
              }}
              onChange={(e) => {
                const value = e.target.value;
                setPetQuery(value);
                openPetLov();
                if (!value.trim() || petId) setPetId("");
              }}
              placeholder={
                ownerId ? "Search pet" : "Search pet to resolve owner"
              }
              className={
                missingPet
                  ? "input pr-16 border-rose-300 focus:border-rose-500"
                  : "input pr-16"
              }
            />
            {petQuery ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearPet}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
              >
                Clear
              </button>
            ) : null}
          </div>
          {petSearchOpen ? (
            <div className="absolute left-0 right-0 z-[70] mt-1 w-full min-w-full max-h-[220px] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-300/40">
              {petMatches.length ? (
                petMatches.map((pet) => (
                  <button
                    key={pet.petId}
                    type="button"
                    onClick={() => choosePet(pet)}
                    className={
                      pet.petId === petId
                        ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none"
                        : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"
                    }
                  >
                    <span className="block truncate text-xs font-bold text-slate-900">
                      {pet.petName}
                    </span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">
                      {pet.owner.fullName}
                      {pet.owner.phoneNo ? ` • ${pet.owner.phoneNo}` : ""}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                  No pet found
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Field>
      <Field
        icon={<VetIcon className="h-4 w-4" />}
        label="Veterinarian"
        required
        error={missingVet ? "Veterinarian is required" : undefined}
      >
        <div ref={vetLovRef} className="relative">
          <input type="hidden" name="vetId" value={vetId} />
          <div className="relative">
            <input
              ref={vetInputRef}
              value={vetQuery}
              onMouseDown={handleVetInputMouseDown}
              onFocus={openVetLov}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeVetLovIfOpen();
                if (event.key === "ArrowDown") openVetLov();
              }}
              onChange={(event) => {
                const value = event.target.value;
                setVetQuery(value);
                openVetLov();
                if (!value.trim() || vetId) setVetId("");
              }}
              placeholder="Search veterinarian"
              className={
                missingVet
                  ? "input pr-3 border-rose-300 focus:border-rose-500 font-normal"
                  : "input pr-3 font-normal"
              }
            />
          </div>
          {vetSearchOpen ? (
            <div
              className="z-[9999] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-300/40"
              style={getFixedLovStyle(vetInputRef.current)}
            >
              {vetMatches.length ? (
                vetMatches.map((vet) => (
                  <button
                    key={vet.userId}
                    type="button"
                    onClick={() => chooseVet(vet)}
                    className={
                      vet.userId === vetId
                        ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none"
                        : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"
                    }
                  >
                    <span className="block truncate text-xs font-normal text-slate-900">
                      {vet.fullName}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                  No veterinarian found
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Field>
      <Field
        icon={<CalendarIcon className="h-4 w-4" />}
        label="Appointment Source"
        required
      >
        <div className="grid grid-cols-2 gap-2">
          <label
            className={
              source === "ADVANCE_BOOKING"
                ? "source-option source-option-active"
                : "source-option"
            }
          >
            <input
              type="radio"
              name="source"
              value="ADVANCE_BOOKING"
              checked={source === "ADVANCE_BOOKING"}
              onChange={() => setSource("ADVANCE_BOOKING")}
            />
            Advance Booking
          </label>
          <label
            className={
              source === "WALK_IN"
                ? "source-option source-option-active"
                : "source-option"
            }
          >
            <input
              type="radio"
              name="source"
              value="WALK_IN"
              checked={source === "WALK_IN"}
              onChange={() => setSource("WALK_IN")}
            />
            Walk-in
          </label>
        </div>
        {source === "WALK_IN" ? (
          <p className="mt-1 text-[10px] font-medium text-orange-700">
            Walk-in will create a queue automatically.
          </p>
        ) : null}
      </Field>
      <Field
        icon={<PawIcon className="h-4 w-4" />}
        label="Appointment type"
        required
        error={missingType ? "Appointment type is required" : undefined}
      >
        <div ref={appointmentTypeLovRef} className="relative">
          <input type="hidden" name="appointmentType" value={appointmentType} />
          <div className="relative">
            <input
              ref={appointmentTypeInputRef}
              value={appointmentTypeQuery}
              onMouseDown={handleAppointmentTypeInputMouseDown}
              onFocus={openAppointmentTypeLov}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeAppointmentTypeLovIfOpen();
                if (event.key === "ArrowDown") openAppointmentTypeLov();
              }}
              onChange={(event) => {
                const value = event.target.value;
                setAppointmentTypeQuery(value);
                openAppointmentTypeLov();
                if (!value.trim() || appointmentType) setAppointmentType("");
              }}
              placeholder="Search appointment type"
              className={
                missingType
                  ? "input pr-3 border-rose-300 focus:border-rose-500 font-normal"
                  : "input pr-3 font-normal"
              }
            />
          </div>
          {appointmentTypeSearchOpen ? (
            <div
              className="z-[9999] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-300/40"
              style={getFixedLovStyle(appointmentTypeInputRef.current)}
            >
              {appointmentTypeMatches.length ? (
                appointmentTypeMatches.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => chooseAppointmentType(type)}
                    className={
                      type === appointmentType
                        ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none"
                        : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"
                    }
                  >
                    <span className="block truncate text-xs font-normal text-slate-900">
                      {type}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                  No appointment type found
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Field>
      {full ? (
        <Field icon={<CalendarIcon />} label="Reason / Chief Complaint">
          <textarea
            name="note"
            defaultValue={appointment ? "" : undefined}
            placeholder="Enter reason"
            className="input min-h-[110px]"
          />
        </Field>
      ) : null}
      {compact ? (
        <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-3 pt-2">
          <button
            type="button"
            disabled
            title="Temporarily disabled"
            className="h-[32px] cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-400"
          >
            More Options
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="h-[32px] rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitLabel}
          </button>
        </div>
      ) : null}
    </form>
  );
}
function Field({
  icon,
  label,
  required,
  error,
  children,
}: {
  icon: ReactNode;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-700">
        {icon}
        <span>
          {label}
          {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
        </span>
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-semibold text-rose-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-slate-500">{icon}</div>
      <div>
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="font-medium text-slate-900">{value}</div>
      </div>
    </div>
  );
}
function ActionButton({
  action,
  appointment,
  label,
  disabled,
  danger,
}: {
  action: (formData: FormData) => void | Promise<void>;
  appointment: AppointmentItem;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <form action={disabled ? undefined : action}>
      <input
        type="hidden"
        name="appointmentId"
        value={appointment.appointmentId}
      />
      <input type="hidden" name="redirectToCalendar" value="1" />
      <button
        type="submit"
        disabled={disabled}
        className={
          danger
            ? "w-full rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            : "w-full rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        {label}
      </button>
    </form>
  );
}
function MonthView({
  date,
  today,
  appointmentsByDate,
  onCardClick,
  onCardDoubleClick,
}: {
  date: Date;
  today: Date;
  appointmentsByDate: Map<string, AppointmentItem[]>;
  onCardClick: (a: AppointmentItem, event?: MouseEvent<HTMLElement>) => void;
  onCardDoubleClick: (a: AppointmentItem) => void;
}) {
  const first = startOfWeek(startOfMonth(date));
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  return (
    <div className="grid grid-cols-7 border-t border-slate-200">
      {days.map((day) => {
        const key = toDateValue(day);
        const items = appointmentsByDate.get(key) ?? [];
        return (
          <div
            key={key}
            className={
              day.getMonth() === date.getMonth()
                ? "min-h-[126px] border-b border-r border-slate-200 p-2"
                : "min-h-[126px] border-b border-r border-slate-200 bg-slate-50 p-2 text-slate-400"
            }
          >
            <div className="mb-2 text-xs font-semibold">
              {isSameDay(day, today) ? (
                <span className="rounded-full bg-blue-600 px-2 py-1 text-white">
                  {day.getDate()}
                </span>
              ) : (
                day.getDate()
              )}
            </div>
            <div className="space-y-1">
              {items.slice(0, 3).map((a) => (
                <AppointmentCard
                  key={a.appointmentId}
                  appointment={a}
                  onClick={(event) => {
                    if (event.detail >= 2) onCardDoubleClick(a);
                    else onCardClick(a, event);
                  }}
                />
              ))}
              {items.length > 3 ? (
                <div className="text-xs font-semibold text-slate-500">
                  +{items.length - 3} more
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function YearView({
  date,
  appointmentsByDate,
  today,
}: {
  date: Date;
  appointmentsByDate: Map<string, AppointmentItem[]>;
  today: Date;
}) {
  const months = Array.from(
    { length: 12 },
    (_, i) => new Date(date.getFullYear(), i, 1),
  );
  return (
    <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-4">
      {months.map((m) => {
        const start = startOfMonth(m);
        const end = addDays(endOfMonth(m), 1);
        const count = Array.from(appointmentsByDate.entries())
          .filter(([k]) => {
            const d = parseDate(k);
            return d >= start && d < end;
          })
          .reduce((s, [, items]) => s + items.length, 0);
        return (
          <Link
            key={m.toISOString()}
            href={buildHref(m, "month", {
              vetId: "",
              appointmentType: "",
              status: "",
            })}
            className={
              m.getMonth() === today.getMonth() &&
              m.getFullYear() === today.getFullYear()
                ? "rounded-2xl border border-blue-300 bg-blue-50 p-4"
                : "rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
            }
          >
            <div className="text-sm font-semibold text-slate-900">
              {new Intl.DateTimeFormat("en-US", { month: "long" }).format(m)}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {count}
            </div>
            <div className="text-xs text-slate-500">appointments</div>
          </Link>
        );
      })}
    </div>
  );
}
function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600">
      <LegendDot color="bg-blue-600" label="Scheduled" />
      <LegendDot color="bg-cyan-500" label="Waiting Triage" />
      <LegendDot color="bg-orange-500" label="Waiting Vet" />
      <LegendDot color="bg-violet-500" label="In Service" />
      <LegendDot color="bg-slate-400" label="Completed" />
      <LegendDot color="bg-rose-500" label="Cancelled" />
      <LegendDot color="bg-zinc-600" label="No Show" />
    </div>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
function CalendarSidePanel({
  totalCount,
  walkInCount,
  waitingTriageCount,
  intakeCount,
  waitingVetCount,
  inServiceCount,
  completedCount,
  noShowCount,
}: {
  totalCount: number;
  walkInCount: number;
  waitingTriageCount: number;
  intakeCount: number;
  waitingVetCount: number;
  inServiceCount: number;
  completedCount: number;
  noShowCount: number;
}) {
  return (
    <aside className="hidden xl:block">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-950">
            Today's Operations
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Queue-aware operation summary
          </p>
        </div>
        <div className="mt-3 space-y-1.5">
          <OverviewRow
            color="bg-blue-600"
            label="Appointments"
            value={totalCount}
          />
          <OverviewRow color="bg-sky-500" label="Walk-in" value={walkInCount} />
          <OverviewRow
            color="bg-cyan-500"
            label="Waiting Triage"
            value={waitingTriageCount}
          />
          <OverviewRow color="bg-teal-500" label="Intake" value={intakeCount} />
          <OverviewRow
            color="bg-orange-500"
            label="Waiting Vet"
            value={waitingVetCount}
          />
          <OverviewRow
            color="bg-violet-500"
            label="In Service"
            value={inServiceCount}
          />
          <OverviewRow
            color="bg-emerald-500"
            label="Completed"
            value={completedCount}
          />
          <OverviewRow
            color="bg-zinc-600"
            label="No Show"
            value={noShowCount}
          />
        </div>
        <Link
          href="/medical-queue"
          className="mt-4 flex items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          View Full Queue →
        </Link>
      </div>
    </aside>
  );
}

function OverviewRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </span>
      <span className="text-sm font-bold text-slate-950">{value}</span>
    </div>
  );
}
function OverviewCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
    </div>
  );
}
