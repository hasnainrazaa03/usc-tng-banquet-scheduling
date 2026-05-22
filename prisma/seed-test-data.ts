/**
 * Phase 5.1 — Synthetic test-data seed.
 *
 * What this script does (idempotent: safe to re-run):
 *
 *   1. Normalizes every Server.classification to BANQUET_SERVER for the
 *      synthetic dataset (test data only — historical seniority/notes are
 *      preserved).
 *   2. Wipes prior synthetic BEOs (those tagged with `[synthetic]` in
 *      `miscNotes`) and their derived Events/Shifts/Assignments.
 *   3. Generates 12 varied BEOs across the next 14 days, each with:
 *        • realistic event name, account, bookingId, uepaNumber (BEO #)
 *        • venue (Location) + room (Room) selected from the master data
 *        • manager FK linked to one of the 6 USC named managers
 *        • guest count, time window, menu/AV/setup notes
 *        • a Main Service section with derived staffing needs (SVR only)
 *        • a derived Event + Shift in the matching weekly Schedule
 *   4. Generates realistic Availability windows for every active server
 *      (varied per server: full-time vs part-time, weekend vs weekday).
 *   5. Generates a handful of TimeOffRequest records (a mix of APPROVED
 *      and PENDING) so the auto-scheduler has constraints to honour.
 *
 * Run with:  npm run db:seed:test
 */

import {
  PrismaClient,
  BEOStatus,
  JobClassification,
  TimeOffStatus,
  ScheduleStatus,
  ShiftStatusCode,
  DayOfWeek,
} from "@prisma/client";
import { startOfOperationalWeek } from "../src/lib/week-config";

const prisma = new PrismaClient();

const SYNTHETIC_TAG = "[synthetic-test-data]";

