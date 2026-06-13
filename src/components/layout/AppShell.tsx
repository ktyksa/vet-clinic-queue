import type { ReactNode } from "react";
import type { UserRole } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth/require-auth";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { prisma } from "@/lib/prisma";

type AppShellProps = {
  children: ReactNode;
};

export type TodayOperations = {
  appointments: number;
  walkIn: number;
  waitingTriage: number;
  intake: number;
  waitingVet: number;
  inService: number;
  completed: number;
  cancelled: number;
  noShow: number;
  avgWaitMinutes: number | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getTodayOperations(): Promise<TodayOperations> {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [appointmentCount, queueGroups, avgResult] = await Promise.all([
    prisma.appointment.count({
      where: { deletedAt: null, startAt: { gte: today, lt: tomorrow } },
    }),
    prisma.medicalQueue.groupBy({
      by: ["queueStatus", "source"],
      where: { deletedAt: null, queueDate: { gte: today, lt: tomorrow } },
      _count: { queueId: true },
    }),
    prisma.medicalQueue.aggregate({
      where: {
        deletedAt: null,
        queueDate: { gte: today, lt: tomorrow },
        queueStatus: "COMPLETED",
        actualWaitMinutes: { not: null },
      },
      _avg: { actualWaitMinutes: true },
    }),
  ]);

  const count = (status: string) =>
    queueGroups
      .filter((g) => g.queueStatus === status)
      .reduce((s, g) => s + g._count.queueId, 0);

  return {
    appointments: appointmentCount,
    walkIn: queueGroups
      .filter((g) => g.source === "WALK_IN")
      .reduce((s, g) => s + g._count.queueId, 0),
    waitingTriage: count("WAITING_TRIAGE"),
    intake: count("TRIAGE_IN_PROGRESS"),
    waitingVet: count("WAITING_VET"),
    inService: count("IN_SERVICE"),
    completed: count("COMPLETED"),
    cancelled: count("CANCELLED"),
    noShow: count("NO_SHOW"),
    avgWaitMinutes:
      avgResult._avg.actualWaitMinutes !== null
        ? Math.round(avgResult._avg.actualWaitMinutes!)
        : null,
  };
}

export async function AppShell({ children }: AppShellProps) {
  const currentUser = await requireAuth();
  const todayOperations = await getTodayOperations();

  return (
    <div className="min-h-screen bg-[#F7FAFF] text-slate-900">
      <div className="flex min-h-screen">
        <AppSidebar role={currentUser.role as UserRole} todayOperations={todayOperations} />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppTopbar
            fullName={currentUser.name}
            email={currentUser.email}
            role={currentUser.role}
            preferredLanguage={currentUser.preferredLanguage}
          />

          <main className="min-w-0 flex-1 px-5 py-5 pt-16 lg:pt-5 2xl:px-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
