"use client";

import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";

type CalendarMode = "day" | "week" | "month";
type ServiceGroup = "TREATMENT" | "GROOMING" | "SURGERY" | "BOARDING";
type QueueStatus =
  | "WAITING_TRIAGE"
  | "TRIAGE_IN_PROGRESS"
  | "WAITING_VET"
  | "IN_SERVICE"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

type ResourceItem = {
  userId: string;
  fullName: string;
  role: string;
};

type DndAppointment = {
  appointmentId: string;
  appointmentNo: string;
  appointmentDate: string;
  appointmentType: string;
  status: string;
  ownerName: string;
  petName: string;
  vetId: string | null;
  vetName: string | null;
  queue: {
    queueNumber: number;
    queueCode?: string | null;
    queueStatus: QueueStatus;
  } | null;
};

type DndBlockTime = {
  blockTimeId: string;
  title: string;
  blockType: string;
  startDateTime: string;
  endDateTime: string;
  veterinarianId: string | null;
  veterinarianName: string | null;
  groomerId: string | null;
  groomerName: string | null;
};

type SlotItem = {
  key: string;
  hour: number;
  minute: number;
  label: string;
};

type PendingDrop = {
  appointmentId: string;
  appointmentNo: string;
  petName: string;
  oldDateTime: string;
  newDateTime: string;
  resourceId: string;
  resourceName: string;
};

type ResourceCalendarDndProps = {
  hours: number[];
  resources: ResourceItem[];
  appointments: DndAppointment[];
  blockTimes: DndBlockTime[];
  calendarView: CalendarMode;
  selectedId?: string;
  date: string;
  selectedDate: string;
  resourceId: string;
  service: ServiceGroup | "";
  slotIntervalMinutes: number;
  rescheduleAction: (formData: FormData) => Promise<void>;
};

function formatTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeLocalInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function buildAppointmentsUrl(params: {
  calendarView?: CalendarMode;
  date?: string;
  selectedId?: string;
  resourceId?: string;
  service?: string;
  resourceView?: boolean;
}) {
  const searchParams = new URLSearchParams();

  searchParams.set("display", "calendar");

  if (params.calendarView) searchParams.set("calendarView", params.calendarView);
  if (params.date) searchParams.set("date", params.date);
  if (params.selectedId) searchParams.set("selectedId", params.selectedId);
  if (params.resourceId) searchParams.set("resourceId", params.resourceId);
  if (params.service) searchParams.set("service", params.service);
  if (params.resourceView) searchParams.set("resourceView", "true");

  return `/appointments/calendar?${searchParams.toString()}`;
}

function queueStatusBadgeClass(status: QueueStatus) {
  switch (status) {
    case "WAITING_TRIAGE":
      return "bg-sky-50 text-sky-700 ring-sky-700/10";
    case "TRIAGE_IN_PROGRESS":
      return "bg-cyan-50 text-cyan-700 ring-cyan-700/10";
    case "WAITING_VET":
      return "bg-blue-50 text-blue-700 ring-blue-700/10";
    case "IN_SERVICE":
      return "bg-amber-50 text-amber-700 ring-amber-700/10";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-700/10";
    case "NO_SHOW":
      return "bg-zinc-100 text-zinc-700 ring-zinc-700/10";
    case "CANCELLED":
      return "bg-red-50 text-red-700 ring-red-700/10";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-700/10";
  }
}

function formatQueueNumber(queueNumber: number, queueCode?: string | null) {
  return queueCode || `M-${String(queueNumber).padStart(3, "0")}`;
}

function getServiceGroup(appointmentType: string): ServiceGroup {
  if (["GROOMING", "BATH", "HAIRCUT", "NAIL_CUT"].includes(appointmentType)) {
    return "GROOMING";
  }

  if (appointmentType === "SURGERY") {
    return "SURGERY";
  }

  if (appointmentType === "BOARDING") {
    return "BOARDING";
  }

  return "TREATMENT";
}