// ─── Helpers ────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function atTime(d: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}
function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}
function fmtMMDDYYYY(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

// ─── BEO templates ──────────────────────────────────────────────────────
//
// Each template gets paired with a specific date + venue + manager in main()
// so we cover a varied surface (different venue groups, day vs night, big
// vs small).
//
type Template = {
  postAs: string;
  account: string;
  bookingId: string;
  uepaNumber: string;
  start: string;
  end: string;
  guests: number;
  venueCode: string;      // Location code preference
  roomCode?: string;      // optional Room narrowing
  managerEmail: string;
  menu: string[];
  av: string;
  setup: string;
  notes: string;
};

const MANAGERS = {
  juanita: "juanita.gomez@usc.edu",
  leticia: "leticia.velasquez@usc.edu",
  eddie: "eddie.cuevas@usc.edu",
  levi: "levi.flefil@usc.edu",
  jovon: "jovon.oconnor@usc.edu",
  alonso: "alonso.recinos@usc.edu",
} as const;

// 12 distinct templates spanning the next 14 days. dayOffset is filled in
// at run time so the data slides forward as days pass.
const TEMPLATES: Array<Omit<Template, never> & { dayOffset: number }> = [
  {
    dayOffset: 0,
    postAs: "USC Dornsife Gala Dinner",
    account: "USC Dornsife College",
    bookingId: "BK-2026-1101",
    uepaNumber: "BEO-2026-1101",
    start: "17:30", end: "22:30", guests: 220,
    venueCode: "UPC-MAIN", roomCode: "TNG",
    managerEmail: MANAGERS.eddie,
    menu: ["Passed hors d'oeuvres", "Caesar salad", "Filet & sea bass duet", "Chocolate trio"],
    av: "2 wireless mics, 16:9 projector, podium",
    setup: "Rounds of 10, head table for 12, 3 bars",
    notes: "VIP guest list — coordinate with President's office",
  },
  {
    dayOffset: 1,
    postAs: "Marshall School Donor Luncheon",
    account: "USC Marshall School of Business",
    bookingId: "BK-2026-1102",
    uepaNumber: "BEO-2026-1102",
    start: "11:30", end: "14:00", guests: 85,
    venueCode: "UCLUB-MAIN", roomCode: "UCLUB",
    managerEmail: MANAGERS.juanita,
    menu: ["Seasonal salad", "Grilled salmon", "Lemon tart"],
    av: "Wireless lavalier mic",
    setup: "Rounds of 8, lectern centre-front",
    notes: "Dean attending — confirm seating chart day-of",
  },
  {
    dayOffset: 2,
    postAs: "Keck Medicine Faculty Reception",
    account: "Keck School of Medicine",
    bookingId: "BK-2026-1103",
    uepaNumber: "BEO-2026-1103",
    start: "18:00", end: "21:00", guests: 140,
    venueCode: "HSC-MAIN", roomCode: "HSC-CC",
    managerEmail: MANAGERS.leticia,
    menu: ["Heavy hors d'oeuvres", "Sushi station", "Carving station", "Dessert display"],
    av: "Background music, 2 area speakers",
    setup: "Cocktail rounds, 2 bars, lounge groupings",
    notes: "Vegetarian + halal options required",
  },
  {
    dayOffset: 3,
    postAs: "USC Trustees Board Breakfast",
    account: "USC Office of the President",
    bookingId: "BK-2026-1104",
    uepaNumber: "BEO-2026-1104",
    start: "07:30", end: "10:00", guests: 45,
    venueCode: "USCH-MAIN", roomCode: "HOTEL-1880",
    managerEmail: MANAGERS.jovon,
    menu: ["Continental breakfast", "Hot egg dish", "Fresh fruit"],
    av: "Wireless mic, projector, screen",
    setup: "U-shape for 45, water service throughout",
    notes: "Confidential — restrict server access list",
  },
  {
    dayOffset: 4,
    postAs: "Viterbi Engineering Alumni Mixer",
    account: "USC Viterbi School of Engineering",
    bookingId: "BK-2026-1105",
    uepaNumber: "BEO-2026-1105",
    start: "18:30", end: "21:30", guests: 180,
    venueCode: "UPC-MAIN", roomCode: "MORETON",
    managerEmail: MANAGERS.alonso,
    menu: ["Heavy hors d'oeuvres", "Action stations", "Mini desserts"],
    av: "DJ-provided sound, 2 mics for remarks",
    setup: "High-tops, 3 bars, soft seating cluster",
    notes: "Outdoor patio — check forecast 48h prior",
  },
  {
    dayOffset: 5,
    postAs: "Annenberg Communication Symposium",
    account: "USC Annenberg School",
    bookingId: "BK-2026-1106",
    uepaNumber: "BEO-2026-1106",
    start: "08:30", end: "16:30", guests: 120,
    venueCode: "UPC-MAIN", roomCode: "FORUM",
    managerEmail: MANAGERS.eddie,
    menu: ["Breakfast buffet", "Plated lunch", "PM coffee break"],
    av: "Full panel A/V — 4 mics, dual screens, recording",
    setup: "Theater for keynote, rounds of 10 for lunch",
    notes: "All-day refresh — coffee/water replenish hourly",
  },
  {
    dayOffset: 6,
    postAs: "Rossier School Graduation Reception",
    account: "USC Rossier School of Education",
    bookingId: "BK-2026-1107",
    uepaNumber: "BEO-2026-1107",
    start: "15:00", end: "18:00", guests: 320,
    venueCode: "UPC-MAIN", roomCode: "TNG",
    managerEmail: MANAGERS.levi,
    menu: ["Champagne toast", "Heavy hors d'oeuvres", "Cake cutting"],
    av: "2 mics, photo backdrop lighting",
    setup: "Cocktail style, 4 bars, photo wall",
    notes: "Cake delivery 14:00 — receive at loading dock",
  },
  {
    dayOffset: 7,
    postAs: "Price School Policy Roundtable",
    account: "USC Price School of Public Policy",
    bookingId: "BK-2026-1108",
    uepaNumber: "BEO-2026-1108",
    start: "12:00", end: "15:30", guests: 30,
    venueCode: "UCLUB-MAIN", roomCode: "SCRIPTORIUM",
    managerEmail: MANAGERS.juanita,
    menu: ["Plated lunch", "Coffee/tea service"],
    av: "Conference phone, wireless lavalier",
    setup: "Hollow square for 30",
    notes: "Press briefing follows — keep 15:30-16:00 clear",
  },
  {
    dayOffset: 8,
    postAs: "USC Athletics Hall of Fame Dinner",
    account: "USC Heritage Hall",
    bookingId: "BK-2026-1109",
    uepaNumber: "BEO-2026-1109",
    start: "18:00", end: "23:00", guests: 280,
    venueCode: "USCH-MAIN", roomCode: "HOTEL-GBR",
    managerEmail: MANAGERS.jovon,
    menu: ["Reception", "Plated 4-course", "Wine pairing", "Late-night bites"],
    av: "Stage lighting, dual screens, in-house DJ, video roll-in",
    setup: "Rounds of 10, raised stage, awards riser",
    notes: "Award presentation 20:30 — stage cues from production team",
  },
  {
    dayOffset: 9,
    postAs: "USC Caruso Law Faculty Luncheon",
    account: "USC Gould School of Law",
    bookingId: "BK-2026-1110",
    uepaNumber: "BEO-2026-1110",
    start: "12:00", end: "14:30", guests: 65,
    venueCode: "UPC-MAIN", roomCode: "VINEYARD",
    managerEmail: MANAGERS.alonso,
    menu: ["Plated 3-course", "House wine"],
    av: "Wireless mic",
    setup: "Rounds of 10, head table for 8",
    notes: "Dean welcoming new faculty — confirm name cards",
  },
  {
    dayOffset: 11,
    postAs: "USC Iovine & Young Showcase",
    account: "Iovine & Young Academy",
    bookingId: "BK-2026-1111",
    uepaNumber: "BEO-2026-1111",
    start: "19:00", end: "23:00", guests: 200,
    venueCode: "USCH-MAIN", roomCode: "THE-LAB",
    managerEmail: MANAGERS.jovon,
    menu: ["Modern small plates", "Craft cocktail bar"],
    av: "Custom stage, video walls, full audio production",
    setup: "Lounge style, high-tops, 2 bars, DJ booth",
    notes: "Student showcase — high media presence expected",
  },
  {
    dayOffset: 13,
    postAs: "Keck Medicine Donor Brunch",
    account: "Keck Medicine of USC",
    bookingId: "BK-2026-1112",
    uepaNumber: "BEO-2026-1112",
    start: "10:30", end: "13:30", guests: 95,
    venueCode: "HSC-MAIN", roomCode: "HSC-CC",
    managerEmail: MANAGERS.leticia,
    menu: ["Brunch buffet", "Mimosa bar", "Carving station"],
    av: "Wireless mic, podium",
    setup: "Rounds of 8, podium centre-front",
    notes: "Donor recognition speeches at 12:00",
  },
];

// Servers-per-guests ratio: 1 server per ~25 guests, min 4, max 22.
function staffingFor(guests: number) {
  const count = Math.max(4, Math.min(22, Math.ceil(guests / 25)));
  return [{ roleCode: "SVR", count, note: "1 server per ~25 guests" }];
}

// ─── Realistic availability presets ─────────────────────────────────────

const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.SUN, DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED,
  DayOfWeek.THU, DayOfWeek.FRI, DayOfWeek.SAT,
];
const WEEKEND: DayOfWeek[] = [DayOfWeek.FRI, DayOfWeek.SAT, DayOfWeek.SUN];

