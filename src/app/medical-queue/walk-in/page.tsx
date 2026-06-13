import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { createWalkInMedicalQueue } from "@/actions/medical-queue.actions";
import { WalkInRegistrationForm } from "@/components/medical-queue/WalkInRegistrationForm";

function formatArrivalNow() {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

export default async function NewWalkInPage() {
  await requirePermission("appointment", "create");

  const vets = await prisma.user.findMany({
    where: { role: "VETERINARIAN", activeFlag: true, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { userId: true, fullName: true },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/medical-queue" className="text-sm font-semibold text-blue-600 hover:underline">← Back to Medical Queue</Link>
            <h1 className="mt-4 text-2xl font-black text-slate-950">New Walk-in Registration</h1>
            <p className="mt-1 text-sm text-slate-500">
              Walk-in native flow: Owner / Pet search, current arrival time, then create medical queue immediately.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <div className="font-bold">Walk-in only</div>
            <div>No Advance Booking fields on this page.</div>
          </div>
        </div>

        <WalkInRegistrationForm
          vets={vets}
          action={createWalkInMedicalQueue}
          arrivalDateTimeLabel={formatArrivalNow()}
        />
      </div>
    </AppShell>
  );
}
