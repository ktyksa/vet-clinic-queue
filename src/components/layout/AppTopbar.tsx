import { logoutAction } from "@/actions/auth.actions";

type AppTopbarProps = {
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  preferredLanguage?: string | null;
};

function formatRole(role?: string | null) {
  if (!role) return "User";
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function UserAvatar() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
      <svg viewBox="0 0 48 48" className="h-11 w-11" aria-hidden="true">
        <rect width="48" height="48" fill="#eff6ff" />
        <circle cx="24" cy="18" r="8" fill="#94a3b8" />
        <path d="M10 42c1.8-8.4 8-14 14-14s12.2 5.6 14 14" fill="#64748b" />
        <path d="M17 19c3.8-1 7.8-3 10-6 1.4 3 3.2 5 4 7" stroke="#475569" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

export function AppTopbar({ fullName, email, role, preferredLanguage }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-5 py-2.5 shadow-[0_1px_10px_rgba(15,23,42,0.04)] backdrop-blur 2xl:px-7">
      <div className="flex items-center justify-between gap-4">
        <button type="button" className="flex min-w-0 items-center gap-3 rounded-2xl px-1.5 py-1 text-left transition hover:bg-slate-50">
          <UserAvatar />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-950">{fullName ?? "User"}</p>
            <p className="truncate text-xs font-normal leading-5 text-slate-500">{email ?? formatRole(role)}</p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:inline-flex">
            {formatRole(role)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {preferredLanguage ?? "TH"}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
