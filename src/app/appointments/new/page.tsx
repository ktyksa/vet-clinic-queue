import type { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { createAppointment } from "@/actions/appointment.actions";
import { AppointmentDateTimeRangePicker } from "@/components/forms/AppointmentDateTimeRangePicker";

const MEDICAL_APPOINTMENT_TYPES = [
  "CHECKUP",
  "VACCINE",
  "SICK",
  "FOLLOW_UP",
  "SURGERY",
  "OTHER",
] as const;

type NewAppointmentPageProps = {
  searchParams?: Promise<{
    startAt?: string;
    endAt?: string;
    source?: string;
  }>;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateValue(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toTimeValue(value: Date) {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function normalizeDateTimeParam(value: string | undefined) {
  if (!value) return null;
  const decoded = decodeURIComponent(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(decoded)) return null;
  return decoded.slice(0, 16);
}

function getInitialRange(startAtParam?: string, endAtParam?: string) {
  const normalizedStart = normalizeDateTimeParam(startAtParam);
  const normalizedEnd = normalizeDateTimeParam(endAtParam);

  if (normalizedStart) {
    const startDate = normalizedStart.slice(0, 10);
    const startTime = normalizedStart.slice(11, 16);
    const endTime = normalizedEnd?.slice(11, 16);

    let durationMinutes = 30;
    if (normalizedEnd) {
      const diff = new Date(normalizedEnd).getTime() - new Date(normalizedStart).getTime();
      if (Number.isFinite(diff) && diff > 0) durationMinutes = Math.round(diff / 60_000);
    }

    return { date: startDate, startTime, endTime, durationMinutes };
  }

  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
  if (now.getHours() < 9) now.setHours(9, 0, 0, 0);
  if (now.getHours() >= 22) {
    now.setDate(now.getDate() + 1);
    now.setHours(9, 0, 0, 0);
  }

  return {
    date: toDateValue(now),
    startTime: toTimeValue(now),
    endTime: undefined,
    durationMinutes: 30,
  };
}

function selectedPetText(pet: {
  petName: string;
  species?: { speciesName: string } | null;
  breed?: { breedName: string } | null;
  owner: { fullName: string; phoneNo: string | null };
}) {
  const petInfo = [pet.species?.speciesName, pet.breed?.breedName].filter(Boolean).join(" / ");
  const ownerInfo = pet.owner.phoneNo ? `${pet.owner.fullName} • ${pet.owner.phoneNo}` : pet.owner.fullName;
  return `${pet.petName}${petInfo ? ` (${petInfo})` : ""} — ${ownerInfo}`;
}

export default async function NewAppointmentPage({ searchParams }: NewAppointmentPageProps) {
  await requirePermission("appointment", "create");

  const params = searchParams ? await searchParams : {};
  const source = params.source === "WALK_IN" ? "WALK_IN" : "ADVANCE_BOOKING";
  const initialRange = getInitialRange(params.startAt, params.endAt);
  const slotStart = new Date(`${initialRange.date}T00:00:00`);
  const slotEnd = new Date(`${initialRange.date}T23:59:59.999`);

  const [pets, vets, slotAppointments] = await Promise.all([
    prisma.pet.findMany({
      where: { deletedAt: null },
      orderBy: { petName: "asc" },
      select: {
        petId: true,
        petName: true,
        gender: true,
        owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
        species: { select: { speciesName: true } },
        breed: { select: { breedName: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "VETERINARIAN", activeFlag: true, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { userId: true, fullName: true },
    }),
    prisma.appointment.findMany({
      where: {
        deletedAt: null,
        startAt: { gte: slotStart, lte: slotEnd },
        appointmentType: { in: [...MEDICAL_APPOINTMENT_TYPES] },
      },
      orderBy: { startAt: "asc" },
      select: { startAt: true, endAt: true },
    }),
  ]);

  async function createMedicalAppointment(formData: FormData) {
    "use server";

    const petId = String(formData.get("petId") ?? "");
    const pet = await prisma.pet.findFirst({
      where: { petId, deletedAt: null },
      select: { ownerId: true },
    });

    if (pet) formData.set("ownerId", pet.ownerId);
    await createAppointment(formData);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href={`/appointments/calendar?date=${initialRange.date}&view=week`} className="text-sm font-medium text-blue-600 hover:underline">
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Create Medical Appointment</h1>
          <p className="mt-1 text-sm text-slate-500">Create an advance booking or walk-in appointment from the calendar slot.</p>
        </div>

        <form action={createMedicalAppointment} className="space-y-6">
          <input type="hidden" name="ownerId" value="" />
          <input type="hidden" name="status" value="BOOKED" />

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Owner & Pet</h2>
              <p className="text-sm text-slate-500">Select the pet. The owner will be resolved automatically.</p>
            </div>
            <div className="p-6">
              <FormField label="Owner / Pet" required>
                <select name="petId" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select owner / pet</option>
                  {pets.map((pet) => (
                    <option key={pet.petId} value={pet.petId}>{selectedPetText(pet)}</option>
                  ))}
                </select>
              </FormField>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Appointment Information</h2>
              <p className="text-sm text-slate-500">Source controls the business flow. Advance booking requires veterinarian assignment.</p>
            </div>
            <div className="grid gap-5 p-6 lg:grid-cols-2">
              <FormField label="Appointment Source" required>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <input type="radio" name="source" value="ADVANCE_BOOKING" defaultChecked={source === "ADVANCE_BOOKING"} />
                    Advance Booking
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <input type="radio" name="source" value="WALK_IN" defaultChecked={source === "WALK_IN"} />
                    Walk-in
                  </label>
                </div>
              </FormField>

              <FormField label="Medical Type" required>
                <select name="appointmentType" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select type</option>
                  {MEDICAL_APPOINTMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </FormField>

              <FormField label="Veterinarian" required>
                <select name="vetId" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select veterinarian</option>
                  {vets.map((vet) => <option key={vet.userId} value={vet.userId}>{vet.fullName}</option>)}
                </select>
              </FormField>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Date & Time</h2>
              <p className="text-sm text-slate-500">Default slot is populated from the calendar double click.</p>
            </div>
            <div className="p-6">
              <AppointmentDateTimeRangePicker
                defaultDate={initialRange.date}
                defaultStartTime={initialRange.startTime}
                defaultEndTime={initialRange.endTime}
                defaultDurationMinutes={initialRange.durationMinutes}
                businessStartTime="09:00"
                businessEndTime="22:00"
                intervalMinutes={30}
                bookedSlots={slotAppointments.map((item) => ({ startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString() }))}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Additional Information</h2>
            </div>
            <div className="p-6">
              <FormField label="Reason / Chief Complaint">
                <textarea name="note" rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Medical appointment note..." />
              </FormField>
            </div>
          </section>

          <div className="flex justify-end gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <Link href={`/appointments/calendar?date=${initialRange.date}&view=week`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</Link>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Create Medical Appointment</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}{required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
