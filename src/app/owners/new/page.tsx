import Link from "next/link";

import { createOwner } from "@/actions/owner.actions";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";

export default async function NewOwnerPage() {
  await requirePermission("owner", "create");

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/owners"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Owner List
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Add Owner
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create a new owner profile with contact information, address and
            remark.
          </p>
        </div>

        <form action={createOwner} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Contact Information"
              description="Main contact details for the pet owner."
            />

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <FormInput
                label="Full Name"
                name="fullName"
                required
                placeholder="ชื่อ-นามสกุล"
              />

              <FormInput
                label="Phone No"
                name="phoneNo"
                required
                placeholder="เบอร์โทร"
              />

              <FormInput
                label="Line ID"
                name="lineId"
                placeholder="LINE ID"
              />

              <FormInput
                label="Email"
                name="email"
                type="email"
                placeholder="email@example.com"
              />

              <FormInput
                label="Other Social Media"
                name="othersSocialMedia"
                placeholder="Facebook / Instagram / TikTok"
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
                placeholder="บ้านเลขที่"
              />

              <FormInput
                label="Village Name"
                name="villageName"
                placeholder="หมู่บ้าน"
              />

              <FormInput
                label="Building Name"
                name="buildingName"
                placeholder="อาคาร"
              />

              <FormInput label="Soi" name="soi" placeholder="ซอย" />

              <FormInput label="Road" name="road" placeholder="ถนน" />

              <FormInput
                label="Sub District"
                name="subDistrict"
                placeholder="แขวง/ตำบล"
              />

              <FormInput
                label="District"
                name="district"
                placeholder="เขต/อำเภอ"
              />

              <FormInput
                label="Province"
                name="province"
                placeholder="จังหวัด"
              />

              <FormInput
                label="Postal Code"
                name="postalCode"
                placeholder="รหัสไปรษณีย์"
              />

              <FormInput
                label="Country"
                name="country"
                defaultValue="Thailand"
                placeholder="ประเทศ"
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
                placeholder="หมายเหตุ"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Link
              href="/owners"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Save Owner
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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}