function serviceCardClass(service: ServiceGroup) {
  switch (service) {
    case "GROOMING":
      return "border-green-200 bg-green-50 text-green-900";
    case "SURGERY":
      return "border-purple-200 bg-purple-50 text-purple-900";
    case "BOARDING":
      return "border-orange-200 bg-orange-50 text-orange-900";
    default:
      return "border-blue-200 bg-blue-50 text-blue-900";
  }
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function canDragAppointment(status: string) {
  return status === "BOOKED" || status === "CONFIRMED";
}

function buildSlots(hours: number[], slotIntervalMinutes: number): SlotItem[] {
  const interval =
    Number.isFinite(slotIntervalMinutes) && slotIntervalMinutes > 0
      ? slotIntervalMinutes
      : 30;

  return hours.flatMap((hour) => {
    const slotCount = Math.max(1, Math.floor(60 / interval));

    return Array.from({ length: slotCount }, (_, index) => {
      const minute = index * interval;

      return {
        key: `${String(hour).padStart(2, "0")}:${String(minute).padStart(
          2,
          "0",
        )}`,
        hour,
        minute,
        label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(
          2,
          "0",
        )}`,
      };
    });
  });
}

export function ResourceCalendarDnd({
  hours,
  resources,
  appointments,
  blockTimes,
  calendarView,
  selectedId,
  date,
  selectedDate,
  resourceId,
  service,
  slotIntervalMinutes,
  rescheduleAction,
}: ResourceCalendarDndProps) {
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(
    null,
  );

  const selectedDay = useMemo(() => new Date(selectedDate), [selectedDate]);
  const slots = useMemo(
    () => buildSlots(hours, slotIntervalMinutes),
    [hours, slotIntervalMinutes],
  );

  const resourcesForDisplay = useMemo(() => {
    const visibleResources = resourceId
      ? resources.filter((resource) => resource.userId === resourceId)
      : resources;

    return visibleResources.length > 0
      ? visibleResources
      : [
          {
            userId: "unassigned",
            fullName: "Unassigned",
            role: "UNASSIGNED",
          },
        ];
  }, [resourceId, resources]);

  function handleDragStart(
    event: DragEvent<HTMLAnchorElement>,
    appointment: DndAppointment,
  ) {
    if (!canDragAppointment(appointment.status)) {
      event.preventDefault();
      return;
    }

    setDraggedAppointmentId(appointment.appointmentId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", appointment.appointmentId);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    target: {
      hour: number;
      minute: number;
      resourceId: string;
      resourceName: string;
    },
  ) {
    event.preventDefault();

    const appointmentId =
      event.dataTransfer.getData("text/plain") || draggedAppointmentId;

    if (!appointmentId) return;

    const appointment = appointments.find(
      (item) => item.appointmentId === appointmentId,
    );

    if (!appointment || !canDragAppointment(appointment.status)) {
      setDraggedAppointmentId(null);
      return;
    }

    const targetDate = new Date(selectedDay);
    targetDate.setHours(target.hour, target.minute, 0, 0);

    setPendingDrop({
      appointmentId: appointment.appointmentId,
      appointmentNo: appointment.appointmentNo,
      petName: appointment.petName,
      oldDateTime: appointment.appointmentDate,
      newDateTime: formatDateTimeLocalInput(targetDate),
      resourceId: target.resourceId === "unassigned" ? "" : target.resourceId,
      resourceName: target.resourceName,
    });

    setDraggedAppointmentId(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        Drag & Drop Reschedule is enabled for BOOKED and CONFIRMED appointments.
        Drop into {slotIntervalMinutes}-minute resource slots, then confirm the
        move before saving.
      </div>

      {pendingDrop ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Confirm Reschedule
              </h3>
              <p className="mt-1 text-sm text-amber-900">
                {pendingDrop.appointmentNo} · {pendingDrop.petName}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                From {formatTime(pendingDrop.oldDateTime)} to{" "}
                {formatTime(new Date(pendingDrop.newDateTime))} · Resource:{" "}
                {pendingDrop.resourceName}
              </p>
            </div>

            <form action={rescheduleAction} className="grid gap-2 sm:min-w-80">
              <input
                type="hidden"
                name="appointmentId"
                value={pendingDrop.appointmentId}
              />
              <input
                type="hidden"
                name="appointmentDate"
                value={pendingDrop.newDateTime}
              />
              <input type="hidden" name="resourceId" value={pendingDrop.resourceId} />
              <input
                type="hidden"
                name="reason"
                value={`Drag & drop reschedule to ${pendingDrop.resourceName}`}
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Confirm Move
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDrop(null)}
                  className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <div className="min-w-[1000px] rounded-xl border border-slate-200">
        <div
          className="grid border-b border-slate-200 bg-slate-50"
          style={{
            gridTemplateColumns: `80px repeat(${resourcesForDisplay.length}, minmax(180px, 1fr))`,
          }}
        >
          <div className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Time
          </div>

          {resourcesForDisplay.map((resource) => (
            <div
              key={resource.userId}
              className="border-l border-slate-200 px-3 py-3 text-center"
            >
              <div className="truncate text-sm font-bold text-slate-900">
                {resource.fullName}
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                {resource.role === "GROOMER"
                  ? "Groomer"
                  : resource.role === "VETERINARIAN"
                    ? "Veterinarian"
                    : "Unassigned"}
              </div>
            </div>
          ))}
        </div>

        <div>
          {slots.map((slot) => (
            <div
              key={slot.key}
              className="grid min-h-[68px] border-b border-slate-100 last:border-b-0"
              style={{
                gridTemplateColumns: `80px repeat(${resourcesForDisplay.length}, minmax(180px, 1fr))`,
              }}
            >
              <div className="px-3 py-2 text-xs font-medium text-slate-400">
                {slot.label}
              </div>

              {resourcesForDisplay.map((resource) => {
                const items = appointments.filter((appointment) => {
                  const appointmentDate = new Date(appointment.appointmentDate);
                  const matchesSlot =
                    isSameDay(appointmentDate, selectedDay) &&
                    appointmentDate.getHours() === slot.hour &&
                    appointmentDate.getMinutes() === slot.minute;

                  if (!matchesSlot) return false;

                  if (resource.userId === "unassigned") {
                    return !appointment.vetId;
                  }

                  return appointment.vetId === resource.userId;
                });

                const blockedItems = blockTimes.filter((blockTime) => {
                  const blockStartDate = new Date(blockTime.startDateTime);
                  const matchesSlot =
                    isSameDay(blockStartDate, selectedDay) &&
                    blockStartDate.getHours() === slot.hour &&
                    blockStartDate.getMinutes() === slot.minute;

                  if (!matchesSlot) return false;

                  if (resource.userId === "unassigned") {
                    return !blockTime.veterinarianId && !blockTime.groomerId;
                  }

                  return (
                    blockTime.veterinarianId === resource.userId ||
                    blockTime.groomerId === resource.userId
                  );
                });

                return (
                  <div
                    key={`${resource.userId}-${slot.key}`}
                    className={`relative border-l border-slate-100 p-2 ${
                      draggedAppointmentId ? "bg-slate-50" : ""
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={(event) =>
                      handleDrop(event, {
                        hour: slot.hour,
                        minute: slot.minute,
                        resourceId: resource.userId,
                        resourceName: resource.fullName,
                      })
                    }
                  >
                    {items.length === 0 && blockedItems.length === 0 ? (
                      <Link
                        href={`/appointments/new?appointmentDate=${date}T${String(
                          slot.hour,
                        ).padStart(2, "0")}:${String(slot.minute).padStart(
                          2,
                          "0",
                        )}`}
                        className="flex h-full min-h-[48px] items-center justify-center rounded-lg border border-dashed border-transparent text-xs text-transparent hover:border-slate-300 hover:text-slate-400"
                      >
                        + Add
                      </Link>
                    ) : (
                      <div className="space-y-2">
                        {blockedItems.map((blockTime) => (
                          <div
                            key={blockTime.blockTimeId}
                            className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-xs text-slate-800 shadow-sm"
                          >
                            <div className="font-bold">Blocked</div>
                            <div className="mt-1 truncate font-semibold">
                              {blockTime.title}
                            </div>
                            <div className="truncate">{blockTime.blockType}</div>
                            <div className="truncate text-[11px] text-slate-500">
                              {formatTime(blockTime.startDateTime)} -{" "}
                              {formatTime(blockTime.endDateTime)}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">
                              {blockTime.veterinarianName ??
                                blockTime.groomerName ??
                                "All clinic"}
                            </div>
                          </div>
                        ))}

                        {items.map((appointment) => {
                          const appointmentService = getServiceGroup(
                            appointment.appointmentType,
                          );
                          const draggable = canDragAppointment(
                            appointment.status,
                          );

                          return (
                            <Link
                              key={appointment.appointmentId}
                              draggable={draggable}
                              onDragStart={(event) =>
                                handleDragStart(event, appointment)
                              }
                              onDragEnd={() => setDraggedAppointmentId(null)}
                              href={buildAppointmentsUrl({
                                calendarView,
                                date,
                                selectedId: appointment.appointmentId,
                                resourceId,
                                service,
                                resourceView: true,
                              })}
                              className={`block rounded-lg border p-2 text-xs shadow-sm transition hover:shadow-md ${serviceCardClass(
                                appointmentService,
                              )} ${
                                selectedId === appointment.appointmentId
                                  ? "ring-2 ring-blue-400"
                                  : ""
                              } ${
                                draggable
                                  ? "cursor-move"
                                  : "cursor-not-allowed opacity-70"
                              }`}
                              title={
                                draggable
                                  ? "Drag to reschedule"
                                  : "Only BOOKED or CONFIRMED appointments can be dragged"
                              }
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold">
                                  {formatTime(appointment.appointmentDate)}
                                </span>
                                {appointment.queue ? (
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${queueStatusBadgeClass(
                                      appointment.queue.queueStatus,
                                    )}`}
                                  >
                                    {formatQueueNumber(appointment.queue.queueNumber, appointment.queue.queueCode)}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 truncate font-semibold">
                                {appointment.petName}
                              </div>
                              <div className="truncate">
                                {appointment.appointmentType}
                              </div>
                              <div className="truncate text-[11px] opacity-80">
                                Owner: {appointment.ownerName}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
