"use client";

import { useMemo, useState } from "react";

type AppointmentDateTimeRangePickerProps = {
  defaultDate?: string;
  defaultStartTime?: string;
  defaultDurationMinutes?: number;
  defaultEndTime?: string;
  businessStartTime?: string;
  businessEndTime?: string;
  intervalMinutes?: number;
  bookedSlots?: Array<{ startAt: string; endAt: string }>;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalDateValue(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toDateInputValue(value?: string) {
  if (!value) return toLocalDateValue(new Date());
  return value.includes("T") ? value.slice(0, 10) : value;
}

function timeToMinutes(value: string) {
  const [hourText, minuteText] = value.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

function minutesToTime(value: number) {
  const normalized = Math.max(0, Math.min(value, 24 * 60));
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  if (hour === 24) return "24:00";
  return `${pad(hour)}:${pad(minute)}`;
}

function generateTimeOptions(startTime: string, endTime: string, intervalMinutes: number) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const options: string[] = [];

  for (let current = start; current <= end; current += intervalMinutes) {
    options.push(minutesToTime(current));
  }

  return Array.from(new Set(options));
}

function buildDateTime(date: string, time: string) {
  if (time === "24:00") {
    const value = new Date(`${date}T00:00`);
    value.setDate(value.getDate() + 1);
    return `${toLocalDateValue(value)}T00:00`;
  }
  return `${date}T${time}`;
}

function getDurationMinutes(startDate: string, startTime: string, endTime: string) {
  const start = new Date(buildDateTime(startDate, startTime));
  const end = new Date(buildDateTime(startDate, endTime));
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

function addMinutes(date: string, time: string, minutes: number) {
  const value = new Date(buildDateTime(date, time));
  value.setMinutes(value.getMinutes() + minutes);
  return {
    date: toLocalDateValue(value),
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}

function getDefaultStartTime(businessStartTime: string, businessEndTime: string, intervalMinutes: number) {
  const now = new Date();
  const rounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / intervalMinutes) * intervalMinutes;
  const businessStart = timeToMinutes(businessStartTime);
  const businessEnd = timeToMinutes(businessEndTime);
  const latestStart = Math.max(businessStart, businessEnd - intervalMinutes);
  return minutesToTime(Math.min(Math.max(rounded, businessStart), latestStart));
}

function isSlotBooked(date: string, time: string, bookedSlots: Array<{ startAt: string; endAt: string }>) {
  const slotStart = new Date(buildDateTime(date, time));
  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + 30);
  return bookedSlots.some((slot) => {
    const bookedStart = new Date(slot.startAt);
    const bookedEnd = new Date(slot.endAt);
    return slotStart < bookedEnd && slotEnd > bookedStart;
  });
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return "End time must be after start time";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours > 0 && remaining > 0) return `${hours}h ${remaining}m`;
  if (hours > 0) return `${hours}h`;
  return `${remaining}m`;
}

export function AppointmentDateTimeRangePicker({
  defaultDate,
  defaultStartTime,
  defaultDurationMinutes = 30,
  defaultEndTime,
  businessStartTime = "08:00",
  businessEndTime = "24:00",
  intervalMinutes = 30,
  bookedSlots = [],
}: AppointmentDateTimeRangePickerProps) {
  const initialDate = toDateInputValue(defaultDate);
  const initialStartTime = defaultStartTime ?? getDefaultStartTime(businessStartTime, businessEndTime, intervalMinutes);
  const initialEnd = addMinutes(initialDate, initialStartTime, defaultDurationMinutes);

  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(() => {
    const candidate = defaultEndTime ?? initialEnd.time;
    return getDurationMinutes(initialDate, initialStartTime, candidate) > 0 ? candidate : initialEnd.time;
  });
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  const timeOptions = useMemo(
    () => generateTimeOptions(businessStartTime, businessEndTime, intervalMinutes),
    [businessStartTime, businessEndTime, intervalMinutes],
  );

  const availabilitySlots = useMemo(
    () => generateTimeOptions(businessStartTime, businessEndTime, intervalMinutes),
    [businessStartTime, businessEndTime, intervalMinutes],
  );

  const durationMinutes = getDurationMinutes(startDate, startTime, endTime);
  const durationLabel = formatDuration(durationMinutes);

  function updateStartDate(nextDate: string) {
    setStartDate(nextDate);
  }

  function updateStartTime(nextTime: string) {
    const currentDuration = durationMinutes > 0 ? durationMinutes : defaultDurationMinutes;
    const nextEnd = addMinutes(startDate, nextTime, currentDuration);
    setStartTime(nextTime);
    setEndTime(nextEnd.time);
  }

  function selectAvailabilitySlot(nextTime: string) {
    const currentDuration = durationMinutes > 0 ? durationMinutes : defaultDurationMinutes;
    const nextEnd = addMinutes(startDate, nextTime, currentDuration);
    setStartTime(nextTime);
    setEndTime(nextEnd.time);
  }

  const startAt = buildDateTime(startDate, startTime);
  const endAt = buildDateTime(startDate, endTime);
  const safeDurationMinutes = Math.max(0, durationMinutes);

  return (
    <div className="space-y-3">
      <input type="hidden" name="appointmentDate" value={startAt} />
      <input type="hidden" name="startAt" value={startAt} />
      <input type="hidden" name="endAt" value={endAt} />
      <input type="hidden" name="durationMinutes" value={safeDurationMinutes} />

      <div className="grid grid-cols-[1fr_120px] gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Start Date <span className="text-red-500">*</span>
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => updateStartDate(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Start Time <span className="text-red-500">*</span>
          </span>
          <select
            value={startTime}
            onChange={(event) => updateStartTime(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {timeOptions.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">
          End Time <span className="text-red-500">*</span>
        </span>
        <select
          value={endTime}
          onChange={(event) => setEndTime(event.target.value)}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          {timeOptions.map((time) => (
            <option key={time} value={time}>{time}</option>
          ))}
        </select>
      </label>

      <div className={durationMinutes > 0 ? "rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700" : "rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"}>
        Duration: {durationLabel}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setAvailabilityOpen((open) => !open)}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          {availabilityOpen ? "Hide full day availability" : "View full day availability"}
        </button>

        {availabilityOpen ? (
          <div className="mt-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Full day availability</div>
                <div className="text-xs text-slate-500">{startDate}</div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Available</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" /> Selected</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {availabilitySlots.map((time) => {
                const selected = time === startTime;
                const booked = isSlotBooked(startDate, time, bookedSlots);
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={booked && !selected}
                    onClick={() => selectAvailabilitySlot(time)}
                    className={
                      selected
                        ? "rounded-xl border border-blue-600 bg-blue-600 px-2 py-2 text-xs font-semibold text-white"
                        : booked
                          ? "cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-400"
                          : "rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-2 text-xs font-semibold text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100"
                    }
                  >
                    <span className="block">{time}</span>
                    <span className="block text-[10px]">{selected ? "Selected" : booked ? "Booked" : "Available"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
