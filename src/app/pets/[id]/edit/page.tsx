import Link from "next/link";
import { notFound } from "next/navigation";

import { updatePet } from "@/actions/pet.actions";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

const genders = ["MALE", "FEMALE", "UNKNOWN"];
const neuterStatuses = ["INTACT", "NEUTERED", "SPAYED", "UNKNOWN"];
const bodySizes = ["SMALL", "MEDIUM", "LARGE", "GIANT", "UNKNOWN"];
const petStatuses = ["ACTIVE", "INACTIVE", "LOST", "DECEASED", "ADOPTED"];

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditPetPage({ params }: Props) {
  await requirePermission("pet", "update");

  const { id } = await params;

  const [pet, owners, species, breeds] = await Promise.all([
    prisma.pet.findUnique({
      where: {
        petId: id,
      },
      include: {
        owner: true,
        species: true,
        breed: true,
      },
    }),

    prisma.owner.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        fullName: "asc",
      },
    }),

    prisma.species.findMany({
      where: {
        activeFlag: true,
      },
      orderBy: {
        speciesName: "asc",
      },
    }),

    prisma.breed.findMany({
      where: {
        activeFlag: true,
      },
      include: {
        species: true,
      },
      orderBy: {
        breedName: "asc",
      },
    }),
  ]);

  if (!pet || pet.deletedAt) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href={`/pets/${pet.petId}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Pet Detail
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">Edit Pet</h1>

          <p className="mt-1 text-sm text-slate-500">
            Update pet profile, owner, physical, identification and appearance
            information.
          </p>
        </div>

        <form action={updatePet.bind(null, pet.petId)} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Basic Information"
              description="Main information required to manage this pet."
            />

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <FormSelect
                label="Owner"
                name="ownerId"
                required
                defaultValue={pet.ownerId}
              >
                <option value="">Select Owner</option>
                {owners.map((owner) => (
                  <option key={owner.ownerId} value={owner.ownerId}>
                    {owner.fullName}
                  </option>
                ))}
              </FormSelect>

              <FormInput
                label="Pet Name"
                name="petName"
                required
                defaultValue={pet.petName}
              />

              <FormSelect
                label="Species"
                name="speciesId"
                required
                defaultValue={pet.speciesId}
              >
                <option value="">Select Species</option>
                {species.map((item) => (
                  <option key={item.speciesId} value={item.speciesId}>
                    {item.speciesName}
                  </option>
                ))}
              </FormSelect>

              <FormSelect
                label="Breed"
                name="breedId"
                defaultValue={pet.breedId ?? ""}
              >
                <option value="">Select Breed</option>
                {breeds.map((item) => (
                  <option key={item.breedId} value={item.breedId}>
                    {item.breedName} ({item.species.speciesName})
                  </option>
                ))}
              </FormSelect>

              <FormSelect label="Gender" name="gender" defaultValue={pet.gender}>
                {genders.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FormSelect>

              <FormSelect label="Status" name="status" defaultValue={pet.status}>
                {petStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FormSelect>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Physical Information"
              description="Physical attributes used for clinical tracking."
            />

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <FormSelect
                label="Neuter Status"
                name="neuterStatus"
                defaultValue={pet.neuterStatus}
              >
                {neuterStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FormSelect>

              <FormInput
                label="Birth Date"
                name="birthDate"
                type="date"
                defaultValue={
                  pet.birthDate ? pet.birthDate.toISOString().slice(0, 10) : ""
                }
              />

              <FormInput
                label="Estimated Age"
                name="estimatedAge"
                defaultValue={pet.estimatedAge ?? ""}
                placeholder="e.g. 2 years, 6 months"
              />

              <FormSelect
                label="Body Size"
                name="bodySize"
                defaultValue={pet.bodySize}
              >
                {bodySizes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FormSelect>

              <FormInput
                label="Weight"
                name="weight"
                type="number"
                step="0.01"
                defaultValue={pet.weight ? String(pet.weight) : ""}
                placeholder="kg"
              />

              <FormInput
                label="Height"
                name="high"
                type="number"
                step="0.01"
                defaultValue={pet.high ? String(pet.high) : ""}
                placeholder="cm"
              />

              <FormInput
                label="Blood Type"
                name="bloodType"
                defaultValue={pet.bloodType ?? ""}
                placeholder="Optional"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Identification"
              description="Optional identification numbers and official references."
            />

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <FormInput
                label="Microchip No"
                name="microchipNo"
                defaultValue={pet.microchipNo ?? ""}
                placeholder="Optional"
              />

              <FormInput
                label="Pedigree No"
                name="pedigreeNo"
                defaultValue={pet.pedigreeNo ?? ""}
                placeholder="Optional"
              />

              <FormInput
                label="Pedigree Name"
                name="pedigreeName"
                defaultValue={pet.pedigreeName ?? ""}
                placeholder="Optional"
              />

              <FormInput
                label="Rabies Tag No"
                name="rabiesTagNo"
                defaultValue={pet.rabiesTagNo ?? ""}
                placeholder="Optional"
              />

              <FormInput
                label="Insurance No"
                name="insuranceNo"
                defaultValue={pet.insuranceNo ?? ""}
                placeholder="Optional"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Appearance"
              description="Visual characteristics and pet photo reference."
            />

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <FormFileInput
                label="Replace Pet Photo"
                name="petPhoto"
                accept="image/jpeg,image/png,image/webp"
                description="Optional. Upload a new JPG, PNG, or WEBP file to replace the current photo."
              />

              <FormInput
                label="Pet Photo URL"
                name="petPhotoUrl"
                defaultValue={pet.petPhotoUrl ?? ""}
                placeholder="Optional external image URL"
              />

              <FormInput
                label="Primary Coat Color"
                name="coatColorPrimary"
                defaultValue={pet.coatColorPrimary ?? ""}
                placeholder="Optional"
              />

              <FormInput
                label="Secondary Coat Color"
                name="coatColorSecondary"
                defaultValue={pet.coatColorSecondary ?? ""}
                placeholder="Optional"
              />

              <FormInput
                label="Coat Pattern"
                name="coatPattern"
                defaultValue={pet.coatPattern ?? ""}
                placeholder="Optional"
              />

              <FormInput
                label="Hair Type"
                name="hairType"
                defaultValue={pet.hairType ?? ""}
                placeholder="Optional"
              />

              <FormInput
                label="Marking"
                name="marking"
                defaultValue={pet.marking ?? ""}
                placeholder="Optional"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Remark"
              description="Additional notes for clinic staff."
            />

            <div className="p-6">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Remark
              </label>

              <textarea
                name="remark"
                rows={4}
                defaultValue={pet.remark ?? ""}
                placeholder="Optional note"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Link
              href={`/pets/${pet.petId}`}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-200 px-6 py-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function FormInput({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  step,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>

      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        step={step}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function FormFileInput({
  label,
  name,
  accept,
  description,
}: {
  label: string;
  name: string;
  accept: string;
  description?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        type="file"
        name={name}
        accept={accept}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      {description ? (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}

function FormSelect({
  label,
  name,
  required = false,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>

      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {children}
      </select>
    </div>
  );
}