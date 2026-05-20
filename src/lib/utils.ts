import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtTime(d: Date | string) {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
export function fmtDate(d: Date | string) {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
export function fmtDay(d: Date | string) {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

export function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
