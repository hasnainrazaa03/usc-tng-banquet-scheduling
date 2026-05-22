/** Shared board types — single source of truth so subcomponents stay tidy. */

export type Server = {
  id: string;
  firstName: string;
  lastName: string;
  classification: string;
  preferredLocations: string[];
  preferredShifts: string[];
  seniority?: { seniorityRank: number | null; seniorityScore: number; yearsOfService: number };
  qualifications: { qualification: { code: string; name: string } }[];
};

/** Manager candidate shown in the managers drawer for drag-and-drop. */
export type Manager = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type Assignment = {
  id: string;
  serverId: string;
  roleCode: string | null;
  locked: boolean;
  acknowledged: boolean;
  reason: string | null;
  calledOut: boolean;
  calledOutReason: string | null;
  server: Server;
};

export type Requirement = {
  id: string;
  count: number;
  role: { id: string; code: string; name: string; color: string | null };
};

export type Shift = {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  locationCode: string | null;
  roomCode: string | null;
  label: string | null;
  statusCode: string;
  requirements: Requirement[];
  assignments: Assignment[];
  event:
    | {
        id: string;
        name: string;
        guests?: number | null;
        beo?: {
          id: string;
          postAs: string;
          expectedGuests: number | null;
          manager: { id: string; name: string } | null;
          location: { code: string; name: string } | null;
          room: { code: string; name: string } | null;
        } | null;
      }
    | null;
};

export type Schedule = {
  id: string;
  name: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  revisionDate: string | null;
};

export type BoardData = {
  schedule: Schedule;
  shifts: Shift[];
  servers: Server[];
  managers: Manager[];
  siblingSchedules?: SiblingSchedule[];
};

export type SiblingSchedule = {
  id: string;
  name: string;
  weekStart: string;
  weekEnd: string;
  status: string;
};

// Re-export the operational week constants so existing imports keep working
// without each component needing to reach into `@/lib/week-config`.
import {
  DOW_OPERATIONAL,
  DOW_NATIVE,
  DOW_LONG,
  dowCode,
  type DowCode,
} from "@/lib/week-config";

/**
 * @deprecated Use `DOW_OPERATIONAL` from `@/lib/week-config` instead.
 * Kept as a name alias so existing callers continue to compile; this now
 * iterates Thursday-first to match the operational week.
 */
export const DOW = DOW_OPERATIONAL;
export type DayOfWeek = DowCode;
export { DOW_OPERATIONAL, DOW_NATIVE, DOW_LONG };

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function dayKey(iso: string): DayOfWeek {
  return dowCode(iso);
}

/** Color tokens for roles & statuses. Co-located so the board + print share. */
export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CAP: { bg: "bg-cardinal-50",  text: "text-cardinal-800", border: "border-cardinal-200" },
  SVR: { bg: "bg-white",        text: "text-ink",           border: "border-ink/15" },
  BAR: { bg: "bg-gold-50",      text: "text-gold-900",      border: "border-gold-200" },
  BBK: { bg: "bg-amber-50",     text: "text-amber-900",     border: "border-amber-200" },
  HSP: { bg: "bg-slate-50",     text: "text-slate-900",     border: "border-slate-200" },
  AV:  { bg: "bg-sky-50",       text: "text-sky-900",       border: "border-sky-200" },
  SUP: { bg: "bg-cardinal-100", text: "text-cardinal-900",  border: "border-cardinal-300" },
};

export const STATUS_COLORS: Record<string, string> = {
  OFF:      "bg-gray-200 text-gray-700 border-gray-300",
  VAC:      "bg-amber-100 text-amber-900 border-amber-200",
  MLA:      "bg-sky-100 text-sky-900 border-sky-200",
  SICK:     "bg-red-100 text-red-900 border-red-200",
  HOLIDAY:  "bg-violet-100 text-violet-900 border-violet-200",
  TRAINING: "bg-emerald-100 text-emerald-900 border-emerald-200",
};
