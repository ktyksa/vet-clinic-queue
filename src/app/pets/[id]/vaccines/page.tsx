import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import type { VaccineReminderStatus, VaccineRecordStatus } from "@/generated/prisma/client";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PetVaccinesPage({ params }: Props) {
  await requirePermission("vaccine", "view");

  const { id } = await params;

  const pet = await prisma.pet.findUnique({
    where: { petId: id },
    include: {
      owner: true,
      species: true,
      vaccineRecords: {
        where: { deletedAt: null },
        include: {
          vaccine: true,
          vet: true,
          reminders: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { injectionDate: "desc" },
      },
    },
  });

  if (!pet || pet.deletedAt) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <Link
            href={`/pets/${pet.petId}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← กลับไปหน้า {pet.petName}
          </Link>

          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            ประวัติวัคซีน — {pet.petName}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {pet.species.speciesName} · เจ้าของ:{" "}
            <Link
              href={`/owners/${pet.owner.ownerId}`}
              className="text-blue-600 hover:underline"
            >
              {pet.owner.fullName}
            </Link>
          </p>
        </div>

        {pet.vaccineRecords.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500">ยังไม่มีประวัติวัคซีน</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pet.vaccineRecords.map((record) => {
              const latestReminder = record.reminders[0] ?? null;
              return (
                <div
                  key={record.vaccineRecordId}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {record.vaccine.vaccineName}
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {record.vaccine.vaccineCode}
                        {record.vaccine.targetDisease
                          ? ` · ${record.vaccine.targetDisease}`
                          : ""}
                        {record.vaccine.brand
                          ? ` · ${record.vaccine.brand}`
                          : ""}
                      </p>
                    </div>

                    <VaccineRecordStatusBadge status={record.status} />
                  </div>

                  <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoItem
                      label="วันที่ฉีด"
                      value={record.injectionDate.toLocaleDateString("th-TH", {
                        dateStyle: "medium",
                      })}
                    />
                    <InfoItem
                      label="ครบกำหนดครั้งต่อไป"
                      value={
                        record.nextDueDate
                          ? record.nextDueDate.toLocaleDateString("th-TH", {
                              dateStyle: "medium",
                            })
                          : "-"
                      }
                    />
                    <InfoItem label="สัตวแพทย์" value={record.vet.fullName} />
                    <InfoItem label="Lot No." value={record.lotNo ?? "-"} />
                    <InfoItem
                      label="ผู้ผลิต"
                      value={record.manufacturer ?? "-"}
                    />
                    <InfoItem
                      label="น้ำหนัก ณ วันฉีด"
                      value={
                        record.weightAtInjection
                          ? `${record.weightAtInjection} kg`
                          : "-"
                      }
                    />
                  </dl>

                  {record.remark && (
                    <p className="mt-3 text-sm text-slate-500">
                      หมายเหตุ: {record.remark}
                    </p>
                  )}

                  {latestReminder && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-4 py-2">
                      <span className="text-sm text-slate-500">
                        Reminder:
                      </span>
                      <ReminderStatusBadge status={latestReminder.status} />
                      {latestReminder.reminderSentAt && (
                        <span className="text-xs text-slate-400">
                          แจ้งล่าสุด{" "}
                          {latestReminder.reminderSentAt.toLocaleDateString(
                            "th-TH",
                            { dateStyle: "short" },
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function VaccineRecordStatusBadge({ status }: { status: VaccineRecordStatus }) {
  const styles: Record<VaccineRecordStatus, string> = {
    GIVEN: "bg-emerald-50 text-emerald-700",
    MISSED: "bg-amber-50 text-amber-700",
    CANCELLED: "bg-slate-100 text-slate-500",
  };

  const labels: Record<VaccineRecordStatus, string> = {
    GIVEN: "ฉีดแล้ว",
    MISSED: "ไม่ได้ฉีด",
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
