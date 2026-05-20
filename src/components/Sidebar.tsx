"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard, ClipboardList, Upload, MapPin, Users, Award,
  CalendarCheck, CalendarClock, Wand2, GanttChartSquare, Printer, ScrollText, Database
} from "lucide-react";

const NAV: { href: string; label: string; icon: any; roles: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN","MANAGER","SUPERVISOR","EMPLOYEE"] },
  { href: "/beos", label: "BEOs", icon: ClipboardList, roles: ["ADMIN","MANAGER","SUPERVISOR"] },
  { href: "/beos/import", label: "BEO Import", icon: Upload, roles: ["ADMIN","MANAGER"] },
  { href: "/locations", label: "Locations & Rooms", icon: MapPin, roles: ["ADMIN","MANAGER"] },
  { href: "/servers", label: "Server Database", icon: Users, roles: ["ADMIN","MANAGER","SUPERVISOR"] },
  { href: "/seniority", label: "Seniority", icon: Award, roles: ["ADMIN","MANAGER"] },
  { href: "/availability", label: "Availability", icon: CalendarCheck, roles: ["ADMIN","MANAGER","SUPERVISOR","EMPLOYEE"] },
  { href: "/time-off", label: "Time-Off Requests", icon: CalendarClock, roles: ["ADMIN","MANAGER","SUPERVISOR","EMPLOYEE"] },
  { href: "/schedule/generate", label: "Generate Schedule", icon: Wand2, roles: ["ADMIN","MANAGER"] },
  { href: "/schedule/board", label: "Schedule Board", icon: GanttChartSquare, roles: ["ADMIN","MANAGER","SUPERVISOR"] },
  { href: "/schedule/print", label: "Printable Schedule", icon: Printer, roles: ["ADMIN","MANAGER","SUPERVISOR","EMPLOYEE"] },
  { href: "/audit", label: "Audit Log", icon: ScrollText, roles: ["ADMIN","MANAGER"] },
  { href: "/master-data", label: "Master Data", icon: Database, roles: ["ADMIN","MANAGER"] },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex w-64 shrink-0 bg-gradient-to-b from-cardinal to-cardinal-700 text-white flex-col">
      <div className="p-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-white text-cardinal grid place-items-center font-display font-black">T&amp;G</div>
          <div>
            <div className="font-display text-lg leading-tight">USC Town &amp; Gown</div>
            <div className="text-xs text-white/70">Banquet Operations</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV.filter((n) => n.roles.includes(role)).map((n) => {
          const Icon = n.icon;
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} className={cn("nav-link", active && "active")}>
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-xs text-white/60 border-t border-white/10">
        v0.1 · Cardinal &amp; Gold
      </div>
    </aside>
  );
}
