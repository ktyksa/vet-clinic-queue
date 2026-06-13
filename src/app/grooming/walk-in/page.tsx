import { AppShell } from "@/components/layout/AppShell";
import { GroomingWalkInForm } from "@/components/grooming/GroomingWalkInForm";
import { getActiveGroomingServices } from "@/actions/grooming-service.actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

async function getGroomers() {
  return prisma.user.findMany({
    where: { role: "GROOMER", status: "ACTIVE", deletedAt: null },
    select: { userId: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export default async function GroomingWalkInPage() {
  const [services, groomers] = await Promise.all([getActiveGroomingServices(), getGroomers()]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Link href="/grooming" className="text-sm text-indigo-600 hover:underline">
            ← กลับ Grooming Queue
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Walk-in Grooming</h1>
          <p className="mt-1 text-sm text-gray-500">ลงทะเบียนสัตว์เลี้ยงที่มาใช้บริการอาบน้ำตัดขนแบบ Walk-in</p>
        </div>

        {services.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm text-amber-700">ยังไม่มีบริการในระบบ</p>
            <Link
              href="/setup/grooming-services"
              className="mt-2 inline-block text-sm font-medium text-amber-800 underline"
            >
              ไปตั้งค่าบริการ
            </Link>
          </div>
        ) : (
          <GroomingWalkInForm services={services} groomers={groomers} />
        )}
      </div>
    </AppShell>
  );
}
