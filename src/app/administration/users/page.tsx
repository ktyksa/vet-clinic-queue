import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toggleUserStatus } from "@/actions/user.actions";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";

export default async function UsersPage() {
  const currentUser = await requirePermission("user", "view");

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              จัดการผู้ใช้งาน บทบาท สถานะ และภาษาที่ใช้ในระบบ
            </p>
          </div>

          <Link
            href="/administration/users/new"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add User
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold">Users</h2>
            <p className="text-sm text-slate-500">
              Total {users.length} user(s)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Language</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4">Active</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isCurrentUser = user.userId === currentUser.userId;

                    return (
                      <tr key={user.userId} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium">
                          {user.fullName}
                        </td>

                        <td className="px-6 py-4">{user.email ?? "-"}</td>

                        <td className="px-6 py-4">{user.role}</td>

                        <td className="px-6 py-4">
                          <span
                            className={
                              user.status === "ACTIVE"
                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                : user.status === "INACTIVE"
                                  ? "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                                  : user.status === "SUSPENDED"
                                    ? "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                                    : "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                            }
                          >
                            {user.status}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {user.preferredLanguage}
                        </td>

                        <td className="px-6 py-4">
                          {user.lastLoginAt
                            ? user.lastLoginAt.toLocaleString("th-TH")
                            : "-"}
                        </td>

                        <td className="px-6 py-4">
                          {isCurrentUser ? (
                            <span className="text-xs font-medium text-slate-400">
                              Current User
                            </span>
                          ) : (
                            <form
                              action={toggleUserStatus.bind(
                                null,
                                user.userId
                              )}
                            >
                              <button
                                type="submit"
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                  user.activeFlag
                                    ? "bg-emerald-500"
                                    : "bg-slate-300"
                                }`}
                                title={
                                  user.activeFlag
                                    ? "Deactivate user"
                                    : "Activate user"
                                }
                              >
                                <span
                                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                                    user.activeFlag
                                      ? "translate-x-5"
                                      : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}