import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import type { VaccineReminderStatus } from "@/generated/prisma/client";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

const ALL_STATUSES: VaccineReminderStatus[] = [
  "UPCOMING",
  "DUE",
  "OVERDUE",
  "COMPLETED",
  "CANCELLED",
];

export default async function VaccineRemindersPage({ searchParams }: Props) {
  await requirePermission("vaccine", "view");

  const { status: rawStatus } = await searchParams;
  const statusFilter = ALL_STATUSES.includes(rawStatus as VaccineReminderStatus)
    ? (rawStatus as VaccineReminderStatus)
    : null;

  const [reminders, stats] = await Promise.all([
    prisma.vaccineReminder.findMany({
      where: statusFilter
        ? { status: statusFilter }
        : { status: { in: ["UPCOMING", "DUE", "OVERDUE"] } },
      include: {
        pet: {
          include: {
            owner: true,
            species: true,
          },
        },
        vaccineRecord: {
          include: { vaccine: true, vet: true },
        },
        appointment: true,
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.vaccineReminder.groupBy({
      by: ["status"],
      _count: { status: true },
      where: { status: { in: ["UPCOMING", "DUE", "OVERDUE"] } },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    stats.map((s) => [s.status, s._count.status]),
  ) as Partial<Record<VaccineReminderStatus, number>>;

  const now = new Date();

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Vaccine Reminder Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            ติดตาม reminder วัคซีนสำหรับสัตว์ทุกตัว
          </p>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="เลยกำหนด"
            count={countByStatus["OVERDUE"] ?? 0}
            colorClass="border-red-200 bg-red-50"
            textClass="text-red-700"
            href="/vaccines/reminders?status=OVERDUE"
          />
          <StatCard
            label="ถึงกำหนด"
            count={countByStatus["DUE"] ?? 0}
            colorClass="border-amber-200 bg-amber-50"
            textClass="text-amber-700"
            href="/vaccines/reminders?status=DUE"
          />
          <StatCard
            label="กำลังจะถึง"
            count={countByStatus["UPCOMING"] ?? 0}
            colorClass="border-blue-200 bg-blue-50"
            textClass="text-blue-700"
            href="/vaccines/reminders?status=UPCOMING"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { value: null, label: "Active (ค่าเริ่มต้น)" },
              { value: "UPCOMING", label: "กำลังจะถึง" },
              { value: "DUE", label: "ถึงกำหนด" },
              { value: "OVERDUE", label: "เลยกำหนด" },
              { value: "COMPLETED", label: "เสร็จสิ้น" },
              { value: "CANCELLED", label: "ยกเลิก" },
            ] as { value: string | null; label: string }[]
          ).map(({ value, label }) => (
            <Link
              key={value ?? "all"}
              href={
                value
                  ? `/vaccines/reminders?status=${value}`
                  : "/vaccines/reminders"
              }
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                statusFilter === value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {reminders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500">ไม่พบ reminder</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      สัตว์
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      เจ้าของ
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      วัคซีน
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      ครบกำหนด
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      สถานะ
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Appointment
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reminders.map((reminder) => {
                    const diffMs =
                      reminder.dueDate.getTime() - now.getTime();
                    const diffDays = Math.round(diffMs / 86_400_000);

                    return (
                      <tr
                        key={reminder.vaccineReminderId}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/pets/${reminder.pet.petId}/vaccines`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {reminder.pet.petName}
                          </Link>
                          <span className="ml-2 text-xs text-slate-400">
                            {reminder.pet.species.speciesName}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <Link
                            href={`/owners/${reminder.pet.owner.ownerId}`}
                            className="text-slate-700 hover:text-blue-600 hover:underline"
                          >
                            {reminder.pet.owner.fullName}
                          </Link>
                          <div className="text-xs text-slate-400">
                            {reminder.pet.owner.phoneNo}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <div>
                            {reminder.vaccineRecord.vaccine.vaccineName}
                          </div>
                          {reminder.vaccineRecord.vaccine.targetDisease && (
                            <div className="text-xs text-slate-400">
                              {reminder.vaccineRecord.vaccine.targetDisease}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">
                            {reminder.dueDate.toLocaleDateString("th-TH", {
                              dateStyle: "medium",
                            })}
                          </div>
                          <DaysDiff days={diffDays} />
                        </td>

                        <td className="px-4 py-3">
                          <ReminderStatusBadge status={reminder.status} />
                        </td>

                        <td className="px-4 py-3">
                          {reminder.appointment ? (
                            <Link
                              href={`/appointments/${reminder.appointment.appointmentId}`}
                              className="text-blue-600 hover:underline"
                            >
                              {reminder.appointment.appointmentNo}
                            </Link>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/pets/${reminder.pet.petId}/vaccines`}
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            ดูประวัติ
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  count,
  colorClass,
  textClass,
  href,
}: {
  label: string;
  count: number;
  colorClass: string;
  textClass: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-6 transition hover:opacity-80 ${colorClass}`}
    >
      <p className={`text-4xl font-bold ${textClass}`}>{count}</p>
      <p className={`mt-1 text-sm font-medium ${textClass}`}>{label}</p>
    </Link>
  );
}

function ReminderStatusBadge({ status }: { status: VaccineReminderStatus }) {
  const styles: Record<VaccineReminderStatus, string> = {
    UPCOMING: "bg-blue-50 text-blue-700",
    DUE: "bg-amber-50 text-amber-700",
    OVERDUE: "bg-red-50 text-red-700",
    COMPLETED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-500",
  };

  const labels: Record<VaccineReminderStatus, string> = {
    UPCOMING: "กำลังจะถึง",
    DUE: "ถึงกำหนด",
    OVERDUE: "เลยกำหนด",
    COMPLETED: "เสร็จสิ้น",
    CANCELLED: "ยกเลิก",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function DaysDiff({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="text-xs font-medium text-red-600">
        เลยกำหนด {Math.abs(days)} วัน
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="text-xs font-medium text-amber-600">วันนี้!</span>
    );
  }
  return (
    <span className="text-xs text-slate-400">อีก {days} วัน</span>
  );
}
