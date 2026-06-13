import { logoutAction } from "@/actions/auth.actions";

export default function LogoutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Logout
        </button>
      </form>
    </main>
  );
}