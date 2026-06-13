import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { PetPhotoPreview } from "@/components/pets/PetPhotoPreview";
import { deletePet } from "@/actions/pet.actions";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PetDetailPage({ params }: Props) {
  await requirePermission("pet", "view");

  const { id } = await params;

  const pet = await prisma.pet.findUnique({
    where: {
      petId: id,
    },
    include: {
      owner: true,
      species: true,
      breed: true,
    },
  });

  if (!pet || pet.deletedAt) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/pets"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              ← Back to Pet List
            </Link>

            <div className="mt-4 flex items-center gap-4">
              {pet.petPhotoUrl ? (
                <PetPhotoPreview src={pet.petPhotoUrl} alt={pet.petName} />
              ) : (
                <PetAvatar
                  speciesName={pet.species.speciesName}
                  petName={pet.petName}
                />
              )}

              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {pet.petName}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={pet.status} />
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {pet.species.speciesName}
                  </span>
                  {pet.breed ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {pet.breed.breedName}
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  Pet ID: {pet.petId}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href={`/pets/${pet.petId}/vaccines`}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              ประวัติวัคซีน
            </Link>

            <Link
              href={`/pets/${pet.petId}/medical-history`}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Medical History
            </Link>

            <Link
              href={`/pets/${pet.petId}/edit`}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Edit Pet
            </Link>

            <form action={deletePet.bind(null, pet.petId)}>
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                Delete Pet
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <InfoCard
            title="Profile Information"
            description="Core identity and registration information."
          >
            <InfoRow
              label="Owner"
              value={
                <Link
                  href={`/owners/${pet.owner.ownerId}`}
                  className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {pet.owner.fullName}
                </Link>
              }
            />

            <InfoRow label="Species" value={pet.species.speciesName} />
            <InfoRow label="Breed" value={pet.breed?.breedName ?? "-"} />
            <InfoRow label="Gender" value={<GenderBadge gender={pet.gender} />} />
            <InfoRow label="Neuter Status" value={pet.neuterStatus} />
            <InfoRow label="Status" value={<StatusBadge status={pet.status} />} />
            <InfoRow label="Estimated Age" value={pet.estimatedAge ?? "-"} />
            <InfoRow
              label="Birth Date"
              value={
                pet.birthDate
                  ? pet.birthDate.toLocaleDateString("th-TH", {
                      dateStyle: "medium",
                    })
                  : "-"
              }
            />
          </InfoCard>

          <InfoCard
            title="Physical Information"
            description="Physical attributes used for clinical tracking."
          >
            <InfoRow
              label="Weight"
              value={pet.weight ? `${pet.weight} kg` : "-"}
            />
            <InfoRow
              label="Height"
              value={pet.high ? `${pet.high} cm` : "-"}
            />
            <InfoRow label="Body Size" value={pet.bodySize} />
            <InfoRow label="Blood Type" value={pet.bloodType ?? "-"} />
          </InfoCard>

          <InfoCard
            title="Appearance Information"
            description="Visual characteristics for identification."
          >
            <InfoRow
              label="Primary Coat Color"
              value={pet.coatColorPrimary ?? "-"}
            />
            <InfoRow
              label="Secondary Coat Color"
              value={pet.coatColorSecondary ?? "-"}
            />
            <InfoRow label="Coat Pattern" value={pet.coatPattern ?? "-"} />
            <InfoRow label="Hair Type" value={pet.hairType ?? "-"} />
            <InfoRow label="Marking" value={pet.marking ?? "-"} />
            <InfoRow
              label="Photo URL"
              value={
                pet.petPhotoUrl ? (
                  <span className="break-all text-slate-700">
                    {pet.petPhotoUrl}
                  </span>
                ) : (
                  "-"
                )
              }
            />
          </InfoCard>

          <InfoCard
            title="Identification Information"
            description="Official identification and external reference numbers."
          >
            <InfoRow label="Microchip No" value={pet.microchipNo ?? "-"} />
            <InfoRow
              label="Microchip Verified At"
              value={
                pet.microchipVerifiedAt
                  ? pet.microchipVerifiedAt.toLocaleString("th-TH")
                  : "-"
              }
            />
            <InfoRow label="Pedigree No" value={pet.pedigreeNo ?? "-"} />
            <InfoRow label="Pedigree Name" value={pet.pedigreeName ?? "-"} />
            <InfoRow label="Rabies Tag No" value={pet.rabiesTagNo ?? "-"} />
            <InfoRow label="Insurance No" value={pet.insuranceNo ?? "-"} />
          </InfoCard>

          <InfoCard
            title="Owner Information"
            description="Contact information of the registered owner."
          >
            <InfoRow
              label="Owner Name"
              value={
                <Link
                  href={`/owners/${pet.owner.ownerId}`}
                  className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {pet.owner.fullName}
                </Link>
              }
            />
            <InfoRow label="Phone" value={pet.owner.phoneNo} />
            <InfoRow label="Line ID" value={pet.owner.lineId ?? "-"} />
            <InfoRow label="Email" value={pet.owner.email ?? "-"} />

            <div className="pt-2">
              <Link
                href={`/owners/${pet.owner.ownerId}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View Owner →
              </Link>
            </div>
          </InfoCard>

          <InfoCard
            title="Remark"
            description="Additional notes for clinic staff."
          >
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {pet.remark || "-"}
            </p>
          </InfoCard>

          <InfoCard
            title="Audit Information"
            description="Tracking information for production support."
          >
            <InfoRow
              label="Created At"
              value={pet.createdAt.toLocaleString("th-TH")}
            />
            <InfoRow
              label="Updated At"
              value={pet.updatedAt.toLocaleString("th-TH")}
            />
            <InfoRow label="Created By" value={pet.createdByUserId ?? "-"} />
            <InfoRow label="Updated By" value={pet.updatedByUserId ?? "-"} />
          </InfoCard>

          <InfoCard
            title="Future Clinical Records"
            description="These sections will be connected in later clinical sprints."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <DisabledAction label="Appointments" />
              <DisabledAction label="Visit History" />
              <DisabledAction label="Medical Record" />
            </div>
          </InfoCard>
        </div>
      </div>
    </AppShell>
  );
}

function InfoCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>

      <div className="space-y-3 p-6">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[65%] text-right text-sm font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}

function DisabledAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400"
    >
      {label}
    </button>
  );
}

function PetAvatar({
  speciesName,
  petName,
}: {
  speciesName: string;
  petName: string;
}) {
  const normalizedSpeciesName = speciesName.toLowerCase();

  const emoji = normalizedSpeciesName.includes("dog")
    ? "🐶"
    : normalizedSpeciesName.includes("cat")
      ? "🐱"
      : normalizedSpeciesName.includes("rabbit")
        ? "🐰"
        : normalizedSpeciesName.includes("bird")
          ? "🐦"
          : normalizedSpeciesName.includes("hamster")
            ? "🐹"
            : normalizedSpeciesName.includes("fish")
              ? "🐠"
              : normalizedSpeciesName.includes("turtle")
                ? "🐢"
                : "🐾";

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-4xl">
      <span title={petName}>{emoji}</span>
    </div>
  );
}

function GenderBadge({ gender }: { gender: string }) {
  const label =
    gender === "MALE"
      ? "♂ Male"
      : gender === "FEMALE"
        ? "♀ Female"
        : "Unknown";

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    INACTIVE: "bg-slate-100 text-slate-600",
    LOST: "bg-amber-50 text-amber-700",
    DECEASED: "bg-red-50 text-red-700",
    ADOPTED: "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}