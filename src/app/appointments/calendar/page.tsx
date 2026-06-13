import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { appointmentConfig } from "@/config/appointment.config";
import { AppointmentCalendarWorkspace } from "@/components/appointments/AppointmentCalendarWorkspace";
import type { AppointmentStatus, AppointmentType, Prisma } from "@/generated/prisma/client";

const MEDICAL_APPOINTMENT_TYPES: AppointmentType[] = [
  "CHECKUP",
  "VACCINE",
  "SICK",
  "FOLLOW_UP",
  "SURGERY",
  "OTHER",
];

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "BOOKED",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const VIEW_MODES = ["day", "week", "month", "year"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

type CalendarPageProps = {
  searchParams?: Promise<{
    date?: string;
    vetId?: string;
    appointmentType?: string;
    status?: string;
    view?: string;
  }>;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseSelectedDate(value: string) {
  const parsedDate = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(parsedDate.getTime())) return new Date();
  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate;
}

function getViewMode(value: string): ViewMode {
  return VIEW_MODES.includes(value as ViewMode) ? (value as ViewMode) : "week";
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear() + 1, 0, 1);
}

function serializeDate(value: Date) {
  return value.toISOString();
}

export default async function AppointmentCalendarPage({ searchParams }: CalendarPageProps) {
  await requirePermission("appointment", "view");

  const params = searchParams ? await searchParams : {};
  const selectedDate = parseSelectedDate(String(params.date || ""));
  const view = getViewMode(String(params.view || "week"));
  const vetFilter = String(params.vetId || "").trim();
  const typeFilter = String(params.appointmentType || "").trim();
  const statusFilter = String(params.status || "").trim();

  const yearStart = startOfYear(selectedDate);
  const yearEnd = endOfYear(selectedDate);

  const appointmentWhere: Prisma.AppointmentWhereInput = {
    deletedAt: null,
    appointmentType: { in: MEDICAL_APPOINTMENT_TYPES },
    startAt: { gte: yearStart, lt: yearEnd },
    ...(vetFilter ? { vetId: vetFilter } : {}),
    ...(typeFilter && MEDICAL_APPOINTMENT_TYPES.includes(typeFilter as AppointmentType)
      ? { appointmentType: typeFilter as AppointmentType }
      : {}),
    ...(statusFilter && APPOINTMENT_STATUSES.includes(statusFilter as AppointmentStatus)
      ? { status: statusFilter as AppointmentStatus }
      : {}),
  };

  const [appointments, vets, pets] = await Promise.all([
    prisma.appointment.findMany({
      where: appointmentWhere,
      orderBy: { startAt: "asc" },
      select: {
        appointmentId: true,
        appointmentNo: true,
        appointmentType: true,
        source: true,
        status: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
        note: true,
        owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
        pet: {
          select: {
            petId: true,
            petName: true,
            petPhotoUrl: true,
            species: { select: { speciesName: true } },
            breed: { select: { breedName: true } },
          },
        },
        vet: { select: { userId: true, fullName: true } },
        medicalQueue: {
          select: {
            queueNumber: true,
            queueCode: true,
            queueStatus: true,
            deletedAt: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "VETERINARIAN", activeFlag: true, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { userId: true, fullName: true },
    }),
    prisma.pet.findMany({
      where: { deletedAt: null, owner: { deletedAt: null } },
      orderBy: [{ owner: { fullName: "asc" } }, { petName: "asc" }],
      take: 500,
      select: {
        petId: true,
        petName: true,
        ownerId: true,
        gender: true,
        species: { select: { speciesName: true } },
        breed: { select: { breedName: true } },
        owner: { select: { ownerId: true, fullName: true, phoneNo: true } },
      },
    }),
  ]);

  return (
    <AppShell>
      <AppointmentCalendarWorkspace
        initialDate={toDateInputValue(selectedDate)}
        initialView={view}
        filters={{ vetId: vetFilter, appointmentType: typeFilter, status: statusFilter }}
        appointmentTypes={MEDICAL_APPOINTMENT_TYPES}
        appointmentStatuses={APPOINTMENT_STATUSES}
        businessStartTime={appointmentConfig.scheduling.businessHours.start}
        businessEndTime={appointmentConfig.scheduling.businessHours.end}
        intervalMinutes={appointmentConfig.scheduling.slotIntervalMinutes}
        appointments={appointments.map((appointment) => ({
          appointmentId: appointment.appointmentId,
          appointmentNo: appointment.appointmentNo,
          appointmentType: appointment.appointmentType,
          source: appointment.source,
          status: appointment.status,
          startAt: serializeDate(appointment.startAt),
          endAt: serializeDate(appointment.endAt),
          durationMinutes: appointment.durationMinutes,
          note: appointment.note,
          owner: appointment.owner,
          pet: appointment.pet,
          vet: appointment.vet,
          medicalQueue:
            appointment.medicalQueue && !appointment.medicalQueue.deletedAt
              ? {
                  queueNumber: appointment.medicalQueue.queueNumber,
                  queueCode: appointment.medicalQueue.queueCode,
                  queueStatus: appointment.medicalQueue.queueStatus,
                }
              : null,
        }))}
        vets={vets}
        pets={pets.map((pet) => ({
          petId: pet.petId,
          petName: pet.petName,
          ownerId: pet.ownerId,
          gender: pet.gender,
          speciesName: pet.species?.speciesName ?? null,
          breedName: pet.breed?.breedName ?? null,
          owner: pet.owner,
        }))}
      />
    </AppShell>
  );
}