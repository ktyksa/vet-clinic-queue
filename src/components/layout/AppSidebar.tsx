"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import { navigationGroups } from "@/lib/navigation";
import type { TodayOperations } from "@/components/layout/AppShell";

type AppSidebarProps = {
  role: UserRole;
  todayOperations?: TodayOperations;
};

type IconProps = { className?: string };

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SvgIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function HomeIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M9.5 20v-5h5v5" /></SvgIcon>;
}
function CalendarIcon(props: IconProps) {
  return <SvgIcon {...props}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></SvgIcon>;
}
function QueueIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M4 7h12" /><path d="m13 4 3 3-3 3" /><path d="M20 17H8" /><path d="m11 14-3 3 3 3" /></SvgIcon>;
}
function VisitIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M12 10v6" /></SvgIcon>;
}
function UsersIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></SvgIcon>;
}
function PawIcon(props: IconProps) {
  return <SvgIcon {...props}><circle cx="8" cy="8" r="2" /><circle cx="16" cy="8" r="2" /><circle cx="6" cy="13" r="1.8" /><circle cx="18" cy="13" r="1.8" /><path d="M8.8 17.3c.9-2.2 5.5-2.2 6.4 0 .6 1.4-.5 2.7-1.9 2.7-.8 0-1.1-.4-1.3-.4s-.5.4-1.3.4c-1.4 0-2.5-1.3-1.9-2.7Z" /></SvgIcon>;
}
function VetIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></SvgIcon>;
}
function ShieldIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" /><path d="M9 12h6M12 9v6" /></SvgIcon>;
}
function SyringeIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m18 2 4 4" /><path d="m17 7 2-2" /><path d="M8 16 3 21" /><path d="m14 4 6 6-8 8-6-6z" /><path d="m5 13 6 6" /></SvgIcon>;
}
function BoxIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M21 8 12 3 3 8l9 5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></SvgIcon>;
}
function ReportIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-3" /></SvgIcon>;
}
function LockIcon(props: IconProps) {
  return <SvgIcon {...props}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></SvgIcon>;
}
function SettingsIcon(props: IconProps) {
  return <SvgIcon {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9.3 1.7 1.7 0 0 0-.7 1.6V22h-4v-.2a1.7 1.7 0 0 0-.7-1.6 1.7 1.7 0 0 0-1.9-.3l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 4.2 14H4v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9-.3A1.7 1.7 0 0 0 10 1.8V1h4v.8a1.7 1.7 0 0 0 .7 1.6 1.7 1.7 0 0 0 1.9.3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.2a1.7 1.7 0 0 0-1.4 1Z" /></SvgIcon>;
}
function MenuIcon(props: IconProps) {
  return <SvgIcon {...props}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></SvgIcon>;
}
function XIcon(props: IconProps) {
  return <SvgIcon {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></SvgIcon>;
}

function getIcon(label: string) {
  const iconMap: Record<string, (props: IconProps) => ReactNode> = {
    Dashboard: HomeIcon,
    Pets: PawIcon,
    Owners: UsersIcon,
    "Appointment Calendar": CalendarIcon,
    "Medical Queue": QueueIcon,
    Visits: VisitIcon,
    "Visit Intake": VisitIcon,
    Clients: UsersIcon,
    Veterinarians: VetIcon,
    Services: ShieldIcon,
    Vaccines: SyringeIcon,
    Products: BoxIcon,
    Reports: ReportIcon,
    "User Management": UsersIcon,
    Users: UsersIcon,
    "Roles & Permissions": LockIcon,
    Settings: SettingsIcon,
    Species: PawIcon,
  };
  return iconMap[label] ?? VisitIcon;
}

function SidebarContent({ role, todayOperations, onNavClick }: AppSidebarProps & { onNavClick?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="mb-8 flex items-center gap-3 px-1">
        <PawIcon className="h-9 w-9 text-blue-600" />
        <div>
          <h1 className="text-[22px] font-semibold leading-6 tracking-[-0.03em] text-slate-950">Vet Clinic</h1>
          <p className="mt-0.5 text-[13px] font-normal text-slate-500">Management System</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter((item) =>
            hasPermission(role, item.moduleName, item.actionName),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {group.title}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = getIcon(item.label);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavClick}
                      className={
                        active
                          ? "flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2.5 text-[15px] font-semibold text-blue-700"
                          : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                      }
                    >
                      <Icon className={active ? "h-5 w-5 text-blue-600" : "h-5 w-5 text-slate-400"} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-900">Today's Operations</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-400">Queue-aware clinic summary</div>
        </div>
        <div className="space-y-2 text-xs font-medium text-slate-600">
          <OverviewLine color="bg-blue-600" label="Appointments" value={todayOperations?.appointments ?? 0} />
          <OverviewLine color="bg-sky-500" label="Walk-in" value={todayOperations?.walkIn ?? 0} />
          <OverviewLine color="bg-cyan-500" label="Waiting Triage" value={todayOperations?.waitingTriage ?? 0} />
          <OverviewLine color="bg-teal-500" label="Intake" value={todayOperations?.intake ?? 0} />
          <OverviewLine color="bg-orange-500" label="Waiting Vet" value={todayOperations?.waitingVet ?? 0} />
          <OverviewLine color="bg-violet-500" label="In Service" value={todayOperations?.inService ?? 0} />
          <OverviewLine color="bg-emerald-500" label="Completed" value={todayOperations?.completed ?? 0} />
          <OverviewLine color="bg-rose-500" label="Cancelled" value={todayOperations?.cancelled ?? 0} />
          <OverviewLine color="bg-zinc-500" label="No Show" value={todayOperations?.noShow ?? 0} />
          <OverviewLine
            color="bg-slate-400"
            label="Avg Wait"
            value={todayOperations?.avgWaitMinutes == null ? "-" : `${todayOperations.avgWaitMinutes}m`}
          />
        </div>
        <Link
          href="/medical-queue"
          onClick={onNavClick}
          className="mt-4 flex items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          View Full Queue →
        </Link>
      </div>
    </>
  );
}

export function AppSidebar({ role, todayOperations }: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button — visible on < lg */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-slate-200 lg:hidden"
      >
        <MenuIcon className="h-5 w-5 text-slate-700" />
      </button>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[292px] flex-col overflow-y-auto border-r border-slate-200/70 bg-white px-5 py-5 transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile navigation"
      >
        <div className="mb-4 flex items-center justify-between">
          <PawIcon className="h-7 w-7 text-blue-600" />
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent role={role} todayOperations={todayOperations} onNavClick={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar — visible on >= lg */}
      <aside className="hidden min-h-screen w-[292px] shrink-0 flex-col border-r border-slate-200/70 bg-white px-5 py-5 lg:flex">
        <SidebarContent role={role} todayOperations={todayOperations} />
      </aside>
    </>
  );
}

function OverviewLine({ color, label, value }: { color: string; label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5">
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  );
}
