/**
 * Database seed for USC Private Events & Conferences.
 *
 * v0.4.0 — real operational dataset:
 *   • 16 real USC venues across 4 venue groups (UPC, HSC, U Club, USC Hotel)
 *   • 6 named department managers (User records with role=MANAGER)
 *   • 32 real banquet employees (19 full-time, 13 part-time) with actual
 *     hire dates, classifications, and Presidential-Server honorifics.
 *   • Operational Thu→Wed week (see src/lib/week-config.ts)
 *
 * This script is idempotent for master data + users + servers (upserts keyed
 * on stable codes / emails / employeeIds). The sample BEO/Shifts block uses
 * `findFirst` guards so re-running won't duplicate it.
 *
 * Run with:
 *   npm run db:seed
 * For a clean slate:
 *   npx prisma db push --force-reset --accept-data-loss && npm run db:seed
 */

import {
  PrismaClient,
  ScheduleStatus,
  BEOStatus,
  ShiftStatusCode,
  JobClassification,
  EmploymentStatus,
  EmploymentType,
  UserRole,
  DayOfWeek,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { importMasterData } from "../src/lib/import/master-data-importer";
import { VENUE_IMAGES } from "../src/lib/venue-images";
import { startOfOperationalWeek } from "../src/lib/week-config";

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

// ─── Real USC manager + employee data ──────────────────────────────────────
//
// Managers are department-level supervisors recorded as User records with
// role=MANAGER. As of Phase 7.1 their `homeVenues` are persisted on
// `User.homeVenueCodes` so a future ManagerScopeFilter can scope dashboards
// to "BEOs in my venues".
//
const MANAGERS: ReadonlyArray<{
  email: string;
  name: string;
  title: string;
  homeVenues: string[];
}> = [
  { email: "juanita.gomez@usc.edu", name: "Juanita Gomez", title: "Senior Manager", homeVenues: ["UCLUB", "SCRIPTORIUM"] },
  { email: "leticia.velasquez@usc.edu", name: "Leticia Velasquez", title: "Manager", homeVenues: ["HSC-CC"] },
  { email: "eddie.cuevas@usc.edu", name: "Eddie Cuevas", title: "Manager", homeVenues: ["TNG"] },
  { email: "levi.flefil@usc.edu", name: "Levi Flefil", title: "Manager", homeVenues: ["TNG"] },
  { email: "jovon.oconnor@usc.edu", name: "Jovon O'Connor", title: "Manager", homeVenues: ["HOTEL-MR", "HOTEL-GBR", "HOTEL-GARDEN", "HOTEL-1880", "MCKAYS", "THE-LAB", "EDMONDSON"] },
  { email: "alonso.recinos@usc.edu", name: "Alonso Recinos", title: "Manager", homeVenues: ["MORETON", "VINEYARD", "UCLUB"] },
];

// Full-time employees (19) — ordered by seniority (oldest hire first).
// Presidential Server honorific is captured in `notes` and reflected in
// classification by promoting them to BANQUET_CAPTAIN.
type SeedServer = {
  firstName: string;
  lastName: string;
  hireDate: string; // YYYY-MM-DD
  employmentType: EmploymentType;
  classification: JobClassification;
  notes?: string;
};

const FULL_TIME: SeedServer[] = [
  { firstName: "Mario",     lastName: "Estrada",    hireDate: "1995-08-28", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.LEAD_BANQUET_CAPTAIN, notes: "Most senior full-time employee" },
  { firstName: "Alejandro", lastName: "Castro",     hireDate: "1996-02-06", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_CAPTAIN,      notes: "Presidential Server #2" },
  { firstName: "Mel",       lastName: "Garay",      hireDate: "1996-02-20", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_CAPTAIN,      notes: "Presidential Server #1" },
  { firstName: "Leticia",   lastName: "Reyes",      hireDate: "1996-02-20", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Pedro",     lastName: "Lopez",      hireDate: "2000-08-16", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Edgar",     lastName: "Vargas",     hireDate: "2000-09-23", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_CAPTAIN,      notes: "Presidential Server #6" },
  { firstName: "Axel",      lastName: "Hernandez",  hireDate: "2002-07-22", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_CAPTAIN,      notes: "Presidential Server #7" },
  { firstName: "Ana",       lastName: "Bonilla",    hireDate: "2004-04-23", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Rick",      lastName: "Sanchez",    hireDate: "2004-10-06", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Martin",    lastName: "Martinez",   hireDate: "2004-12-05", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Anabel",    lastName: "Vargas",     hireDate: "2006-01-31", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_CAPTAIN,      notes: "Presidential Server #5" },
  { firstName: "Chirelita", lastName: "Yuan",       hireDate: "2010-11-30", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Ana",       lastName: "Canchola",   hireDate: "2011-11-21", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_CAPTAIN,      notes: "Presidential Server #4" },
  { firstName: "Antonio",   lastName: "Padilla",    hireDate: "2012-02-06", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Susy",      lastName: "Arias",      hireDate: "2013-10-09", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BARTENDER,            notes: "Bartender" },
  { firstName: "Erika",     lastName: "Pineda",     hireDate: "2014-03-19", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Obadiah",   lastName: "Cabral",     hireDate: "2016-12-05", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_CAPTAIN,      notes: "Presidential Server #3" },
  { firstName: "Emily",     lastName: "Dominguez",  hireDate: "2022-10-24", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Araceli",   lastName: "Hernandez",  hireDate: "2025-07-28", employmentType: EmploymentType.FULL_TIME, classification: JobClassification.BANQUET_SERVER },
];

// Part-time employees (13) — ordered by seniority within the PT pool.
const PART_TIME: SeedServer[] = [
  { firstName: "Oscar",    lastName: "Mejia",          hireDate: "2010-11-21", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Olivia",   lastName: "Cruz",           hireDate: "2012-01-26", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Raul",     lastName: "Salgado",        hireDate: "2017-01-08", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Rodrigo",  lastName: "Garcia",         hireDate: "2017-02-27", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Natalie",  lastName: "Blandino",       hireDate: "2017-05-22", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Katya",    lastName: "Loedino",        hireDate: "2017-05-22", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Luis",     lastName: "Sanchez Mendez", hireDate: "2017-05-29", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Milton",   lastName: "Castro",         hireDate: "2019-02-11", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Jefferson",lastName: "Hoff",           hireDate: "2019-02-11", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Jose",     lastName: "Alvarado",       hireDate: "2019-02-25", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Dawn",     lastName: "Cardenas",       hireDate: "2022-12-12", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Willy",    lastName: "Contreras",      hireDate: "2023-01-09", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
  { firstName: "Alejandro",lastName: "Cruz",           hireDate: "2025-07-28", employmentType: EmploymentType.PART_TIME, classification: JobClassification.BANQUET_SERVER },
];

const ALL_SERVERS: SeedServer[] = [...FULL_TIME, ...PART_TIME];

function employeeIdFor(s: SeedServer, idx: number): string {
  // Stable, derived from hire-year + zero-padded index so re-seeding lines up.
  const yr = s.hireDate.slice(0, 4);
  return `USC-${yr}-${String(idx + 1).padStart(3, "0")}`;
}

function emailFor(s: SeedServer): string {
  const cleanLast = s.lastName.toLowerCase().replace(/\s+/g, "");
  return `${s.firstName.toLowerCase()}.${cleanLast}@usc.edu`;
}

// ─── Master-data load ──────────────────────────────────────────────────────

function loadMasterData(): unknown {
  const p = path.join(__dirname, "..", "data", "banquet_master_data.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date();
  const weekStart = startOfOperationalWeek(today);

  // Phase 15 \u2014 Step 0: keep the DB clean for AI-scheduling testing. Wipe
  // every prior ShiftAssignment and unset every BEO.managerId so a re-seed
  // always produces an empty roster the auto-scheduler / click-to-add UI
  // can fill from scratch. Schedules / Shifts / requirements are preserved
  // so existing operational weeks stay navigable.
  console.log("\u2192 Phase 15 cleanup: removing stale assignments + BEO manager pre-picks\u2026");
  const deletedAssignments = await prisma.shiftAssignment.deleteMany({});
  const clearedManagers = await prisma.bEO.updateMany({
    where: { managerId: { not: null } },
    data: { managerId: null },
  });
  console.log(
    `  \u2713 Cleared ${deletedAssignments.count} ShiftAssignment rows; unset manager on ${clearedManagers.count} BEOs`,
  );

  console.log("\u2192 Importing master data (venue groups, locations, rooms, event spaces)\u2026");
  const raw = loadMasterData();
  const importResult = await importMasterData(raw);
  if (!importResult.ok) {
    console.error("✗ Master-data import failed:", importResult.errors);
    throw new Error("Master-data import failed");
  }
  console.log(`  ✓ ${importResult.counts.venueGroups} venue groups, ${importResult.counts.locations} locations, ${importResult.counts.rooms} rooms, ${importResult.counts.eventSpaces} event spaces`);

  // Record a MasterDataVersion row so the field is actually used and the
  // admin UI can show "current data version" after a fresh seed. We pick
  // the next monotonically-increasing versionNum so re-seeding doesn't
  // collide with the unique constraint.
  const lastVersion = await prisma.masterDataVersion.findFirst({ orderBy: { versionNum: "desc" } });
  const nextVersionNum = (lastVersion?.versionNum ?? 0) + 1;
  await prisma.masterDataVersion.create({
    data: {
      versionNum: nextVersionNum,
      payload: raw as object,
      importedBy: null,
      note: `Seed import — ${importResult.counts.venueGroups} venue groups / ${importResult.counts.rooms} rooms`,
    },
  });
  console.log(`  ✓ Recorded MasterDataVersion #${nextVersionNum}`);

  // 1) Stamp imagePath on every room that has a known image.
  console.log("→ Setting venue images on rooms…");
  let imageCount = 0;
  for (const [code, imagePath] of Object.entries(VENUE_IMAGES)) {
    const room = await prisma.room.findFirst({ where: { code } });
    if (room) {
      await prisma.room.update({ where: { id: room.id }, data: { imagePath } });
      imageCount++;
    } else {
      console.warn(`  ! No room with code "${code}" — image skipped`);
    }
  }
  console.log(`  ✓ ${imageCount}/${Object.keys(VENUE_IMAGES).length} venue images linked`);

  // 2) Roles & qualifications from the master data file (idempotent via code).
  const md = raw as { roles: Array<{ code: string; name: string; color?: string; qualifications?: string[] }>;
                      qualifications: Array<{ code: string; name: string }>; };
  console.log("→ Upserting roles & qualifications…");
  for (const r of md.roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      create: { code: r.code, name: r.name, color: r.color ?? null },
      update: { name: r.name, color: r.color ?? null },
    });
  }
  for (const q of md.qualifications) {
    await prisma.qualification.upsert({
      where: { code: q.code },
      create: { code: q.code, name: q.name },
      update: { name: q.name },
    });
  }

  // 2a) Role ↔ qualification links (idempotent). The scheduling engine consults
  // `Role.qualificationsRequired` to filter eligible servers; without this
  // link any qualification rules in master data are silently ignored.
  for (const r of md.roles) {
    if (!r.qualifications?.length) continue;
    const role = await prisma.role.findUnique({ where: { code: r.code } });
    if (!role) continue;
    for (const qCode of r.qualifications) {
      const q = await prisma.qualification.findUnique({ where: { code: qCode } });
      if (!q) continue;
      await prisma.roleQualification.upsert({
        where: { roleId_qualificationId: { roleId: role.id, qualificationId: q.id } },
        create: { roleId: role.id, qualificationId: q.id },
        update: {},
      });
    }
  }

  // 3) Admin / manager / supervisor accounts + named department managers.
  console.log("→ Upserting Users (admin, system roles, named managers)…");
  const password = await bcrypt.hash("password123", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@tng.usc.edu" },
    create: { email: "admin@tng.usc.edu", name: "USC PEC Admin", passwordHash: password, role: UserRole.ADMIN },
    update: { name: "USC PEC Admin", role: UserRole.ADMIN, active: true },
  });
  await prisma.user.upsert({
    where: { email: "manager@tng.usc.edu" },
    create: { email: "manager@tng.usc.edu", name: "Demo Manager", passwordHash: password, role: UserRole.MANAGER },
    update: { name: "Demo Manager", role: UserRole.MANAGER, active: true },
  });
  // Phase 11: demo SERVER account. Replaces the previous SUPERVISOR demo —
  // SUPERVISOR/EMPLOYEE were collapsed into SERVER. We still upsert the
  // legacy supervisor@ email so any historical bookmarks redirect to a
  // SERVER-role login instead of a broken role.
  await prisma.user.upsert({
    where: { email: "server@tng.usc.edu" },
    create: { email: "server@tng.usc.edu", name: "Demo Server", passwordHash: password, role: UserRole.SERVER },
    update: { name: "Demo Server", role: UserRole.SERVER, active: true },
  });
  await prisma.user.upsert({
    where: { email: "supervisor@tng.usc.edu" },
    create: { email: "supervisor@tng.usc.edu", name: "Demo Server (legacy supervisor)", passwordHash: password, role: UserRole.SERVER },
    update: { name: "Demo Server (legacy supervisor)", role: UserRole.SERVER, active: true },
  });
  for (const mgr of MANAGERS) {
    await prisma.user.upsert({
      where: { email: mgr.email },
      create: {
        email: mgr.email,
        name: mgr.name,
        passwordHash: password,
        role: UserRole.MANAGER,
        homeVenueCodes: mgr.homeVenues,
      },
      update: {
        name: mgr.name,
        role: UserRole.MANAGER,
        active: true,
        homeVenueCodes: mgr.homeVenues,
      },
    });
  }
  console.log(`  ✓ 3 system users + ${MANAGERS.length} named managers`);

  // 4) Servers — real 32-employee roster.
  //
  // Phase 11 normalisation: ALL banquet staff are stored with
  // `classification = BANQUET_SERVER`. The previous breakdown
  // (LEAD_BANQUET_CAPTAIN / BANQUET_CAPTAIN / BARTENDER / …) is preserved
  // verbatim in `Server.notes` so we don't lose context, but the
  // operational classification surfaced everywhere is just "Banquet
  // Server". The JobClassification enum still has the other values for
  // future use but the seed + UI deliberately don't reference them.
  console.log("→ Upserting Servers (32 real employees, normalised to BANQUET_SERVER)…");
  const createdServers = [] as Array<{ id: string; hireDate: Date; firstName: string; lastName: string }>;
  for (let i = 0; i < ALL_SERVERS.length; i++) {
    const s = ALL_SERVERS[i];
    const employeeId = employeeIdFor(s, i);
    const hireDate = new Date(s.hireDate + "T00:00:00Z");
    const email = emailFor(s);

    // Parse Presidential-Server honorific out of the free-text `notes` field
    // into a structured rank column so the roster can sort on it without
    // string-parsing every render.
    const presMatch = s.notes?.match(/Presidential Server #(\d+)/i);
    const presidentialRank = presMatch ? Number(presMatch[1]) : null;

    // Phase 11: preserve the legacy classification label in `notes` so
    // managers still see "was Captain" context, but force the canonical
    // classification to BANQUET_SERVER everywhere.
    const originalRoleLabel = s.classification
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const noteParts: string[] = [];
    if (s.notes) noteParts.push(s.notes);
    if (s.classification !== JobClassification.BANQUET_SERVER) {
      noteParts.push(`Original classification: ${originalRoleLabel}`);
    }
    const mergedNotes = noteParts.length ? noteParts.join(" \u2014 ") : null;

    const server = await prisma.server.upsert({
      where: { employeeId },
      create: {
        employeeId,
        firstName: s.firstName,
        lastName: s.lastName,
        email,
        hireDate,
        classification: JobClassification.BANQUET_SERVER,
        employmentType: s.employmentType,
        status: EmploymentStatus.ACTIVE,
        notes: mergedNotes,
        presidentialRank,
      },
      update: {
        firstName: s.firstName,
        lastName: s.lastName,
        email,
        hireDate,
        classification: JobClassification.BANQUET_SERVER,
        employmentType: s.employmentType,
        status: EmploymentStatus.ACTIVE,
        notes: mergedNotes,
        presidentialRank,
      },
    });

    // Phase 11: every Server gets a linked User with role=SERVER so they
    // can sign in and see their own schedule/availability. Email matches
    // the Server's `email` field so password-reset paths line up later.
    // We guard against collision with the named-manager emails (none
    // overlap with the roster as of Phase 11, but the guard is cheap).
    const existingMgrUser = await prisma.user.findUnique({ where: { email } });
    if (existingMgrUser && existingMgrUser.role !== UserRole.SERVER) {
      // A manager already owns this email — don't overwrite their role.
      // Just link the Server to that existing User so logins still work.
      await prisma.server.update({
        where: { id: server.id },
        data: { userId: existingMgrUser.id },
      });
    } else {
      const serverUser = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name: `${s.firstName} ${s.lastName}`,
          passwordHash: password,
          role: UserRole.SERVER,
        },
        update: {
          name: `${s.firstName} ${s.lastName}`,
          role: UserRole.SERVER,
          active: true,
        },
      });
      await prisma.server.update({
        where: { id: server.id },
        data: { userId: serverUser.id },
      });
    }
    createdServers.push({ id: server.id, hireDate, firstName: s.firstName, lastName: s.lastName });
  }
  console.log(`  ✓ ${createdServers.length} servers (${FULL_TIME.length} FT, ${PART_TIME.length} PT)`);

  // 4a) Realistic Availability matrix + ServerQualification rows.
  //
  // Phase 15 — replaces the prior "every server available 06:00–23:59 on all
  // 7 days" stub. We now seed varied windows per server so the auto-scheduler
  // has to actually pick from a constrained pool. Patterns are deterministic
  // (mod-rotated by roster index) so re-running the seed is reproducible:
  //
  //   pattern 0 — morning/lunch crew         Mon-Fri 06:00–15:00
  //   pattern 1 — afternoon/evening crew     Tue-Sat 14:00–23:30
  //   pattern 2 — weekend warriors           Thu-Sun (all-day)
  //   pattern 3 — split availability         Mon/Wed/Fri 09:00–14:00,
  //                                          Sat-Sun 16:00–23:30
  //   pattern 4 — full open                  All 7 days 06:00–23:30
  //   pattern 5 — evenings only              Wed-Sun 17:00–23:30
  //
  // The scheduling engine requires the shift window to fall ENTIRELY inside
  // an availability window for a candidate to be considered, so giving every
  // server a different mix is what lets fairness/seniority actually matter.
  console.log("→ Seeding realistic availability matrix + qualifications…");
  const rbs = await prisma.qualification.findUnique({ where: { code: "RBS" } });
  const foodHandler = await prisma.qualification.findUnique({ where: { code: "FOOD_HANDLER" } });

  type AvailWindow = { dow: DayOfWeek; start: string; end: string };
  const PATTERNS: AvailWindow[][] = [
    // 0 — morning / lunch crew (Mon–Fri)
    [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI].map(
      (dow) => ({ dow, start: "06:00", end: "15:00" }),
    ),
    // 1 — afternoon / evening crew (Tue–Sat)
    [DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI, DayOfWeek.SAT].map(
      (dow) => ({ dow, start: "14:00", end: "23:30" }),
    ),
    // 2 — weekend warriors (Thu–Sun, full days)
    [DayOfWeek.THU, DayOfWeek.FRI, DayOfWeek.SAT, DayOfWeek.SUN].map((dow) => ({
      dow,
      start: "08:00",
      end: "23:30",
    })),
    // 3 — split availability
    [
      { dow: DayOfWeek.MON, start: "09:00", end: "14:00" },
      { dow: DayOfWeek.WED, start: "09:00", end: "14:00" },
      { dow: DayOfWeek.FRI, start: "09:00", end: "14:00" },
      { dow: DayOfWeek.SAT, start: "16:00", end: "23:30" },
      { dow: DayOfWeek.SUN, start: "16:00", end: "23:30" },
    ],
    // 4 — full open (“whatever you need”)
    [
      DayOfWeek.SUN,
      DayOfWeek.MON,
      DayOfWeek.TUE,
      DayOfWeek.WED,
      DayOfWeek.THU,
      DayOfWeek.FRI,
      DayOfWeek.SAT,
    ].map((dow) => ({ dow, start: "06:00", end: "23:30" })),
    // 5 — evenings only (Wed–Sun)
    [DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI, DayOfWeek.SAT, DayOfWeek.SUN].map(
      (dow) => ({ dow, start: "17:00", end: "23:30" }),
    ),
  ];
  const PATTERN_LABELS = [
    "Mon–Fri mornings (06:00–15:00)",
    "Tue–Sat afternoons (14:00–23:30)",
    "Thu–Sun weekends (08:00–23:30)",
    "Split: MWF lunch + Sat–Sun evenings",
    "Full open (all days, 06:00–23:30)",
    "Wed–Sun evenings (17:00–23:30)",
  ];

  // Wipe any prior availability rows so the matrix is a clean reseed.
  await prisma.availability.deleteMany({
    where: { serverId: { in: createdServers.map((r) => r.id) } },
  });

  let availCount = 0;
  let qualCount = 0;
  for (let idx = 0; idx < createdServers.length; idx++) {
    const r = createdServers[idx];
    const patternIdx = idx % PATTERNS.length;
    const pattern = PATTERNS[patternIdx];
    const label = PATTERN_LABELS[patternIdx];
    for (const w of pattern) {
      await prisma.availability.create({
        data: {
          serverId: r.id,
          dayOfWeek: w.dow,
          startTime: w.start,
          endTime: w.end,
          preference: 0,
          notes: `Seeded pattern ${patternIdx}: ${label}`,
        },
      });
      availCount++;
    }
    for (const q of [rbs, foodHandler].filter(Boolean) as { id: string }[]) {
      await prisma.serverQualification.upsert({
        where: { serverId_qualificationId: { serverId: r.id, qualificationId: q.id } },
        create: { serverId: r.id, qualificationId: q.id, obtainedDate: r.hireDate },
        update: {},
      });
      qualCount++;
    }
  }
  console.log(`  ✓ ${availCount} availability rows (6 patterns) + ${qualCount} qualification links`);

  // 5) Seniority records — derived from hireDate, ranked across the whole roster.
  console.log("→ Computing seniority records…");
  const rosterByTenure = [...createdServers].sort((a, b) => a.hireDate.getTime() - b.hireDate.getTime());
  for (let rank = 0; rank < rosterByTenure.length; rank++) {
    const r = rosterByTenure[rank];
    const years = yearsBetween(r.hireDate, today);
    await prisma.seniorityRecord.upsert({
      where: { serverId: r.id },
      create: {
        serverId: r.id,
        yearsOfService: years,
        seniorityScore: years, // weightYears=1.0 by default
        seniorityRank: rank + 1,
      },
      update: {
        yearsOfService: years,
        seniorityScore: years,
        seniorityRank: rank + 1,
      },
    });
  }
  console.log(`  ✓ Seniority ranked 1..${rosterByTenure.length}`);

  // 6) Current operational week — sample schedule + BEO at Town & Gown.
  console.log("→ Creating current-week schedule + sample BEO…");
  const weekEnd = addDays(weekStart, 6);

  const existingSchedule = await prisma.schedule.findFirst({ where: { weekStart } });
  const schedule =
    existingSchedule ??
    (await prisma.schedule.create({
      data: {
        name: `Week of ${weekStart.toISOString().slice(0, 10)}`,
        weekStart,
        weekEnd,
        status: ScheduleStatus.DRAFT,
        notes: "Current operational week (seeded)",
        revisionDate: today,
        createdBy: adminUser.id,
      },
    }));

  const upcLocation = await prisma.location.findUnique({ where: { code: "UPC-MAIN" } });
  const tngRoom = upcLocation
    ? await prisma.room.findFirst({ where: { locationId: upcLocation.id, code: "TNG" } })
    : null;

  const capRole = await prisma.role.findUnique({ where: { code: "CAP" } });
  const svrRole = await prisma.role.findUnique({ where: { code: "SVR" } });
  const barRole = await prisma.role.findUnique({ where: { code: "BAR" } });

  if (upcLocation && tngRoom) {
    const eventDate = addDays(weekStart, 3); // Sunday of the Thu→Wed week
    const bookingId = `BK-${eventDate.getFullYear()}-1042`;
    const existingBEO = await prisma.bEO.findUnique({ where: { bookingId } });
    const beo =
      existingBEO ??
      (await prisma.bEO.create({
        data: {
          bookingId,
          beoNumber: "10042",
          postAs: "Trustees Donor Reception & Dinner",
          account: "USC Office of the President",
          billingMethod: "Internal Transfer",
          contactName: "Eddie Cuevas",
          contactPhone: "213-555-0142",
          contactEmail: "eddie.cuevas@usc.edu",
          cateringManager: "Eddie Cuevas",
          locationId: upcLocation.id,
          eventDate,
          startTime: atTime(eventDate, "17:30"),
          endTime: atTime(eventDate, "22:30"),
          expectedGuests: 220,
          menu: {
            reception: ["Passed hors d'oeuvres", "Cheese & charcuterie display"],
            plated: ["Caesar salad", "Filet & sea bass duet", "Chocolate trio"],
            bar: ["Premium open bar"],
          },
          setupNotes: "Banquet rounds of 10, head table for 12, 3 bars",
          status: BEOStatus.CONFIRMED,
          revisionDate: today,
        },
      }));

    const reception =
      (await prisma.event.findFirst({ where: { beoId: beo.id, name: "Reception" } })) ??
      (await prisma.event.create({
        data: {
          beoId: beo.id,
          roomId: tngRoom.id,
          name: "Reception",
          startsAt: atTime(eventDate, "17:30"),
          endsAt: atTime(eventDate, "18:30"),
          guests: 220,
        },
      }));
    const dinner =
      (await prisma.event.findFirst({ where: { beoId: beo.id, name: "Plated Dinner" } })) ??
      (await prisma.event.create({
        data: {
          beoId: beo.id,
          roomId: tngRoom.id,
          name: "Plated Dinner",
          startsAt: atTime(eventDate, "18:30"),
          endsAt: atTime(eventDate, "22:30"),
          guests: 220,
        },
      }));

    const existingShifts = await prisma.shift.count({ where: { scheduleId: schedule.id } });
    if (existingShifts === 0) {
      await prisma.shift.create({
        data: {
          scheduleId: schedule.id,
          eventId: reception.id,
          date: atTime(eventDate, "00:00"),
          startsAt: atTime(eventDate, "16:30"),
          endsAt: atTime(eventDate, "19:00"),
          locationCode: "UPC-MAIN",
          roomCode: "TNG",
          label: "Trustees Reception",
          statusCode: ShiftStatusCode.NONE,
          requirements: {
            create: [
              ...(capRole ? [{ roleId: capRole.id, count: 1 }] : []),
              ...(svrRole ? [{ roleId: svrRole.id, count: 6 }] : []),
              ...(barRole ? [{ roleId: barRole.id, count: 3 }] : []),
            ],
          },
        },
      });
      const dinnerShift = await prisma.shift.create({
        data: {
          scheduleId: schedule.id,
          eventId: dinner.id,
          date: atTime(eventDate, "00:00"),
          startsAt: atTime(eventDate, "17:30"),
          endsAt: atTime(eventDate, "22:30"),
          locationCode: "UPC-MAIN",
          roomCode: "TNG",
          label: "Trustees Plated Dinner",
          statusCode: ShiftStatusCode.NONE,
          requirements: {
            create: [
              ...(capRole ? [{ roleId: capRole.id, count: 2 }] : []),
              ...(svrRole ? [{ roleId: svrRole.id, count: 14 }] : []),
              ...(barRole ? [{ roleId: barRole.id, count: 3 }] : []),
            ],
          },
        },
      });

      // Phase 15 — seed leaves every BEO unassigned so AI scheduling / Fill
      // Unassigned has real work to do on a fresh DB. No pre-assigned
      // captain or manager here.
    }
  } else {
    console.warn("  ! UPC-MAIN/TNG room not found — skipping sample BEO");
  }

  // 7) Adjacent weeks so the WeekNavigator has neighbours to link to.
  console.log("→ Creating adjacent operational weeks (prev + next)…");
  const prevWeekStart = addDays(weekStart, -7);
  if (!(await prisma.schedule.findFirst({ where: { weekStart: prevWeekStart } }))) {
    await prisma.schedule.create({
      data: {
        name: `Week of ${prevWeekStart.toISOString().slice(0, 10)}`,
        weekStart: prevWeekStart,
        weekEnd: addDays(prevWeekStart, 6),
        status: ScheduleStatus.PUBLISHED,
        notes: "Prior operational week (seeded)",
        revisionDate: today,
        createdBy: adminUser.id,
      },
    });
  }
  const nextWeekStart = addDays(weekStart, 7);
  if (!(await prisma.schedule.findFirst({ where: { weekStart: nextWeekStart } }))) {
    await prisma.schedule.create({
      data: {
        name: `Week of ${nextWeekStart.toISOString().slice(0, 10)}`,
        weekStart: nextWeekStart,
        weekEnd: addDays(nextWeekStart, 6),
        status: ScheduleStatus.DRAFT,
        notes: "Next operational week (seeded)",
        revisionDate: today,
        createdBy: adminUser.id,
      },
    });
  }

  // 8) Phase 11: 10 additional realistic BEOs spread across ±4 operational
  //    weeks so the platform feels populated for QA. Idempotent via
  //    `bookingId` so re-seeds don't duplicate. Each entry chooses a real
  //    USC venue + room from the master data and a named manager whose
  //    `homeVenueCodes` covers that venue.
  console.log("→ Seeding 10 realistic BEOs across operational weeks…");
  await seedExtraBeos(weekStart, adminUser.id);

  // 9) Phase 13: a handful of time-off requests so /time-off has data for the
  //    approve/deny workflow demo. Idempotent: we no-op if any rows exist.
  const existingTimeOff = await prisma.timeOffRequest.count();
  if (existingTimeOff === 0 && createdServers.length >= 6) {
    console.log("→ Seeding sample time-off requests…");
    const pickedServers = createdServers.slice(0, 6);
    const samples = [
      { server: pickedServers[0], offset: 5, length: 2, reason: "Family wedding", status: "PENDING" as const },
      { server: pickedServers[1], offset: 9, length: 1, reason: "Medical appointment", status: "PENDING" as const },
      { server: pickedServers[2], offset: 12, length: 4, reason: "Vacation", status: "PENDING" as const },
      { server: pickedServers[3], offset: -3, length: 1, reason: "Personal day", status: "APPROVED" as const },
      { server: pickedServers[4], offset: 16, length: 2, reason: "Funeral", status: "APPROVED" as const },
      { server: pickedServers[5], offset: 22, length: 3, reason: "Conference", status: "DENIED" as const },
    ];
    for (const s of samples) {
      const start = addDays(weekStart, s.offset);
      const end = addDays(start, s.length - 1);
      await prisma.timeOffRequest.create({
        data: {
          serverId: s.server.id,
          startDate: start,
          endDate: end,
          reason: s.reason,
          status: s.status,
          reviewedBy: s.status === "PENDING" ? null : adminUser.id,
          reviewedAt: s.status === "PENDING" ? null : new Date(),
        },
      });
    }
    console.log(`  ✓ ${samples.length} time-off requests (3 pending, 2 approved, 1 denied)`);
  }

  console.log("✓ Seed complete.");
  console.log("  Login: admin@tng.usc.edu / password123     (ADMIN)");
  console.log("  Login: manager@tng.usc.edu / password123   (MANAGER)");
  console.log("  Login: server@tng.usc.edu / password123    (SERVER — view-only)");
  console.log("  Named manager logins: <firstname>.<lastname>@usc.edu / password123 (MANAGER)");
  console.log("  Server logins:        <firstname>.<lastname>@usc.edu / password123 (SERVER)");
}

// ---------------------------------------------------------------------------
// seedExtraBeos: idempotent 10-BEO sampler (Phase 11)
// ---------------------------------------------------------------------------
async function seedExtraBeos(weekStart: Date, adminUserId: string) {
  // Helper: pick a room by code, fall back to first room at the location.
  async function pickRoom(locationCode: string, roomCode?: string) {
    const loc = await prisma.location.findUnique({ where: { code: locationCode } });
    if (!loc) return null;
    const room = roomCode
      ? await prisma.room.findFirst({ where: { locationId: loc.id, code: roomCode } })
      : await prisma.room.findFirst({ where: { locationId: loc.id } });
    return room ? { location: loc, room } : { location: loc, room: null };
  }
  async function pickManagerByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }
  const today = new Date();

  type ExtraBeo = {
    bookingSuffix: string;
    postAs: string;
    account?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    onsiteContact?: string;
    cateringManagerEmail?: string;
    locationCode: string;
    roomCode?: string;
    daysFromWeekStart: number;   // negative or positive offset from current week's Thursday
    startHHMM: string;
    endHHMM: string;
    expectedGuests: number;
    menu: Record<string, string[]>;
    setupNotes?: string;
    specialInstructions?: string;
    status: BEOStatus;
    capCount: number;
    svrCount: number;
    barCount: number;
    eventName: string;
  };

  const EXTRA_BEOS: ExtraBeo[] = [
    // ---- This week (Thu→Wed) ----
    {
      bookingSuffix: "P11-001",
      postAs: "Engineering Dean's Welcome Reception",
      account: "Viterbi School of Engineering",
      contactName: "Juanita Gomez", contactPhone: "213-555-0181", contactEmail: "juanita.gomez@usc.edu",
      cateringManagerEmail: "juanita.gomez@usc.edu",
      locationCode: "UCLUB-MAIN", roomCode: "UCLUB",
      daysFromWeekStart: 1, startHHMM: "17:30", endHHMM: "20:30",
      expectedGuests: 140,
      menu: { reception: ["Heavy passed appetizers", "Charcuterie & cheese"], bar: ["Beer / wine bar"] },
      setupNotes: "Cocktail tables, lounge clusters, two service bars",
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 5, barCount: 2,
      eventName: "Reception",
    },
    {
      bookingSuffix: "P11-002",
      postAs: "Keck School Faculty Luncheon",
      account: "Keck School of Medicine",
      contactName: "Leticia Velasquez", contactPhone: "213-555-0162", contactEmail: "leticia.velasquez@usc.edu",
      cateringManagerEmail: "leticia.velasquez@usc.edu",
      locationCode: "HSC-MAIN", roomCode: "HSC-CC",
      daysFromWeekStart: 4, startHHMM: "12:00", endHHMM: "14:00",
      expectedGuests: 90,
      menu: { plated: ["Mixed greens salad", "Salmon entrée", "Lemon tart"], bar: ["Non-alcoholic"] },
      setupNotes: "Banquet rounds of 8, head table for 6",
      specialInstructions: "Vegetarian count: 22 (confirmed)",
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 6, barCount: 0,
      eventName: "Plated Luncheon",
    },
    // ---- Next week ----
    {
      bookingSuffix: "P11-003",
      postAs: "Athletics Donor Tailgate",
      account: "USC Athletics",
      contactName: "Eddie Cuevas", contactPhone: "213-555-0143", contactEmail: "eddie.cuevas@usc.edu",
      cateringManagerEmail: "eddie.cuevas@usc.edu",
      locationCode: "UPC-MAIN", roomCode: "TNG",
      daysFromWeekStart: 8, startHHMM: "15:00", endHHMM: "19:00",
      expectedGuests: 320,
      menu: { stations: ["BBQ station", "Carving station", "Slider bar"], bar: ["Full premium bar"] },
      setupNotes: "Buffet stations × 4, 6 cocktail bars, lounge furniture",
      status: BEOStatus.CONFIRMED, capCount: 2, svrCount: 18, barCount: 6,
      eventName: "Tailgate Reception",
    },
    {
      bookingSuffix: "P11-004",
      postAs: "Marshall MBA Welcome Dinner",
      account: "Marshall School of Business",
      contactName: "Levi Flefil", contactPhone: "213-555-0144", contactEmail: "levi.flefil@usc.edu",
      cateringManagerEmail: "levi.flefil@usc.edu",
      locationCode: "UPC-MAIN", roomCode: "TNG",
      daysFromWeekStart: 11, startHHMM: "18:00", endHHMM: "22:00",
      expectedGuests: 180,
      menu: { plated: ["Burrata", "Filet & risotto", "Tiramisu"], bar: ["House open bar"] },
      setupNotes: "Rounds of 10, ambient uplighting, AV podium",
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 12, barCount: 3,
      eventName: "Plated Dinner",
    },
    {
      bookingSuffix: "P11-005",
      postAs: "USC Hotel Boardroom Breakfast",
      account: "Office of the Provost",
      contactName: "Jovon O'Connor", contactPhone: "213-555-0177", contactEmail: "jovon.oconnor@usc.edu",
      cateringManagerEmail: "jovon.oconnor@usc.edu",
      locationCode: "USCH-MAIN", roomCode: "HOTEL-1880",
      daysFromWeekStart: 9, startHHMM: "07:30", endHHMM: "09:30",
      expectedGuests: 24,
      menu: { breakfast: ["Continental + hot buffet"], beverage: ["Coffee / tea / juice"] },
      setupNotes: "Single U-shape, projector + microphones",
      status: BEOStatus.TENTATIVE, capCount: 1, svrCount: 2, barCount: 0,
      eventName: "Boardroom Breakfast",
    },
    // ---- Two weeks out ----
    {
      bookingSuffix: "P11-006",
      postAs: "Vineyard Wedding Reception (Alvarez/Patel)",
      account: "Private — Alvarez/Patel",
      contactName: "Alonso Recinos", contactPhone: "213-555-0199", contactEmail: "alonso.recinos@usc.edu",
      cateringManagerEmail: "alonso.recinos@usc.edu",
      locationCode: "UPC-MAIN", roomCode: "VINEYARD",
      daysFromWeekStart: 16, startHHMM: "17:00", endHHMM: "23:30",
      expectedGuests: 210,
      menu: { reception: ["Cocktail hour passed apps"], plated: ["Salad", "Choice of beef / fish / veg", "Wedding cake"], bar: ["Premium open bar"] },
      setupNotes: "Sweetheart table + 21 rounds of 10, dance floor 30×30",
      specialInstructions: "Allergen list provided — see special-meals tab",
      status: BEOStatus.CONFIRMED, capCount: 2, svrCount: 14, barCount: 4,
      eventName: "Wedding Reception",
    },
    {
      bookingSuffix: "P11-007",
      postAs: "Annenberg Alumni Mixer",
      account: "Annenberg School for Communication",
      contactName: "Juanita Gomez", contactPhone: "213-555-0181", contactEmail: "juanita.gomez@usc.edu",
      cateringManagerEmail: "juanita.gomez@usc.edu",
      locationCode: "UCLUB-MAIN", roomCode: "SCRIPTORIUM",
      daysFromWeekStart: 15, startHHMM: "18:30", endHHMM: "21:30",
      expectedGuests: 95,
      menu: { reception: ["Light passed apps", "Antipasto board"], bar: ["Beer / wine / signature cocktail"] },
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 4, barCount: 2,
      eventName: "Alumni Mixer",
    },
    // ---- Last week (history) ----
    {
      bookingSuffix: "P11-008",
      postAs: "Trustees Quarterly Briefing",
      account: "USC Office of the President",
      contactName: "Eddie Cuevas", contactPhone: "213-555-0143", contactEmail: "eddie.cuevas@usc.edu",
      cateringManagerEmail: "eddie.cuevas@usc.edu",
      locationCode: "UPC-MAIN", roomCode: "TNG",
      daysFromWeekStart: -4, startHHMM: "11:00", endHHMM: "14:00",
      expectedGuests: 60,
      menu: { plated: ["Caesar salad", "Chicken paillard", "Sorbet"], beverage: ["Coffee / tea"] },
      setupNotes: "Single long boardroom table",
      status: BEOStatus.COMPLETED, capCount: 1, svrCount: 4, barCount: 0,
      eventName: "Working Lunch",
    },
    // ---- Three weeks out ----
    {
      bookingSuffix: "P11-009",
      postAs: "USC Health Sciences Holiday Reception",
      account: "Keck School of Medicine",
      contactName: "Leticia Velasquez", contactPhone: "213-555-0162", contactEmail: "leticia.velasquez@usc.edu",
      cateringManagerEmail: "leticia.velasquez@usc.edu",
      locationCode: "HSC-MAIN", roomCode: "HSC-CC",
      daysFromWeekStart: 22, startHHMM: "17:00", endHHMM: "20:00",
      expectedGuests: 250,
      menu: { reception: ["Holiday passed apps", "Carving station", "Dessert display"], bar: ["Wine / beer / spiced cider"] },
      setupNotes: "Cocktail rounds, 3 service bars, stage for keynote",
      status: BEOStatus.CONFIRMED, capCount: 2, svrCount: 12, barCount: 4,
      eventName: "Holiday Reception",
    },
    {
      bookingSuffix: "P11-010",
      postAs: "Trojan Family Brunch",
      account: "USC Alumni Association",
      contactName: "Juanita Gomez", contactPhone: "213-555-0181", contactEmail: "juanita.gomez@usc.edu",
      cateringManagerEmail: "juanita.gomez@usc.edu",
      locationCode: "UCLUB-MAIN", roomCode: "UCLUB",
      daysFromWeekStart: 23, startHHMM: "10:00", endHHMM: "13:00",
      expectedGuests: 175,
      menu: { brunch: ["Omelette station", "Carving station", "Mimosa bar"] },
      setupNotes: "Buffet stations × 3, family-style rounds",
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 8, barCount: 2,
      eventName: "Brunch Buffet",
    },
    // ---- June / July sweep (Phase 12 additions) ----
    {
      bookingSuffix: "P12-001",
      postAs: "June Donor Cultivation Dinner",
      account: "USC Office of Advancement",
      contactName: "Eddie Cuevas", contactPhone: "213-555-0143", contactEmail: "eddie.cuevas@usc.edu",
      cateringManagerEmail: "eddie.cuevas@usc.edu",
      locationCode: "UPC-MAIN", roomCode: "TNG",
      daysFromWeekStart: 14, startHHMM: "18:30", endHHMM: "22:30",
      expectedGuests: 120,
      menu: { plated: ["Heirloom tomato", "Lamb chop", "Crème brûlée"], bar: ["Premium open bar"] },
      setupNotes: "Rounds of 10, head table for 12, ambient candles",
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 9, barCount: 3,
      eventName: "Donor Dinner",
    },
    {
      bookingSuffix: "P12-002",
      postAs: "Summer Orientation Welcome Lunch",
      account: "USC Orientation Programs",
      contactName: "Juanita Gomez", contactPhone: "213-555-0181", contactEmail: "juanita.gomez@usc.edu",
      cateringManagerEmail: "juanita.gomez@usc.edu",
      locationCode: "UPC-MAIN", roomCode: "TROJAN",
      daysFromWeekStart: 18, startHHMM: "11:30", endHHMM: "14:00",
      expectedGuests: 420,
      menu: { buffet: ["Sandwich bar", "Salad station", "Cookie tray"], beverage: ["Iced tea, lemonade, water"] },
      setupNotes: "Cafeteria-style flow, 6 buffet lines, family seating",
      status: BEOStatus.CONFIRMED, capCount: 2, svrCount: 16, barCount: 0,
      eventName: "Orientation Lunch",
    },
    {
      bookingSuffix: "P12-003",
      postAs: "Marshall Executive Education Reception",
      account: "Marshall School of Business",
      contactName: "Levi Flefil", contactPhone: "213-555-0144", contactEmail: "levi.flefil@usc.edu",
      cateringManagerEmail: "levi.flefil@usc.edu",
      locationCode: "UCLUB-MAIN", roomCode: "UCLUB",
      daysFromWeekStart: 25, startHHMM: "18:00", endHHMM: "20:30",
      expectedGuests: 85,
      menu: { reception: ["International cheese", "Passed canapés"], bar: ["Wine / beer / signature"] },
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 4, barCount: 2,
      eventName: "Executive Reception",
    },
    {
      bookingSuffix: "P12-004",
      postAs: "Pre-Commencement Faculty Breakfast",
      account: "USC Office of the Provost",
      contactName: "Jovon O'Connor", contactPhone: "213-555-0177", contactEmail: "jovon.oconnor@usc.edu",
      cateringManagerEmail: "jovon.oconnor@usc.edu",
      locationCode: "USCH-MAIN", roomCode: "HOTEL-GBR",
      daysFromWeekStart: 30, startHHMM: "07:30", endHHMM: "09:30",
      expectedGuests: 200,
      menu: { breakfast: ["Hot buffet", "Pastry display", "Yogurt parfait bar"], beverage: ["Coffee / tea / fresh juice"] },
      setupNotes: "Rounds of 10, AV podium, three buffet lines",
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 8, barCount: 0,
      eventName: "Commencement Breakfast",
    },
    {
      bookingSuffix: "P12-005",
      postAs: "USC Athletics Hall of Fame Gala",
      account: "USC Athletics",
      contactName: "Eddie Cuevas", contactPhone: "213-555-0143", contactEmail: "eddie.cuevas@usc.edu",
      cateringManagerEmail: "eddie.cuevas@usc.edu",
      locationCode: "UPC-MAIN", roomCode: "TNG",
      daysFromWeekStart: 32, startHHMM: "17:00", endHHMM: "23:00",
      expectedGuests: 480,
      menu: { reception: ["Cocktail hour passed"], plated: ["Caesar", "Filet & sea bass duet", "Trio of desserts"], bar: ["Top-shelf open bar"] },
      setupNotes: "48 rounds of 10, stage with screens, dance floor",
      specialInstructions: "Live broadcast — coordinate with AV by T-2 days",
      status: BEOStatus.CONFIRMED, capCount: 3, svrCount: 32, barCount: 8,
      eventName: "Hall of Fame Gala",
    },
    {
      bookingSuffix: "P12-006",
      postAs: "HSC Research Symposium Lunch",
      account: "Keck School of Medicine",
      contactName: "Leticia Velasquez", contactPhone: "213-555-0162", contactEmail: "leticia.velasquez@usc.edu",
      cateringManagerEmail: "leticia.velasquez@usc.edu",
      locationCode: "HSC-MAIN", roomCode: "HSC-CC",
      daysFromWeekStart: 38, startHHMM: "12:00", endHHMM: "14:00",
      expectedGuests: 140,
      menu: { buffet: ["Mediterranean spread", "Grain bowls", "Fruit display"], beverage: ["Iced tea / sparkling water"] },
      setupNotes: "Rounds of 8 + poster gallery flow",
      status: BEOStatus.TENTATIVE, capCount: 1, svrCount: 7, barCount: 0,
      eventName: "Research Lunch",
    },
    {
      bookingSuffix: "P12-007",
      postAs: "Cinema Society Mid-Summer Mixer",
      account: "USC School of Cinematic Arts",
      contactName: "Alonso Recinos", contactPhone: "213-555-0199", contactEmail: "alonso.recinos@usc.edu",
      cateringManagerEmail: "alonso.recinos@usc.edu",
      locationCode: "UCLUB-MAIN", roomCode: "SCRIPTORIUM",
      daysFromWeekStart: 45, startHHMM: "19:00", endHHMM: "22:00",
      expectedGuests: 110,
      menu: { reception: ["Themed canapés", "Popcorn / candy bar"], bar: ["Signature cocktails / beer / wine"] },
      setupNotes: "Cocktail tables, lounge clusters, screening alcove",
      status: BEOStatus.CONFIRMED, capCount: 1, svrCount: 5, barCount: 2,
      eventName: "Cinema Mixer",
    },
    {
      bookingSuffix: "P12-008",
      postAs: "Independence Day Family Picnic",
      account: "USC Staff Assembly",
      contactName: "Juanita Gomez", contactPhone: "213-555-0181", contactEmail: "juanita.gomez@usc.edu",
      cateringManagerEmail: "juanita.gomez@usc.edu",
      locationCode: "UPC-MAIN", roomCode: "MCKAYS",
      daysFromWeekStart: 44, startHHMM: "11:00", endHHMM: "15:00",
      expectedGuests: 300,
      menu: { buffet: ["BBQ classics", "Watermelon bar", "Ice-cream cart"], bar: ["Lemonade / iced tea / beer garden"] },
      setupNotes: "Outdoor picnic tables, kids' zone, photo booth",
      status: BEOStatus.CONFIRMED, capCount: 2, svrCount: 14, barCount: 4,
      eventName: "Holiday Picnic",
    },
  ];

  // Ensure a Schedule row exists for every operational week these BEOs land
  // in so syncBeoShifts has a destination.
  const weekStartsNeeded = new Set<string>();
  for (const b of EXTRA_BEOS) {
    const wd = startOfOperationalWeek(addDays(weekStart, b.daysFromWeekStart));
    weekStartsNeeded.add(wd.toISOString().slice(0, 10));
  }
  for (const wsIso of weekStartsNeeded) {
    const ws = new Date(wsIso + "T00:00:00");
    const existing = await prisma.schedule.findFirst({ where: { weekStart: ws } });
    if (!existing) {
      await prisma.schedule.create({
        data: {
          name: `Week of ${wsIso}`,
          weekStart: ws,
          weekEnd: addDays(ws, 6),
          status: ScheduleStatus.DRAFT,
          notes: "Operational week auto-created for Phase 11 BEO seeding",
          revisionDate: today,
          createdBy: adminUserId,
        },
      });
    }
  }

  const capRole = await prisma.role.findUnique({ where: { code: "CAP" } });
  const svrRole = await prisma.role.findUnique({ where: { code: "SVR" } });
  const barRole = await prisma.role.findUnique({ where: { code: "BAR" } });

  let created = 0;
  for (const [i, b] of EXTRA_BEOS.entries()) {
    const bookingId = `BK-${today.getFullYear()}-${b.bookingSuffix}`;
    if (await prisma.bEO.findUnique({ where: { bookingId } })) continue;

    const venue = await pickRoom(b.locationCode, b.roomCode);
    if (!venue) {
      console.warn(`  ! Location ${b.locationCode} not found — skipping BEO ${bookingId}`);
      continue;
    }
    // Phase 15: validate the catering-manager email maps to a real User so
    // bad master data fails loudly, but DO NOT pre-assign \u2014 every BEO is
    // left unassigned for AI-scheduling / click-to-add testing.
    if (b.cateringManagerEmail) {
      await pickManagerByEmail(b.cateringManagerEmail);
    }
    const eventDate = addDays(weekStart, b.daysFromWeekStart);
    // Deterministic 5-digit BEO # (10100..10999 range) so re-seed is stable.
    const beoNumber = String(10100 + i);

    const beo = await prisma.bEO.create({
      data: {
        bookingId,
        beoNumber,
        postAs: b.postAs,
        account: b.account,
        contactName: b.contactName,
        contactPhone: b.contactPhone,
        contactEmail: b.contactEmail,
        onsiteContact: b.onsiteContact,
        cateringManager: b.contactName,
        locationId: venue.location.id,
        roomId: venue.room?.id,
        managerId: null,
        eventDate,
        startTime: atTime(eventDate, b.startHHMM),
        endTime: atTime(eventDate, b.endHHMM),
        expectedGuests: b.expectedGuests,
        menu: b.menu,
        setupNotes: b.setupNotes,
        specialInstructions: b.specialInstructions,
        status: b.status,
        revisionDate: today,
      },
    });

    // Materialise a single Event + Shift so the board lights up.
    if (venue.room) {
      const ev = await prisma.event.create({
        data: {
          beoId: beo.id,
          roomId: venue.room.id,
          name: b.eventName,
          startsAt: atTime(eventDate, b.startHHMM),
          endsAt: atTime(eventDate, b.endHHMM),
          guests: b.expectedGuests,
        },
      });
      const weekStartForBeo = startOfOperationalWeek(eventDate);
      const sched = await prisma.schedule.findFirst({ where: { weekStart: weekStartForBeo } });
      if (sched) {
        await prisma.shift.create({
          data: {
            scheduleId: sched.id,
            eventId: ev.id,
            date: atTime(eventDate, "00:00"),
            startsAt: atTime(eventDate, b.startHHMM),
            endsAt: atTime(eventDate, b.endHHMM),
            locationCode: venue.location.code,
            roomCode: venue.room.code,
            label: b.eventName,
            statusCode: ShiftStatusCode.NONE,
            requirements: {
              create: [
                ...(capRole && b.capCount > 0 ? [{ roleId: capRole.id, count: b.capCount }] : []),
                ...(svrRole && b.svrCount > 0 ? [{ roleId: svrRole.id, count: b.svrCount }] : []),
                ...(barRole && b.barCount > 0 ? [{ roleId: barRole.id, count: b.barCount }] : []),
              ],
            },
          },
        });
      }
    }
    created++;
  }
  console.log(`  ✓ ${created} additional BEOs created`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
