import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";
import { updateOwner } from "@/actions/owner.actions";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditOwnerPage({ params }: Props) {
  await requirePermission("owner", "update");

  const { id } = await params;

  const owner = await prisma.owner.findUnique({
    where: {
      ownerId: id,
    },
  });

  if (!owner || owner.deletedAt) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href={`/owners/${owner.ownerId}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Owner Detail
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Edit Owner
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Update owner contact information, address and remark.
          </p>
        </div>

        <form action={updateOwner.bind(null, owner.ownerId)} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Contact Information"
              description="Main contact details for this pet owner."
            />

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <FormInput
                label="Full Name"
                name="fullName"
                required
                defaultValue={owner.fullName}
              />

              <FormInput
                label="Phone No"
                name="phoneNo"
                required
                defaultValue={owner.phoneNo}
              />

              <FormInput
                label="Line ID"
                name="lineId"
                defaultValue={owner.lineId ?? ""}
              />

              <FormInput
                label="Email"
                name="email"
                type="email"
                defaultValue={owner.email ?? ""}
              />

              <FormInput
                label="Other Social Media"
                name="othersSocialMedia"
                defaultValue={owner.othersSocialMedia ?? ""}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Address Information"
              description="Owner address information following the Owner model order."
            />

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <FormInput
                label="House No"
                name="houseNo"
                defaultValue={owner.houseNo ?? ""}
              />

              <FormInput
                label="Village Name"
                name="villageName"
                defaultValue={owner.villageName ?? ""}
              />

              <FormInput
                label="Building Name"
                name="buildingName"
                defaultValue={owner.buildingName ?? ""}
              />

              <FormInput
                label="Soi"
                name="soi"
                defaultValue={owner.soi ?? ""}
              />

              <FormInput
                label="Road"
                name="road"
                defaultValue={owner.road ?? ""}
              />

              <FormInput
                label="Sub District"
                name="subDistrict"
                defaultValue={owner.subDistrict ?? ""}
              />

              <FormInput
                label="District"
                name="district"
                defaultValue={owner.district ?? ""}
              />

              <FormInput
                label="Province"
                name="province"
                defaultValue={owner.province ?? ""}
              />

              <FormInput
                label="Postal Code"
                name="postalCode"
                defaultValue={owner.postalCode ?? ""}
              />

              <FormInput
                label="Country"
                name="country"
                defaultValue={owner.country ?? "Thailand"}
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
                defaultValue={owner.remark ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Link
              href={`/owners/${owner.ownerId}`}
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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
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
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}