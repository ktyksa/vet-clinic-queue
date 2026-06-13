import Link from "next/link";
import { createUser } from "@/actions/user.actions";

const roles = [
  "ADMIN",
  "CLINIC_OWNER",
  "VETERINARIAN",
  "VET_ASSISTANT",
  "LAB_TECHNICIAN",
  "RECEPTIONIST",
  "CASHIER",
  "PHARMACIST",
  "GROOMER",
  "STAFF",
];

const statuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "TERMINATED"];

export default function NewUserPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link
            href="/administration/users"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Users
          </Link>

          <h1 className="mt-4 text-3xl font-bold">Add User</h1>
          <p className="mt-1 text-sm text-slate-500">
            สร้างผู้ใช้งานระบบ กำหนดบทบาท สถานะ และภาษา
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <form action={createUser} className="space-y-6 p-6">
            <Input name="fullName" label="Full Name" required />
            <Input name="email" label="Email" type="email" required />
            <Input name="phoneNo" label="Phone Number" />

            <Select name="role" label="Role" options={roles} defaultValue="STAFF" />
            <Select
              name="status"
              label="Status"
              options={statuses}
              defaultValue="ACTIVE"
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Display Language
              </label>
              <select
                name="preferredLanguage"
                defaultValue="TH"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5"
              >
                <option value="TH">ไทย</option>
                <option value="EN">English</option>
              </select>
            </div>

            <Input name="licenseNo" label="License No." />

            <Input
              name="password"
              label="Temporary Password"
              type="password"
              required
            />

            <p className="text-xs text-slate-500">
              Password ต้องมีอย่างน้อย 8 ตัวอักษร พร้อมตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก
              ตัวเลข และอักขระพิเศษ
            </p>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
              <Link
                href="/administration/users"
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-100"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Save User
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function Input({
  name,
  label,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5"
      />
    </div>
  );
}

function Select({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5"
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}