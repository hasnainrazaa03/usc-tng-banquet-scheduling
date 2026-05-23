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

  console.log("→ Importing master data (venue groups, locations, rooms, event spaces)…");
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
  const md = raw as { roles: Array<{ code: string; name: string; color?: string }>;
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
  await prisma.user.upsert({
    where: { email: "supervisor@tng.usc.edu" },
    create: { email: "supervisor@tng.usc.edu", name: "Demo Supervisor", passwordHash: password, role: UserRole.SUPERVISOR },
    update: { name: "Demo Supervisor", role: UserRole.SUPERVISOR, active: true },
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
  console.log("→ Upserting Servers (32 real employees)…");
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

    const server = await prisma.server.upsert({
      where: { employeeId },
      create: {
        employeeId,
        firstName: s.firstName,
        lastName: s.lastName,
        email,
        hireDate,
        classification: s.classification,
        employmentType: s.employmentType,
        status: EmploymentStatus.ACTIVE,
        notes: s.notes ?? null,
        presidentialRank,
      },
      update: {
        firstName: s.firstName,
        lastName: s.lastName,
        email,
        hireDate,
        classification: s.classification,
        employmentType: s.employmentType,
        status: EmploymentStatus.ACTIVE,
        notes: s.notes ?? null,
        presidentialRank,
      },
    });
    createdServers.push({ id: server.id, hireDate, firstName: s.firstName, lastName: s.lastName });
  }
  console.log(`  ✓ ${createdServers.length} servers (${FULL_TIME.length} FT, ${PART_TIME.length} PT)`);

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

      // Assign the most senior captain (Mario Estrada) to the dinner shift.
      if (capRole && rosterByTenure[0]) {
        await prisma.shiftAssignment.create({
          data: {
            shiftId: dinnerShift.id,
            serverId: rosterByTenure[0].id,
            roleCode: "CAP",
            assignedBy: adminUser.id,
            reason: "Most senior lead captain",
          },
        });
      }
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

  console.log("✓ Seed complete.");
  console.log("  Login: admin@tng.usc.edu / password123  (ADMIN)");
  console.log("  Login: manager@tng.usc.edu / password123 (MANAGER)");
  console.log("  Login: supervisor@tng.usc.edu / password123 (SUPERVISOR)");
  console.log("  Named manager logins: <firstname>.<lastname>@usc.edu / password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
