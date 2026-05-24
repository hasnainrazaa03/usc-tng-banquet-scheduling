"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard, ClipboardList, Upload, MapPin, Users, Award,
  CalendarCheck, CalendarClock, GanttChartSquare, Printer, ScrollText,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

/**
 * Collapsible sidebar.
 *
 * The collapsed/expanded state is persisted to localStorage so the user's
 * preference survives navigation. When collapsed, only icons are visible
 * — labels appear as native `title` tooltips. The expanded width is 16rem
 * (matches the previous fixed `w-64`); collapsed width is 4rem.
 *
 * The Generate Schedule entry has been removed in Phase 10 — its features
 * are now part of the Schedule Board (`ScheduleOpsPanel`).
 */

/**
 * Phase 11: collapsed to three roles (ADMIN / MANAGER / SERVER). Each NAV
 * entry lists the roles allowed to *see* the link. Pages also enforce
 * role gates server-side via `requireRole` so the sidebar is purely a UX
 * surface, not a security boundary.
 *
 * Server-only "My Shifts" (/schedule/print?onlyMine=1) is exposed at the
 * top of the SERVER nav so the most common server action is one click.
 */
const NAV: { href: string; label: string; icon: any; roles: UserRole[] }[] = [
  { href: "/dashboard",            label: "Dashboard",          icon: LayoutDashboard,  roles: ["ADMIN","MANAGER","SERVER"] },
  { href: "/schedule/print",       label: "My Schedule",        icon: Printer,          roles: ["SERVER"] },
  { href: "/availability",         label: "My Availability",    icon: CalendarCheck,    roles: ["SERVER"] },
  { href: "/time-off",             label: "My Time-Off",        icon: CalendarClock,    roles: ["SERVER"] },
  { href: "/beos",                 label: "BEOs",               icon: ClipboardList,    roles: ["ADMIN","MANAGER"] },
  { href: "/beos/import",          label: "BEO Import",         icon: Upload,           roles: ["ADMIN","MANAGER"] },
  { href: "/locations",            label: "Venues",             icon: MapPin,           roles: ["ADMIN","MANAGER"] },
  { href: "/servers",              label: "Server Database",    icon: Users,            roles: ["ADMIN","MANAGER"] },
  { href: "/seniority",            label: "Seniority",          icon: Award,            roles: ["ADMIN","MANAGER"] },
  { href: "/availability",         label: "Availability",       icon: CalendarCheck,    roles: ["ADMIN","MANAGER"] },
  { href: "/time-off",             label: "Time-Off Requests",  icon: CalendarClock,    roles: ["ADMIN","MANAGER"] },
  { href: "/schedule/board",       label: "Schedule Board",     icon: GanttChartSquare, roles: ["ADMIN","MANAGER"] },
  { href: "/schedule/print",       label: "Printable Schedule", icon: Printer,          roles: ["ADMIN","MANAGER"] },
  { href: "/audit",                label: "Audit Log",          icon: ScrollText,       roles: ["ADMIN"] },
];

const COLLAPSED_KEY = "usc-pec-sidebar-collapsed";

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated]);

  return (
    <aside
      className={cn(
        "hidden lg:flex shrink-0 bg-gradient-to-b from-cardinal to-cardinal-700 text-white flex-col transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "p-3 border-b border-white/10 flex items-center gap-2",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-md bg-white text-cardinal grid place-items-center font-display font-black flex-shrink-0">
              USC
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg leading-tight truncate">
                Private Events
              </div>
              <div className="text-xs text-white/70 truncate">&amp; Conferences</div>
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="p-2 rounded hover:bg-white/10 text-white/80 hover:text-white transition flex-shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {NAV.filter((n) => n.roles.includes(role)).map((n) => {
          const Icon = n.icon;
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              title={collapsed ? n.label : undefined}
              className={cn(
                "nav-link",
                active && "active",
                collapsed && "!justify-center !px-2",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{n.label}</span>}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="p-3 text-xs text-white/60 border-t border-white/10">
          v0.4 · Cardinal &amp; Gold
        </div>
      )}
    </aside>
  );
}
