import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { startOfOperationalWeek } from "./week-config";

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

/**
 * Operational week start (Thursday). Delegates to `week-config.ts` so the
 * week-start is configurable in one place.
 */
export function startOfWeek(d: Date) {
  return startOfOperationalWeek(d);
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
