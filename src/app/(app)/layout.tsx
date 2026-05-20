import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen flex bg-canvas">
      <Sidebar role={session.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={session} />
        <main className="flex-1 p-6 lg:p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
