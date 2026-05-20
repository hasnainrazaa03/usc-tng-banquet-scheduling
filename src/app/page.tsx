import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const s = await getSession();
  if (!s) redirect("/login");
  redirect("/dashboard");
}
