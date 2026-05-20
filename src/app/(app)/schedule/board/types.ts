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

export type Assignment = {
  id: string;
  serverId: string;
  roleCode: string | null;
  locked: boolean;
  acknowledged: boolean;
  reason: string | null;
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
  event: { id: string; name: string } | null;
};

export type Schedule = {
  id: string;
  name: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  revisionDate: string | null;
};

export type BoardData = { schedule: Schedule; shifts: Shift[]; servers: Server[] };

export const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type DayOfWeek = (typeof DOW)[number];

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function dayKey(iso: string): DayOfWeek {
  const d = new Date(iso);
  return DOW[d.getDay()];
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
