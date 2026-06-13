"use client";

import { useMemo, useState } from "react";

export type SlotAppointmentInfo = {
  ownerName: string;
  petName: string;
};

export type SlotInfo = {
  time: string;
  appointments: SlotAppointmentInfo[];
};

type ServiceDateTimeSlotPickerProps = {
  name?: string;
  label?: string;
  defaultDate?: string;
  defaultTime?: string;
  startTime?: string;
  endTime?: string;
  intervalMinutes?: number;
  slotInfo?: SlotInfo[];
};

function toDateInputValue(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10);

  if (value.includes("T")) {
    return value.slice(0, 10);
  }

  return value;
}

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function timeToMinutes(value: string) {
  const [hourText, minuteText] = value.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

function minutesToTime(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;

  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

function generateTimeSlots(startTime: string, endTime: string, intervalMinutes: number) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const slots: string[] = [];

  for (let current = start; current <= end; current += intervalMinutes) {
    slots.push(minutesToTime(current));
  }

  return slots;
}

function getTimeGroupLabel(time: string) {
  const minutes = timeToMinutes(time);

  if (minutes < 12 * 60) return "Morning";
  if (minutes < 17 * 60) return "Afternoon";
  return "Evening";
}

export function ServiceDateTimeSlotPicker({
  name = "appointmentDate",
  label = "Appointment Date & Time",
  defaultDate,
  defaultTime,
  startTime = "09:00",
  endTime = "20:00",
  intervalMinutes = 30,
  slotInfo = [],
}: ServiceDateTimeSlotPickerProps) {
  const initialDate = toDateInputValue(defaultDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState(defaultTime || startTime);

  const slots = useMemo(
    () => generateTimeSlots(startTime, endTime, intervalMinutes),
    [startTime, endTime, intervalMinutes],
  );

  const slotInfoMap = useMemo(() => {
    return new Map(slotInfo.map((slot) => [slot.time, slot]));
  }, [slotInfo]);

  const groupedSlots = useMemo(() => {
    return slots.reduce<Record<string, string[]>>((groups, time) => {
      const group = getTimeGroupLabel(time);
      groups[group] = groups[group] || [];
      groups[group].push(time);
      return groups;
    }, {});
  }, [slots]);

  const selectedAppointmentDate = `${selectedDate}T${selectedTime}`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">{label}</h2>
        <p className="text-sm text-slate-500">
          Select date and time slot. Slots with existing bookings are still selectable.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <input type="hidden" name={name} value={selectedAppointmentDate} />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Available Time Slots
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Existing bookings are shown as counts. Hover to view owner and pet names.
            </div>
          </div>

          {Object.entries(groupedSlots).map(([groupName, groupSlots]) => (
            <div key={groupName} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {groupName}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {groupSlots.map((time) => {
                  const info = slotInfoMap.get(time);
                  const count = info?.appointments.length ?? 0;
                  const isSelected = selectedTime === time;
                  const previewAppointments = info?.appointments.slice(0, 5) ?? [];
                  const remainingCount =
                    count > previewAppointments.length
                      ? count - previewAppointments.length
                      : 0;

                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={[
                        "group relative rounded-lg border px-3 py-2 text-left text-sm transition",
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : count > 0
                            ? "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50",
                      ].join(" ")}
                    >
                      <div className="font-semibold">{time}</div>
                      <div
                        className={[
                          "text-xs",
                          isSelected
                            ? "text-blue-100"
                            : count > 0
                              ? "text-amber-700"
                              : "text-slate-400",
                        ].join(" ")}
                      >
                        {count > 0 ? `${count} appt${count > 1 ? "s" : ""}` : "Available"}
                      </div>

                      {count > 0 ? (
                        <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-lg group-hover:block">
                          <div className="mb-2 font-semibold text-slate-900">
                            Existing appointments
                          </div>

                          <div className="space-y-1.5">
                            {previewAppointments.map((appointment, index) => (
                              <div key={`${appointment.ownerName}-${appointment.petName}-${index}`}>
                                <span className="font-medium">Owner:</span>{" "}
                                {appointment.ownerName}
                                <br />
                                <span className="font-medium">Pet:</span>{" "}
                                {appointment.petName}
                              </div>
                            ))}
                          </div>

                          {remainingCount > 0 ? (
                            <div className="mt-2 font-medium text-slate-500">
                              + {remainingCount} more
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span className="font-semibold">Selected Schedule:</span>{" "}
          {selectedDate} {selectedTime}
        </div>
      </div>
    </section>
  );
}
