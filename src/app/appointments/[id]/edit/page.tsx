import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { updateAppointment } from "@/actions/appointment.actions";
import { appointmentConfig } from "@/config/appointment.config";
import { AppointmentDateTimeRangePicker } from "@/components/forms/AppointmentDateTimeRangePicker";

const MEDICAL_APPOINTMENT_TYPES = [
  "CHECKUP",
  "VACCINE",
  "SICK",
  "FOLLOW_UP",
  "SURGERY",
  "OTHER",
] as const;

type AppointmentEditPageProps = {
  params: Promise<{ id: string }>;
};

function getDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTimeInputValue(date: Date) {
  return date.toISOString().slice(11, 16);
}

function getDateRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00`);
  const end = new Date(`${dateText}T23:59:59.999`);
  return { start, end };
}

export default async function AppointmentEditPage({ params }: AppointmentEditPageProps) {
  await requirePermission("appointment", "update");
  const { id } = await params;

  const appointment = await prisma.appointment.findFirst({
    where: { appointmentId: id, deletedAt: null },
    select: {
      appointmentId: true,
      appointmentNo: true,
      ownerId: true,
      petId: true,
      vetId: true,
      appointmentType: true,
      appointmentDate: true,
      startAt: true,
      endAt: true,
      durationMinutes: true,
      source: true,
      status: true,
      note: true,
      owner: { select: { fullName: true, phoneNo: true, email: true } },
      pet: {
        select: {
          petName: true,
          gender: true,
          species: { select: { speciesName: true } },
          breed: { select: { breedName: true } },
        },
      },
    },
  });

  if (!appointment) notFound();

  if (appointment.status !== "BOOKED" && appointment.status !== "CONFIRMED") {
    redirect(`/appointments/${appointment.appointmentId}`);
  }

  const appointmentDateValue = getDateInputValue(appointment.startAt);
  const appointmentTimeValue = getTimeInputValue(appointment.startAt);
  const { start: slotStartDate, end: slotEndDate } = getDateRange(appointmentDateValue);

  const [vets, slotAppointments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "VETERINARIAN", activeFlag: true, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { userId: true, fullName: true },
    }),
    prisma.appointment.findMany({
      where: {
        deletedAt: null,
        appointmentId: { not: appointment.appointmentId },
        startAt: { gte: slotStartDate, lte: slotEndDate },
        appointmentType: { in: [...MEDICAL_APPOINTMENT_TYPES] },
      },
      orderBy: { appointmentDate: "asc" },
      select: {
        appointmentDate: true,
        startAt: true,
        owner: { select: { fullName: true } },
        pet: { select: { petName: true } },
      },
    }),
  ]);

  const slotInfo = slotAppointments.reduce<{ time: string; appointments: { ownerName: string; petName: string }[] }[]>((items, slotAppointment) => {
    const time = slotAppointment.startAt.toISOString().slice(11, 16);
    const existingSlot = items.find((item) => item.time === time);
    if (existingSlot) {
      existingSlot.appointments.push({ ownerName: slotAppointment.owner.fullName, petName: slotAppointment.pet.petName });
      return items;
    }
    items.push({ time, appointments: [{ ownerName: slotAppointment.owner.fullName, petName: slotAppointment.pet.petName }] });
    return items;
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href={`/appointments/${appointment.appointmentId}`} className="text-sm font-medium text-blue-600 hover:underline">
            ← Back to Appointment Detail
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Edit Medical Appointment</h1>
          <p className="mt-1 text-sm text-slate-500">{appointment.appointmentNo}</p>
        </div>

        <form action={updateAppointment} className="space-y-6">
          <input type="hidden" name="appointmentId" value={appointment.appointmentId} />
          <input type="hidden" name="ownerId" value={appointment.ownerId} />
          <input type="hidden" name="petId" value={appointment.petId} />
          <input type="hidden" name="source" value={appointment.source} />
          <input type="hidden" name="status" value={appointment.status} />

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Owner & Pet</h2>
              <p className="text-sm text-slate-500">Owner and pet cannot be changed here. Create a new appointment if wrong.</p>
            </div>
            <div className="grid gap-4 p-6 lg:grid-cols-2">
              <InfoCard title="Owner" lines={[appointment.owner.fullName, appointment.owner.phoneNo ?? "-"]} />
              <InfoCard title="Pet" lines={[appointment.pet.petName, `${appointment.pet.species?.speciesName ?? "-"} / ${appointment.pet.breed?.breedName ?? "-"} / ${appointment.pet.gender ?? "-"}`]} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Medical Information</h2>
              <p className="text-sm text-slate-500">Edit medical type, assigned veterinarian, schedule, and note.</p>
            </div>
            <div className="grid gap-5 p-6 lg:grid-cols-2">
              <FormField label="Medical Type" required>
                <select name="appointmentType" required defaultValue={appointment.appointmentType} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {MEDICAL_APPOINTMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </FormField>
              <FormField label="Veterinarian">
                <select name="vetId" defaultValue={appointment.vetId ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Not assigned</option>
                  {vets.map((vet) => <option key={vet.userId} value={vet.userId}>{vet.fullName}</option>)}
                </select>
              </FormField>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Medical Date & Time</h2>
              <p className="text-sm text-slate-500">Edit appointment as a time range. Start and end time are stored explicitly.</p>
            </div>
            <div className="p-6">
              <AppointmentDateTimeRangePicker
                defaultDate={appointmentDateValue}
                defaultStartTime={appointmentTimeValue}
                defaultDurationMinutes={appointment.durationMinutes}
                businessStartTime={appointmentConfig.scheduling.businessHours.start}
                businessEndTime={appointmentConfig.scheduling.businessHours.end}
                intervalMinutes={appointmentConfig.scheduling.slotIntervalMinutes}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Additional Information</h2>
            </div>
            <div className="p-6">
              <FormField label="Note">
                <textarea name="note" rows={4} defaultValue={appointment.note ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Medical appointment note..." />
              </FormField>
            </div>
          </section>

          <div className="flex justify-end gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <Link href={`/appointments/${appointment.appointmentId}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</Link>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save Medical Appointment</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function InfoCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="text-sm font-semibold text-blue-900">{title}</div>
      {lines.map((line) => <div key={line} className="mt-1 text-sm text-blue-900">{line}</div>)}
    </div>
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
