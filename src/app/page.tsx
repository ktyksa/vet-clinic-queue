import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";

export default async function HomePage() {
  await requirePermission("pet", "view");

  const [totalPets, totalOwners, totalAppointments, totalUsers] =
    await Promise.all([
      prisma.pet.count({
        where: {
          deletedAt: null,
        },
      }),
      prisma.owner.count({
        where: {
          deletedAt: null,
        },
      }),
      prisma.appointment.count({
        where: {
          deletedAt: null,
        },
      }),
      prisma.user.count(),
    ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            ภาพรวมระบบบริหารจัดการคลินิกสัตว์
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Pets"
            value={totalPets}
            href="/pets"
            description="จำนวนสัตว์เลี้ยงทั้งหมด"
          />

          <DashboardCard
            title="Owners"
            value={totalOwners}
            href="/owners"
            description="จำนวนเจ้าของสัตว์เลี้ยง"
          />

          <DashboardCard
            title="Appointments"
            value={totalAppointments}
            href="/appointments"
            description="จำนวนรายการนัดหมาย"
          />

          <DashboardCard
            title="Users"
            value={totalUsers}
            href="/administration/users"
            description="จำนวนผู้ใช้งานระบบ"
          />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Next Sprint
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Sprint ถัดไปคือ User Module Completion: Edit User, Reset Password,
            Change Role, Change Status และ AuditLog ทุก action
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function DashboardCard({
  title,
  value,
  description,
  href,
}: {
  title: string;
  value: number;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <p className="text-sm font-medium text-slate-500">{title}</p>

      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>

      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </Link>
  );
}