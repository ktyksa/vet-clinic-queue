import Link from "next/link";
import { Prisma, type VisitStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { StandardLov } from "@/components/common/StandardLov";
import { StandardPagination } from "@/components/common/StandardPagination";

type VisitsPageProps = {
  searchParams?: Promise<{
    search?: string;
    status?: string;
    date?: string;
    view?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const VISIT_STATUSES: VisitStatus[] = [
  "CHECKED_IN",
  "WAITING_VET",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const VISIT_STATUS_OPTIONS = [
  { value: "", label: "All Status", description: "ทุกสถานะ" },
  { value: "CHECKED_IN", label: "Checked In", description: "ลงทะเบียนแล้ว" },
  { value: "WAITING_VET", label: "Waiting Vet", description: "รอพบสัตวแพทย์" },
  { value: "IN_PROGRESS", label: "In Progress", description: "กำลังตรวจรักษา" },
  { value: "COMPLETED", label: "Completed", description: "เสร็จสิ้น" },
  { value: "CANCELLED", label: "Cancelled", description: "ยกเลิก" },
];

function isValidVisitStatus(value: string): value is VisitStatus {
  return VISIT_STATUSES.includes(value as VisitStatus);
}

function getTodayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    gte: today,
    lt: tomorrow,
  };
}

function getDateRange(dateText: string) {
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);

  return {
    gte: date,
    lt: nextDate,
  };
}

function getViewWhere(view: string): Prisma.VisitWhereInput {
  if (view === "today") {
    return {
      visitDate: getTodayRange(),
    };
  }

  if (view === "active") {
    return {
      status: {
        in: ["CHECKED_IN", "WAITING_VET", "IN_PROGRESS"],
      },
    };
  }

  if (view === "in-progress") {
    return {
      status: "IN_PROGRESS",
    };
  }

  if (view === "soap-draft") {
    return {
      soapNote: {
        status: "DRAFT",
        deletedAt: null,
      },
    };
  }

  if (view === "completed") {
    return {
      status: "COMPLETED",
    };
  }

  if (view === "cancelled") {
    return {
      status: "CANCELLED",
    };
  }

  return {};
}


function queueStatusLabel(status?: string | null) {
  switch (status) {
    case "WAITING_TRIAGE": return "Waiting Triage";
    case "TRIAGE_IN_PROGRESS": return "Intake";
    case "WAITING_VET": return "Waiting Vet";
    case "IN_SERVICE": return "In Service";
    case "COMPLETED": return "Completed";
    case "NO_SHOW": return "No Show";
    case "CANCELLED": return "Cancelled";
    default: return "No Queue";
  }
}

function getWorkflowAction(visit: { visitId: string; status: VisitStatus; soapNote?: { status: string } | null }) {
  const returnTo = encodeURIComponent("/visits");
  const returnLabel = encodeURIComponent("Visit Worklist");

  if (visit.status === "CANCELLED") {
    return {
      label: "View Details",
      href: `/visits/${visit.visitId}?returnTo=${returnTo}&returnLabel=${returnLabel}`,
    };
  }

  if (visit.status === "COMPLETED" || visit.soapNote?.status === "FINALIZED") {
    return {
      label: "View Summary",
      href: `/visits/${visit.visitId}?returnTo=${returnTo}&returnLabel=${returnLabel}#clinical-summary`,
    };
  }

  if (visit.status === "IN_PROGRESS" || visit.soapNote?.status === "DRAFT") {
    return {
      label: "Continue SOAP",
      href: `/visits/${visit.visitId}/soap?returnTo=${returnTo}&returnLabel=${returnLabel}`,
    };
  }

  return {
    label: "Open Intake",
    href: `/visits/${visit.visitId}?focus=intake&returnTo=${returnTo}&returnLabel=${returnLabel}`,
  };
}

function soapBadgeClass(status?: string | null) {
  switch (status) {
    case "FINALIZED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-700/10";
    case "DRAFT":
      return "bg-amber-50 text-amber-700 ring-amber-700/10";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-600/10";
  }
}

function soapStatusLabel(status?: string | null) {
  if (status === "FINALIZED") return "FINALIZED";
  if (status === "DRAFT") return "DRAFT";
  return "NO SOAP";
}

function reasonLabel(
  reasonType?: string | null,
  queueReasonType?: string | null,
  appointmentType?: string | null,
  visitType?: string | null,
) {
  const sourceReason = reasonType ?? queueReasonType ?? appointmentType;

  if (sourceReason) {
    return sourceReason.replaceAll("_", " ");
  }

  switch (visitType) {
    case "CONSULTATION":
      return "CONSULTATION";

    case "VACCINATION":
      return "VACCINE";

    case "FOLLOW_UP":
      return "FOLLOW UP";

    case "SURGERY":
      return "SURGERY";

    default:
      return visitType ?? "-";
  }
}

function sourceBadgeLabel(source?: string | null) {
  if (source === "ADVANCE_BOOKING") return "ADV";
  if (source === "WALK_IN") return "WALK-IN";
  return "WALK-IN";
}

function sourceBadgeClass(source?: string | null) {
  if (source === "ADVANCE_BOOKING") {
    return "bg-blue-50 text-blue-700 ring-blue-700/10";
  }

  return "bg-violet-50 text-violet-700 ring-violet-700/10";
}

function statusBadgeClass(status: VisitStatus) {
  switch (status) {
    case "CHECKED_IN":
      return "bg-blue-50 text-blue-700 ring-blue-700/10";
    case "WAITING_VET":
      return "bg-indigo-50 text-indigo-700 ring-indigo-700/10";
    case "IN_PROGRESS":
      return "bg-amber-50 text-amber-700 ring-amber-700/10";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-700/10";
    case "CANCELLED":
      return "bg-red-50 text-red-700 ring-red-700/10";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-700/10";
  }
}

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  await requirePermission("visit", "view");

  const params = searchParams ? await searchParams : {};
  const search = String(params.search || "").trim();
  const statusRaw = String(params.status || "").trim();
  const date = String(params.date || "").trim();
  const view = String(params.view || "").trim();
  const pageSize = Math.min(100, Math.max(10, Number(params.pageSize || 25) || 25));
  const page = Math.max(1, Number(params.page || 1) || 1);

  const status = statusRaw && isValidVisitStatus(statusRaw) ? statusRaw : "";
  const dateRange = getDateRange(date);
  const viewWhere = getViewWhere(view);

  const filterWhere: Prisma.VisitWhereInput = {
    deletedAt: null,
    ...viewWhere,

    ...(search
      ? {
          OR: [
            { visitNo: { contains: search, mode: "insensitive" } },
            { owner: { fullName: { contains: search, mode: "insensitive" } } },
            { owner: { phoneNo: { contains: search, mode: "insensitive" } } },
            { pet: { petName: { contains: search, mode: "insensitive" } } },
            { vet: { fullName: { contains: search, mode: "insensitive" } } },
            {
              appointment: {
                is: {
                  appointmentNo: { contains: search, mode: "insensitive" },
                },
              },
            },
            {
              medicalQueue: {
                is: {
                  queueCode: { contains: search, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),

    ...(status ? { status } : {}),
    ...(dateRange ? { visitDate: dateRange } : {}),
  };

  const baseWhere: Prisma.VisitWhereInput = {
    deletedAt: null,
  };

  const [visits, totalCount, todayCount, inProgressCount, soapDraftCount, completedCount, cancelledCount] =
    await Promise.all([
      prisma.visit.findMany({
        where: filterWhere,
        select: {
          visitId: true,
          visitNo: true,
          visitDate: true,
          visitType: true,
          reasonType: true,
          status: true,
          appointment: {
            select: {
              appointmentNo: true,
              appointmentType: true,
              source: true,
            },
          },
          medicalQueue: {
            select: {
              queueCode: true,
              queueNumber: true,
              queueStatus: true,
              reasonType: true,
              waitingAt: true,
              owner: {
                select: {
                  fullName: true,
                  phoneNo: true,
                },
              },
              pet: {
                select: {
                  petName: true,
                },
              },
              veterinarian: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          owner: {
            select: {
              fullName: true,
              phoneNo: true,
            },
          },
          pet: {
            select: {
              petName: true,
            },
          },
          vet: {
            select: {
              fullName: true,
            },
          },
          soapNote: {
            select: {
              status: true,
            },
          },
          diagnoses: {
            where: {
              deletedAt: null,
            },
            select: {
              visitDiagnosisId: true,
            },
          },
        },
        orderBy: {
          visitDate: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      prisma.visit.count({ where: filterWhere }),

      prisma.visit.count({
        where: {
          ...baseWhere,
          visitDate: getTodayRange(),
        },
      }),

      prisma.visit.count({
        where: {
          ...baseWhere,
          status: "IN_PROGRESS",
        },
      }),

      prisma.visit.count({
        where: {
          ...baseWhere,
          soapNote: {
            status: "DRAFT",
            deletedAt: null,
          },
        },
      }),

      prisma.visit.count({
        where: {
          ...baseWhere,
          status: "COMPLETED",
        },
      }),

      prisma.visit.count({
        where: {
          ...baseWhere,
          status: "CANCELLED",
        },
      }),
    ]);

  const hasFilter = Boolean(search || status || date || view);
  const paginationParams = { search, status, date, view };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Visit Worklist</h1>
            <p className="mt-1 text-sm text-slate-500">
              Search active visits, queue status, SOAP progress, and clinical workflow records.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Today Visits" value={todayCount} href="/visits?view=today" active={view === "today"} />
          <SummaryCard label="In Progress" value={inProgressCount} href="/visits?view=in-progress" active={view === "in-progress"} />
          <SummaryCard label="SOAP Draft" value={soapDraftCount} href="/visits?view=soap-draft" active={view === "soap-draft"} />
          <SummaryCard label="Completed" value={completedCount} href="/visits?view=completed" active={view === "completed"} />
          <SummaryCard label="Cancelled" value={cancelledCount} href="/visits?view=cancelled" active={view === "cancelled"} />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Visit List
                </h2>
                <p className="text-sm text-slate-500">
                  View active clinical visits and open treatment workflow.
                </p>
              </div>

              <form className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto_auto] lg:items-end">
                <input type="hidden" name="status" value={status} />
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Search visit no, owner, phone, pet, vet, queue no..."
                  className="h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <StandardLov
                  label="Status"
                  value={status}
                  options={VISIT_STATUS_OPTIONS}
                  basePath="/visits"
                  paramName="status"
                  searchParams={{ search, date, view, pageSize }}
                />

                <input
                  type="date"
                  name="date"
                  defaultValue={date}
                  className="h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <button
                  type="submit"
                  className="h-10 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Search
                </button>

                <Link
                  href="/visits"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </Link>
              </form>

              {hasFilter ? (
                <div className="text-xs text-slate-500">
                  Filtered result: {totalCount} visit(s)
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Visit / Queue</th>
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Pet</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Veterinarian</th>
                  <th className="px-4 py-3">Visit Status</th>
                  <th className="px-4 py-3">Queue</th>
                  <th className="px-4 py-3">SOAP</th>
                  <th className="px-4 py-3">Diagnosis</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visits.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center">
                      <div className="mx-auto max-w-md">
                        <div className="text-base font-semibold text-slate-900">
                          {hasFilter ? "No visits match your filter" : "No visits found"}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {hasFilter
                            ? "Try changing search, status, date, or summary card filter."
                            : "Visits are created when an appointment is checked in."}
                        </p>

                        {hasFilter ? (
                          <Link
                            href="/visits"
                            className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Clear Filter
                          </Link>
                        ) : (
                          <Link
                            href="/appointments"
                            className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            Go to Appointments
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  visits.map((visit) => {
                    const owner = visit.medicalQueue?.owner ?? visit.owner;
                    const pet = visit.medicalQueue?.pet ?? visit.pet;
                    const vetName = visit.medicalQueue?.veterinarian?.fullName ?? visit.vet?.fullName ?? "-";
                    const action = getWorkflowAction(visit);

                    return (
                      <tr key={visit.visitId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{visit.visitNo}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{visit.medicalQueue?.queueCode ?? visit.appointment?.appointmentNo ?? "Walk-in"}</span>
                            <span
                              className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sourceBadgeClass(
                                visit.appointment?.source,
                              )}`}
                            >
                              {sourceBadgeLabel(visit.appointment?.source)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {visit.visitDate.toLocaleString("th-TH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {owner.fullName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {owner.phoneNo ?? "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{pet.petName}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {reasonLabel(visit.reasonType, visit.medicalQueue?.reasonType, visit.appointment?.appointmentType, visit.visitType)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{vetName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(
                              visit.status,
                            )}`}
                          >
                            {visit.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-semibold text-slate-900">{queueStatusLabel(visit.medicalQueue?.queueStatus)}</div>
                          <div className="text-xs text-slate-500">{visit.medicalQueue?.queueNumber ? `No. ${visit.medicalQueue.queueNumber}` : "-"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${soapBadgeClass(visit.soapNote?.status)}`}>
                            {soapStatusLabel(visit.soapNote?.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {visit.diagnoses.length}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-3">
                            <Link
                              href={action.href}
                              className="text-sm font-medium text-blue-600 hover:underline"
                            >
                              {action.label}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <StandardPagination
            basePath="/visits"
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            searchParams={paginationParams}
          />
        </section>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  href,
  active,
}: {
  label: string;
  value: number;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border bg-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md ${
        active ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-xs text-blue-600">Click to view</div>
    </Link>
  );
}
