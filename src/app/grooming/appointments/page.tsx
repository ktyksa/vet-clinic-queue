import { getGroomingAppointmentsByDateRange } from "@/actions/grooming-appointment.actions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import {
  GroomingCalendar,
  type GAppt,
  type GroomerItem,
  type PetItem,
  type ServiceItem,
} from "@/components/grooming/GroomingCalendar";

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
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
function pad(v: number) {
  return String(v).padStart(2, "0");
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Props {
  searchParams: Promise<{ date?: string; groomerId?: string }>;
}

export default async function GroomingAppointmentsPage({ searchParams }: Props) {
  await requirePermission("groomer", "view");

  const { date, groomerId } = await searchParams;

  const focusDate = date ? new Date(`${date}T00:00:00`) : new Date();
  const ws = startOfWeek(focusDate);
  const we = addDays(ws, 7);
  const weekStr = toDateStr(ws);

  const [rawAppts, groomers, pets, services] = await Promise.all([
    getGroomingAppointmentsByDateRange(ws, we),

    prisma.user.findMany({
      where: { role: "GROOMER", status: "ACTIVE", deletedAt: null },
      select: { userId: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),

    prisma.pet.findMany({
      where: { deletedAt: null },
      orderBy: { petName: "asc" },
      take: 500,
      select: {
        petId: true,
        petName: true,
        ownerId: true,
        species: { select: { speciesName: true } },
        owner: { select: { fullName: true, phoneNo: true } },
      },
    }),

    prisma.groomingService.findMany({
      where: { isActive: true },
      orderBy: { serviceName: "asc" },
      select: {
        groomingServiceId: true,
        serviceName: true,
        price: true,
        durationMin: true,
      },
    }),
  ]);

  // Serialize dates to strings for client component
  const appointments: GAppt[] = rawAppts.map((a) => ({
    appointmentId: a.appointmentId,
    appointmentNo: a.appointmentNo,
    status: a.status,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    durationMinutes: a.durationMinutes ?? 0,
    note: a.note,
    cancelReason: a.cancelReason ?? null,
    owner: {
      ownerId: a.owner.ownerId,
      fullName: a.owner.fullName,
      phoneNo: a.owner.phoneNo ?? null,
    },
    pet: {
      petId: a.pet.petId,
      petName: a.pet.petName,
      species: a.pet.species ? { speciesName: a.pet.species.speciesName } : null,
    },
    groomer: a.vet ? { userId: a.vet.userId, fullName: a.vet.fullName } : null,
    groomingQueue: a.groomingQueue
      ? {
          groomingQueueId: a.groomingQueue.groomingQueueId,
          queueNumber: a.groomingQueue.queueNumber,
          status: a.groomingQueue.status,
        }
      : null,
    services: a.groomingServices.map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.service.serviceName,
      price: String(s.service.price),
    })),
  }));

  const groomerItems: GroomerItem[] = groomers.map((g) => ({
    userId: g.userId,
    fullName: g.fullName,
  }));

  const petItems: PetItem[] = pets.map((p) => ({
    petId: p.petId,
    petName: p.petName,
    ownerId: p.ownerId,
    speciesName: p.species?.speciesName ?? null,
    ownerFullName: p.owner.fullName,
    ownerPhone: p.owner.phoneNo ?? null,
  }));

  const serviceItems: ServiceItem[] = services.map((s) => ({
    groomingServiceId: s.groomingServiceId,
    serviceName: s.serviceName,
    price: String(s.price),
    durationMin: s.durationMin,
  }));

  return (
    <AppShell>
      <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <GroomingCalendar
          initialWeekStr={weekStr}
          appointments={appointments}
          groomers={groomerItems}
          pets={petItems}
          services={serviceItems}
        />
      </div>
    </AppShell>
  );
}
