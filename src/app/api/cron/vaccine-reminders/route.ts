import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called daily at 08:00 Asia/Bangkok by an external cron (Vercel Cron, GitHub Actions, etc.)
// Requires Authorization: Bearer <CRON_SECRET> header.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);

  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  // 1. Mark OVERDUE: dueDate has passed and status is still UPCOMING or DUE
  const { count: overdueCount } = await prisma.vaccineReminder.updateMany({
    where: {
      status: { in: ["UPCOMING", "DUE"] },
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  });

  // 2. Escalate UPCOMING → DUE when within 7 days; record reminderSentAt for DUE notification
  const dueTargets = await prisma.vaccineReminder.findMany({
    where: {
      status: "UPCOMING",
      dueDate: { gte: now, lte: in7Days },
    },
    select: { vaccineReminderId: true },
  });

  if (dueTargets.length > 0) {
    await prisma.vaccineReminder.updateMany({
      where: {
        vaccineReminderId: { in: dueTargets.map((r) => r.vaccineReminderId) },
      },
      data: { status: "DUE", reminderSentAt: now },
    });

    await prisma.jobQueue.createMany({
      data: dueTargets.map((r) => ({
        jobType: "VACCINE_REMINDER_DUE",
        payload: { vaccineReminderId: r.vaccineReminderId },
        status: "PENDING" as const,
        availableAt: now,
      })),
    });
  }

  // 3. First notification for UPCOMING reminders within 14 days that haven't been notified yet
  const upcomingTargets = await prisma.vaccineReminder.findMany({
    where: {
      status: "UPCOMING",
      dueDate: { gte: now, lte: in14Days },
      reminderSentAt: null,
    },
    select: { vaccineReminderId: true },
  });

  if (upcomingTargets.length > 0) {
    await prisma.vaccineReminder.updateMany({
      where: {
        vaccineReminderId: { in: upcomingTargets.map((r) => r.vaccineReminderId) },
      },
      data: { reminderSentAt: now },
    });

    await prisma.jobQueue.createMany({
      data: upcomingTargets.map((r) => ({
        jobType: "VACCINE_REMINDER_UPCOMING",
        payload: { vaccineReminderId: r.vaccineReminderId },
        status: "PENDING" as const,
        availableAt: now,
      })),
    });
  }

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    overdue: overdueCount,
    escalatedToDue: dueTargets.length,
    upcomingNotified: upcomingTargets.length,
  });
}