type AvailabilityPreset = { days: DayOfWeek[]; start: string; end: string; preference: number };

const AVAILABILITY_PRESETS: AvailabilityPreset[] = [
  // Full-time core (catering majority): wide windows every day
  { days: ALL_DAYS, start: "06:00", end: "23:59", preference: 0 },
  // Lunch crew: prefer day-shift hours
  { days: ALL_DAYS, start: "09:00", end: "16:00", preference: 1 },
  // Evening crew: prefer night shifts
  { days: ALL_DAYS, start: "15:00", end: "23:59", preference: 1 },
  // Weekend-heavy part-time
  { days: WEEKEND, start: "10:00", end: "23:59", preference: 1 },
  // Weekday-only PT (school/day-job)
  { days: [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU], start: "17:00", end: "23:59", preference: 0 },
];

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log("→ Phase 5.1 synthetic test-data seed");
  const today = new Date();

  // 1) Normalize every active server to BANQUET_SERVER classification.
  console.log("→ Normalising staff roles → BANQUET_SERVER…");
  const norm = await prisma.server.updateMany({
    where: { classification: { not: JobClassification.BANQUET_SERVER } },
    data: { classification: JobClassification.BANQUET_SERVER },
  });
  console.log(`  ✓ Updated ${norm.count} server records to BANQUET_SERVER`);

  // 2) Wipe prior synthetic BEOs (tagged in miscNotes).
  console.log("→ Clearing previous synthetic BEOs (if any)…");
  const oldSynthetic = await prisma.bEO.findMany({
    where: { miscNotes: { contains: SYNTHETIC_TAG } },
    select: { id: true },
  });
  if (oldSynthetic.length > 0) {
    const ids = oldSynthetic.map((b) => b.id);
    // Cascade: BEO → Events (SetNull) → Shifts (SetNull on eventId); we
    // explicitly delete the derived Events + Shifts so the board reflects
    // the new dataset cleanly.
    const eventIds = (
      await prisma.event.findMany({ where: { beoId: { in: ids } }, select: { id: true } })
    ).map((e) => e.id);
    if (eventIds.length) {
      await prisma.shiftAssignment.deleteMany({ where: { shift: { eventId: { in: eventIds } } } });
      await prisma.shift.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    }
    await prisma.bEO.deleteMany({ where: { id: { in: ids } } });
    console.log(`  ✓ Removed ${oldSynthetic.length} prior synthetic BEOs`);
  } else {
    console.log("  ✓ None found");
  }

  // 3) Resolve master data lookups up-front.
  const allLocations = await prisma.location.findMany({ include: { rooms: true } });
  const locByCode = new Map(allLocations.map((l) => [l.code, l]));
  const roomByCode = new Map<string, { id: string; locationId: string }>();
  for (const loc of allLocations) {
    for (const r of loc.rooms) roomByCode.set(r.code, { id: r.id, locationId: r.locationId });
  }
  const managers = await prisma.user.findMany({ where: { role: "MANAGER" } });
  const mgrByEmail = new Map(managers.map((m) => [m.email, m]));

  // 4) Make sure every operational week we'll need has a Schedule row.
  console.log("→ Ensuring schedules exist for the next 14 days…");
  const baseWeekStart = startOfOperationalWeek(today);
  for (const offset of [-7, 0, 7, 14]) {
    const ws = addDays(baseWeekStart, offset);
    const exists = await prisma.schedule.findFirst({ where: { weekStart: ws } });
    if (!exists) {
      await prisma.schedule.create({
        data: {
          name: `Week of ${ws.toISOString().slice(0, 10)}`,
          weekStart: ws,
          weekEnd: addDays(ws, 6),
          status: offset < 0 ? ScheduleStatus.PUBLISHED : ScheduleStatus.DRAFT,
          notes: "Auto-created by synthetic seed",
        },
      });
    }
  }

  // 5) Create the 12 BEOs.
  console.log("→ Creating 12 synthetic BEOs across the next 14 days…");
  let createdBeos = 0;
  for (const t of TEMPLATES) {
    const eventDate = addDays(today, t.dayOffset);
    eventDate.setHours(0, 0, 0, 0);

    // Resolve venue → room. Prefer the explicit roomCode; if missing or
    // not in master data, fall back to the first room in that location.
    let room = t.roomCode ? roomByCode.get(t.roomCode) : undefined;
    const loc = locByCode.get(t.venueCode);
    if (!room && loc?.rooms[0]) room = { id: loc.rooms[0].id, locationId: loc.rooms[0].locationId };
    if (!loc && !room) {
      console.warn(`  ! Skipping "${t.postAs}" — venue ${t.venueCode} not in master data`);
      continue;
    }

    const manager = mgrByEmail.get(t.managerEmail);
    if (!manager) {
      console.warn(`  ! Skipping "${t.postAs}" — manager ${t.managerEmail} missing`);
      continue;
    }

    const startsAt = atTime(eventDate, t.start);
    const endsAt = atTime(eventDate, t.end);
    const staffing = staffingFor(t.guests);

    // Idempotent on bookingId.
    const existing = await prisma.bEO.findUnique({ where: { bookingId: t.bookingId } });
    if (existing) {
      await prisma.bEO.delete({ where: { id: existing.id } });
    }

    const beo = await prisma.bEO.create({
      data: {
        bookingId: t.bookingId,
        uepaNumber: t.uepaNumber,
        postAs: t.postAs,
        account: t.account,
        cateringManager: manager.name,
        managerId: manager.id,
        locationId: loc?.id ?? room?.locationId,
        roomId: room?.id,
        eventDate,
        startTime: startsAt,
        endTime: endsAt,
        expectedGuests: t.guests,
        menu: { items: t.menu } as object,
        av: { requirements: t.av } as object,
        setupNotes: t.setup,
        specialInstructions: t.notes,
        miscNotes: `${SYNTHETIC_TAG} dayOffset=${t.dayOffset}`,
        status: BEOStatus.CONFIRMED,
        sections: {
          create: [{
            name: "Main Service",
            functionType: "PLATED_DINNER",
            startTime: startsAt,
            endTime: endsAt,
            guests: t.guests,
            staffingNeeds: staffing as object,
          }],
        },
      },
    });

    // Derived Event + Shift in the matching weekly Schedule.
    const ws = startOfOperationalWeek(eventDate);
    const schedule = await prisma.schedule.findFirst({ where: { weekStart: ws } });
    if (schedule && room) {
      const ev = await prisma.event.create({
        data: {
          beoId: beo.id,
          roomId: room.id,
          name: t.postAs,
          startsAt,
          endsAt,
          guests: t.guests,
        },
      });
      const svrRole = await prisma.role.findUnique({ where: { code: "SVR" } });
      if (svrRole) {
        await prisma.shift.create({
          data: {
            scheduleId: schedule.id,
            eventId: ev.id,
            date: atTime(eventDate, "00:00"),
            // Pre-shift call: arrive 60 min early, off 30 min after end.
            startsAt: new Date(startsAt.getTime() - 60 * 60 * 1000),
            endsAt: new Date(endsAt.getTime() + 30 * 60 * 1000),
            locationCode: loc?.code ?? "",
            roomCode: t.roomCode ?? "",
            label: t.postAs,
            statusCode: ShiftStatusCode.NONE,
            requirements: {
              create: [{ roleId: svrRole.id, count: staffing[0].count }],
            },
          },
        });
      }
    }
    createdBeos++;
  }
  console.log(`  ✓ Created ${createdBeos} BEOs (hire-date sample: ${fmtMMDDYYYY(today)})`);

  // 6) Availability — wipe & regenerate for every active server.
  console.log("→ Generating availability windows for every active server…");
  await prisma.availability.deleteMany({});
  const servers = await prisma.server.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ employmentType: "asc" }, { hireDate: "asc" }],
  });
  let availabilityRows = 0;
  for (let i = 0; i < servers.length; i++) {
    // Full-time get the wide preset; part-time rotate through the narrower
    // presets so the dataset has realistic conflicts the scheduler must work
    // around (some servers literally can't cover certain shifts).
    const preset =
      servers[i].employmentType === "FULL_TIME"
        ? pick(AVAILABILITY_PRESETS.slice(0, 3), i)
        : pick(AVAILABILITY_PRESETS.slice(2), i);
    for (const dow of preset.days) {
      await prisma.availability.create({
        data: {
          serverId: servers[i].id,
          dayOfWeek: dow,
          startTime: preset.start,
          endTime: preset.end,
          preference: preset.preference,
        },
      });
      availabilityRows++;
    }
  }
  console.log(`  ✓ ${availabilityRows} availability rows for ${servers.length} servers`);

  // 7) Time-off requests — a small realistic mix.
  console.log("→ Generating synthetic time-off requests…");
  await prisma.timeOffRequest.deleteMany({});
  // Approved: 2 senior FT staff each get a 2-day window that overlaps one BEO
  // so we can verify the scheduler skips them.
  // Pending:  3 PT staff request future days off.
  const ftSeniors = servers.filter((s) => s.employmentType === "FULL_TIME").slice(0, 2);
  const ptStaff = servers.filter((s) => s.employmentType === "PART_TIME").slice(0, 3);
  let timeOffRows = 0;
  for (let i = 0; i < ftSeniors.length; i++) {
    const start = addDays(today, 2 + i * 2);
    const end = addDays(start, 1);
    await prisma.timeOffRequest.create({
      data: {
        serverId: ftSeniors[i].id,
        startDate: atTime(start, "00:00"),
        endDate: atTime(end, "23:59"),
        reason: i === 0 ? "Pre-approved vacation" : "Family event",
        status: TimeOffStatus.APPROVED,
        reviewedBy: "manager@tng.usc.edu",
        reviewedAt: today,
      },
    });
    timeOffRows++;
  }
  for (let i = 0; i < ptStaff.length; i++) {
    const start = addDays(today, 5 + i * 3);
    const end = addDays(start, 1);
    await prisma.timeOffRequest.create({
      data: {
        serverId: ptStaff[i].id,
        startDate: atTime(start, "00:00"),
        endDate: atTime(end, "23:59"),
        reason: ["Doctor's appointment", "Personal day", "Out of town"][i % 3],
        status: TimeOffStatus.PENDING,
      },
    });
    timeOffRows++;
  }
  console.log(`  ✓ ${timeOffRows} time-off requests (2 approved, 3 pending)`);

  console.log("\n✓ Synthetic test-data seed complete.");
  console.log(`  • 12 BEOs across the next 14 days (tagged ${SYNTHETIC_TAG})`);
  console.log(`  • All ${servers.length} servers normalised to Banquet Server`);
  console.log(`  • Hire dates display in MM/DD/YYYY (e.g., ${fmtMMDDYYYY(servers[0].hireDate)})`);
  console.log("  Run the board to verify, then trigger auto-schedule on the current week.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
