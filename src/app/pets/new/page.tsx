import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createPet } from "@/actions/pet.actions";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";

const genders = ["MALE", "FEMALE", "UNKNOWN"];
const neuterStatuses = ["INTACT", "NEUTERED", "SPAYED", "UNKNOWN"];
const bodySizes = ["SMALL", "MEDIUM", "LARGE", "GIANT", "UNKNOWN"];
const petStatuses = ["ACTIVE", "INACTIVE", "LOST", "DECEASED", "ADOPTED"];

export default async function NewPetPage() {
  await requirePermission("pet", "create");

  const owners = await prisma.owner.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: {
      fullName: "asc",
    },
  });

  const species = await prisma.species.findMany({
    where: {
      activeFlag: true,
    },
    orderBy: {
      speciesName: "asc",
    },
  });

  const breeds = await prisma.breed.findMany({
    where: {
      activeFlag: true,
    },
    include: {
      species: true,
    },
    orderBy: {
      breedName: "asc",
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/pets"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Pet List
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">Add Pet</h1>

          <p className="mt-1 text-sm text-slate-500">
            Create a new pet profile with owner, physical, identification and
            appearance information.
          </p>
        </div>

        <form action={createPet} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Basic Information"
              description="Main information required to register a pet."
            />

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <FormSelect label="Owner" name="ownerId" required>
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
                placeholder="Enter pet name"
              />

              <FormSelect label="Species" name="speciesId" required>
                <option value="">Select Species</option>
                {species.map((item) => (
                  <option key={item.speciesId} value={item.speciesId}>
                    {item.speciesName}
                  </option>
                ))}
              </FormSelect>

              <FormSelect label="Breed" name="breedId">
                <option value="">Select Breed</option>
                {breeds.map((item) => (
                  <option key={item.breedId} value={item.breedId}>
                    {item.breedName} ({item.species.speciesName})
                  </option>
                ))}
              </FormSelect>

              <FormSelect label="Gender" name="gender" defaultValue="UNKNOWN">
                {genders.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FormSelect>

              <FormSelect label="Status" name="status" defaultValue="ACTIVE">
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
                defaultValue="UNKNOWN"
              >
                {neuterStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FormSelect>

              <FormInput label="Birth Date" name="birthDate" type="date" />

              <FormInput
                label="Estimated Age"
                name="estimatedAge"
                placeholder="e.g. 2 years, 6 months"
              />

              <FormSelect
                label="Body Size"
                name="bodySize"
                defaultValue="UNKNOWN"
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
                placeholder="kg"
              />

              <FormInput
                label="Height"
                name="high"
                type="number"
                step="0.01"
                placeholder="cm"
              />

              <FormInput
                label="Blood Type"
                name="bloodType"
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
                placeholder="Optional"
              />

              <FormInput
                label="Pedigree No"
                name="pedigreeNo"
                placeholder="Optional"
              />

              <FormInput
                label="Pedigree Name"
                name="pedigreeName"
                placeholder="Optional"
              />

              <FormInput
                label="Rabies Tag No"
                name="rabiesTagNo"
                placeholder="Optional"
              />

              <FormInput
                label="Insurance No"
                name="insuranceNo"
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
                label="Pet Photo"
                name="petPhoto"
                accept="image/jpeg,image/png,image/webp"
                description="Optional. JPG, PNG, or WEBP. Max 5MB."
              />

              <FormInput
                label="Pet Photo URL"
                name="petPhotoUrl"
                placeholder="Optional external image URL"
              />

              <FormInput
                label="Primary Coat Color"
                name="coatColorPrimary"
                placeholder="Optional"
              />

              <FormInput
                label="Secondary Coat Color"
                name="coatColorSecondary"
                placeholder="Optional"
              />

              <FormInput
                label="Coat Pattern"
                name="coatPattern"
                placeholder="Optional"
              />

              <FormInput
                label="Hair Type"
                name="hairType"
                placeholder="Optional"
              />

              <FormInput
                label="Marking"
                name="marking"
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
                placeholder="Optional note"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Link
              href="/pets"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Save Pet
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
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