"use client";

import type { ReactNode } from "react";

type AppointmentSource = "ADVANCE_BOOKING" | "WALK_IN";

type AppointmentSourcePickerProps = {
  formId: string;
  value: AppointmentSource;
  onChange: (source: AppointmentSource) => void;
};

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="8" cy="8" r="2" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="6" cy="13" r="1.8" />
      <circle cx="18" cy="13" r="1.8" />
      <path d="M8.8 17.3c.9-2.2 5.5-2.2 6.4 0 .6 1.4-.5 2.7-1.9 2.7-.8 0-1.1-.4-1.3-.4s-.5.4-1.3.4c-1.4 0-2.5-1.3-1.9-2.7Z" />
    </svg>
  );
}

function WalkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="13" cy="5" r="2" />
      <path d="M10 22v-5l-2-2" />
      <path d="m15 22-2-6 2-5" />
      <path d="m8 11 3-3 3 2 3 1" />
    </svg>
  );
}

export function AppointmentSourcePicker({ formId, value, onChange }: AppointmentSourcePickerProps) {
  const options: Array<{ value: AppointmentSource; label: string; description: string; icon: ReactNode }> = [
    { value: "ADVANCE_BOOKING", label: "Advance Booking", description: "Create calendar appointment", icon: <PawIcon /> },
    { value: "WALK_IN", label: "Walk-in", description: "Add directly to queue", icon: <WalkIcon /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      <input type="hidden" form={formId} name="source" value={value} />
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              active
                ? "rounded-xl border border-blue-500 bg-blue-50 px-3 py-3 text-left text-sm text-blue-800 ring-4 ring-blue-50 transition"
                : "rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            }
            aria-pressed={active}
          >
            <span className="flex items-center gap-2 font-semibold">
              {option.icon}
              {option.label}
            </span>
            <span className="mt-1 block text-xs font-medium text-slate-500">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
