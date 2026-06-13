import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteOwner } from "@/actions/owner.actions";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";
import { PetPhotoPreview } from "@/components/pets/PetPhotoPreview";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OwnerDetailPage({ params }: Props) {
  await requirePermission("owner", "view");

  const { id } = await params;

  const owner = await prisma.owner.findUnique({
    where: {
      ownerId: id,
    },
    include: {
      pets: {
        where: {
          deletedAt: null,
        },
        include: {
          species: true,
          breed: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!owner || owner.deletedAt) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/owners"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              ← Back to Owner List
            </Link>

            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              {owner.fullName}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Owner profile, contact information and registered pets.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href={`/owners/${owner.ownerId}/edit`}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Edit Owner
            </Link>

            <Link
              href="/pets/new"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              + Add Pet
            </Link>

            <form action={deleteOwner.bind(null, owner.ownerId)}>
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                Delete Owner
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold">Contact Information</h2>
            </div>

            <div className="space-y-4 p-6">
              <InfoRow label="Full Name" value={owner.fullName} />
              <InfoRow label="Phone" value={owner.phoneNo} />
              <InfoRow label="Line ID" value={owner.lineId ?? "-"} />
              <InfoRow label="Email" value={owner.email ?? "-"} />
              <InfoRow
                label="Other Social"
                value={owner.othersSocialMedia ?? "-"}
              />
              <InfoRow label="Remark" value={owner.remark ?? "-"} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold">Address Information</h2>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <InfoRow label="House No" value={owner.houseNo ?? "-"} />
              <InfoRow label="Village Name" value={owner.villageName ?? "-"} />
              <InfoRow label="Building Name" value={owner.buildingName ?? "-"} />
              <InfoRow label="Soi" value={owner.soi ?? "-"} />
              <InfoRow label="Road" value={owner.road ?? "-"} />
              <InfoRow label="Sub District" value={owner.subDistrict ?? "-"} />
              <InfoRow label="District" value={owner.district ?? "-"} />
              <InfoRow label="Province" value={owner.province ?? "-"} />
              <InfoRow label="Postal Code" value={owner.postalCode ?? "-"} />
              <InfoRow label="Country" value={owner.country ?? "-"} />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold">Registered Pets</h2>

            <p className="text-sm text-slate-500">
              Total {owner.pets.length} pet(s)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-6 py-4">Pet</th>
                  <th className="px-6 py-4">Species</th>
                  <th className="px-6 py-4">Breed</th>
                  <th className="px-6 py-4">Gender</th>
                  <th className="px-6 py-4">Age</th>
                  <th className="px-6 py-4">Weight</th>
                  <th className="px-6 py-4">Height</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {owner.pets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No pets found.
                    </td>
                  </tr>
                ) : (
                  owner.pets.map((pet) => (
                    <tr key={pet.petId} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {pet.petPhotoUrl ? (
                            <PetPhotoPreview
                              src={pet.petPhotoUrl}
                              alt={pet.petName}
                            />
                          ) : (
                            <PetAvatar
                              speciesName={pet.species.speciesName}
                            />
                          )}

                          <div>
                            <Link
                              href={`/pets/${pet.petId}`}
                              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              {pet.petName}
                            </Link>
                            <p className="text-xs text-slate-500">
                              ID: {pet.petId.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {pet.species.speciesName}
                      </td>

                      <td className="px-6 py-4">
                        {pet.breed?.breedName ?? "-"}
                      </td>

                      <td className="px-6 py-4">
                        <GenderBadge gender={pet.gender} />
                      </td>

                      <td className="px-6 py-4">
                        {pet.estimatedAge || "-"}
                      </td>

                      <td className="px-6 py-4">
                        {pet.weight ? `${pet.weight} kg` : "-"}
                      </td>

                      <td className="px-6 py-4">
                        {pet.high ? `${pet.high} cm` : "-"}
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={pet.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/pets/${pet.petId}`}
                          title="Open pet actions"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          ⋮
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function PetAvatar({ speciesName }: { speciesName: string }) {
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
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
      {emoji}
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