"use client";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { LogOut, Search } from "lucide-react";

export default function Topbar({ user }: { user: SessionUser }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="h-16 bg-white border-b border-ink/5 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3 text-sm">
        <div className="hidden md:flex items-center gap-2 bg-canvas-soft rounded-lg px-3 py-2 w-80">
          <Search className="h-4 w-4 text-ink-muted" />
          <input placeholder="Search BEOs, servers, events…" className="bg-transparent outline-none flex-1" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-ink-muted">{user.role}</div>
        </div>
        <div className="h-9 w-9 rounded-full bg-cardinal text-white grid place-items-center font-medium">
          {user.name.split(" ").map((p) => p[0]).slice(0,2).join("")}
        </div>
        <button className="btn-ghost" onClick={logout} title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
