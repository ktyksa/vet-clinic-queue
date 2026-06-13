import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";

type MedicalHistoryPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{ returnTo?: string; returnLabel?: string }>;
};

function safeReturnPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function formatValue(value?: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function calculateAge(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  const birthDate = new Date(value);

  if (Number.isNaN(birthDate.getTime())) {
    return "-";
  }

  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();

  if (today.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0) {
    return `${months} เดือน`;
  }

  if (months <= 0) {
    return `${years} ปี`;
  }

  return `${years} ปี ${months} เดือน`;
}

function StatusBadge({ status }: { status?: string | null }) {
  const label = status ?? "UNKNOWN";
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-50 text-green-700 border-green-200",
    COMPLETED: "bg-green-50 text-green-700 border-green-200",
    FINALIZED: "bg-green-50 text-green-700 border-green-200",
    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
    CHECKED_IN: "bg-blue-50 text-blue-700 border-blue-200",
    WAITING_VET: "bg-amber-50 text-amber-700 border-amber-200",
    IN_PROGRESS: "bg-purple-50 text-purple-700 border-purple-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
    NO_SOAP: "bg-slate-50 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
        styles[label] ?? "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  helpText,
}: {
  label: string;
  value: string | number;
  helpText: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{helpText}</p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export default async function PetMedicalHistoryPage({
  params,
  searchParams,
}: MedicalHistoryPageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const returnTo = safeReturnPath(query.returnTo);
  const returnLabel = query.returnLabel ? decodeURIComponent(query.returnLabel) : null;
  const backHref = returnTo ?? `/pets/${id}`;
  const backLabel = returnLabel ? `← Back to ${returnLabel}` : "← Back to Pet Detail";

  await requirePermission("soap", "view");

  const pet = await prisma.pet.findFirst({
    where: {
      petId: id,
      deletedAt: null,
    },
    include: {
      owner: true,
      species: true,
      breed: true,
      visits: {
        where: {
          deletedAt: null,
        },
        include: {
          vet: true,
          appointment: true,
          soapNote: {
            include: {
              vet: true,
              addendums: {
                where: {
                  deletedAt: null,
                },
                orderBy: {
                  addedAt: "desc",
                },
              },
            },
          },
          diagnoses: {
            where: {
              deletedAt: null,
            },
            include: {
              diagnosisCode: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          vaccineRecords: {
            where: {
              deletedAt: null,
            },
            include: {
              vaccine: true,
            },
            orderBy: {
              injectionDate: "desc",
            },
          },
        },
        orderBy: {
          visitDate: "desc",
        },
      },
      vaccineRecords: {
        where: {
          deletedAt: null,
        },
        include: {
          vaccine: true,
          visit: true,
        },
        orderBy: {
          injectionDate: "desc",
        },
      },
    },
  });

  if (!pet) {
    notFound();
  }

  const finalizedSoapCount = pet.visits.filter(
    (visit) =>
      visit.soapNote?.status === "FINALIZED" && !visit.soapNote.deletedAt,
  ).length;
  const diagnosisCount = pet.visits.reduce(
    (total, visit) => total + visit.diagnoses.length,
    0,
  );
  const vaccineCount = pet.vaccineRecords.length;
  const latestVisit = pet.visits[0] ?? null;
  const petAge = pet.birthDate
    ? calculateAge(pet.birthDate)
    : (pet.estimatedAge ?? "-");

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                href={backHref}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {backLabel}
              </Link>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-slate-900">
                  Medical History
                </h1>
                <StatusBadge status={pet.status} />
              </div>

              <p className="mt-2 text-sm text-slate-600">
                ประวัติการรักษาย้อนหลังตลอดอายุสัตว์ รวม Visit, SOAP, Diagnosis,
                Vaccine และ Addendum
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {latestVisit ? (
                <>
                  <Link
                    href={`/visits/${latestVisit.visitId}`}
                    className="rounded-lg border px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Latest Visit
                  </Link>
                  <Link
                    href={`/visits/${latestVisit.visitId}/soap`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Latest SOAP
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                Patient Clinical Snapshot
              </p>
              <h2 className="mt-1 text-2xl font-black text-blue-950">
                {pet.petName}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <p className="text-sm font-semibold text-blue-900">
                  Species: {pet.species.speciesName}
                </p>
                <p className="text-sm font-semibold text-blue-900">
                  Breed: {pet.breed?.breedName ?? "-"}
                </p>
                <p className="text-sm font-semibold text-blue-900">
                  Age: {petAge}
                </p>
                <p className="text-sm font-semibold text-blue-900">
                  Gender: {pet.gender}
                </p>
                <p className="text-sm font-semibold text-blue-900">
                  Owner: {pet.owner.fullName}
                </p>
                <p className="text-sm font-semibold text-blue-900">
                  Phone: {pet.owner.phoneNo}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-white p-4">
              <p className="text-sm font-bold text-blue-950">Clinical Alerts</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 font-semibold text-red-800">
                  Medical Alert: {formatValue(pet.importantMedicalAlert)}
                </p>
                <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 font-semibold text-amber-800">
                  Allergy: {formatValue(pet.allergyNote)}
                </p>
                <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-semibold text-slate-700">
                  Chronic: {formatValue(pet.chronicConditionNote)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Visits"
            value={pet.visits.length}
            helpText="จำนวน visit ทั้งหมด"
          />
          <SummaryCard
            label="Finalized SOAP"
            value={finalizedSoapCount}
            helpText="SOAP ที่ finalize แล้ว"
          />
          <SummaryCard
            label="Diagnosis"
            value={diagnosisCount}
            helpText="Diagnosis ทั้งหมด"
          />
          <SummaryCard
            label="Vaccines"
            value={vaccineCount}
            helpText="ประวัติวัคซีนทั้งหมด"
          />
        </div>

        <SectionCard title="Lifetime Visit Timeline">
          {pet.visits.length === 0 ? (
            <p className="rounded-xl border bg-slate-50 p-4 text-sm font-medium text-slate-600">
              ยังไม่มีประวัติการรักษาของสัตว์ตัวนี้
            </p>
          ) : (
            <div className="space-y-4">
              {pet.visits.map((visit) => {
                const activeSoap =
                  visit.soapNote && !visit.soapNote.deletedAt
                    ? visit.soapNote
                    : null;
                const primaryDiagnosis = visit.diagnoses.find(
                  (diagnosis) => diagnosis.diagnosisType === "PRIMARY",
                );

                return (
                  <article
                    key={visit.visitId}
                    className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/visits/${visit.visitId}`}
                            className="text-lg font-black text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {visit.visitNo}
                          </Link>
                          <StatusBadge status={visit.status} />
                          <StatusBadge
                            status={activeSoap?.status ?? "NO_SOAP"}
                          />
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                            {visit.visitType}
                          </span>
                        </div>

                        <p className="mt-2 text-sm font-semibold text-slate-600">
                          {formatDateTime(visit.visitDate)} · Vet:{" "}
                          {visit.vet?.fullName ?? "-"}
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
                          Chief Complaint: {formatValue(visit.chiefComplaint)}
                        </p>

                        <p className="mt-2 text-sm text-slate-700">
                          Primary Diagnosis:{" "}
                          <span className="font-bold">
                            {primaryDiagnosis?.diagnosisCode?.nameTh ||
                              primaryDiagnosis?.diagnosisCode?.nameEn ||
                              primaryDiagnosis?.diagnosisText ||
                              "-"}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/visits/${visit.visitId}`}
                          className="rounded-lg border px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          View Visit
                        </Link>
                        <Link
                          href={`/visits/${visit.visitId}/soap`}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                        >
                          View SOAP
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Assessment
                        </p>
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-slate-800">
                          {formatValue(activeSoap?.assessment)}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Plan
                        </p>
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-slate-800">
                          {formatValue(activeSoap?.plan)}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Counts
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          Diagnosis: {visit.diagnoses.length}
                        </p>
                        <p className="text-sm font-semibold text-slate-800">
                          Vaccine: {visit.vaccineRecords.length}
                        </p>
                        <p className="text-sm font-semibold text-slate-800">
                          Addendum: {activeSoap?.addendums.length ?? 0}
                        </p>
                      </div>
                    </div>

                    {visit.diagnoses.length > 0 ? (
                      <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-purple-700">
                          Diagnosis List
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {visit.diagnoses.map((diagnosis) => (
                            <span
                              key={diagnosis.visitDiagnosisId}
                              className="rounded-full border border-purple-200 bg-white px-3 py-1 text-xs font-bold text-purple-800"
                            >
                              {diagnosis.diagnosisType}:{" "}
                              {diagnosis.diagnosisCode?.nameTh ||
                                diagnosis.diagnosisCode?.nameEn ||
                                diagnosis.diagnosisText ||
                                "-"}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {visit.vaccineRecords.length > 0 ? (
                      <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                          Vaccine Records
                        </p>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {visit.vaccineRecords.map((record) => (
                            <div
                              key={record.vaccineRecordId}
                              className="rounded-lg border border-green-100 bg-white px-3 py-2 text-sm"
                            >
                              <p className="font-bold text-green-900">
                                {record.vaccine.vaccineName}
                              </p>
                              <p className="text-green-800">
                                Given: {formatDate(record.injectionDate)} ·
                                Next: {formatDate(record.nextDueDate)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>

        {pet.vaccineRecords.length > 0 ? (
          <SectionCard title="Vaccine Summary">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-slate-700">
                  <tr>
                    <th className="border-b px-3 py-2">Vaccine</th>
                    <th className="border-b px-3 py-2">Injection Date</th>
                    <th className="border-b px-3 py-2">Next Due</th>
                    <th className="border-b px-3 py-2">Status</th>
                    <th className="border-b px-3 py-2">Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {pet.vaccineRecords.map((record) => (
                    <tr key={record.vaccineRecordId}>
                      <td className="border-b px-3 py-2 font-bold text-slate-900">
                        {record.vaccine.vaccineName}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700">
                        {formatDate(record.injectionDate)}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700">
                        {formatDate(record.nextDueDate)}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700">
                        {record.status}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700">
                        {record.visit ? (
                          <Link
                            href={`/visits/${record.visitId}`}
                            className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {record.visit.visitNo}
                          </Link>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </AppShell>
  );
}
