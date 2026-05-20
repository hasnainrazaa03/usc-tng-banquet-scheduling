/* eslint-disable no-console */
import { PrismaClient, UserRole, JobClassification, DayOfWeek, BEOStatus, ScheduleStatus, ShiftStatusCode } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { importMasterData } from "../src/lib/import";

const prisma = new PrismaClient();

const MASTER_DATA_PATH = path.join(process.cwd(), "data", "banquet_master_data.json");

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function atTime(d: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}
function sundayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

async function main() {
  console.log("→ Seeding USC TNG Banquet system…");
venue groups, locations, rooms, event spaces, roles,
  //    qualifications (via the typed importer so old + new shapes both work).
  const master = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, "utf-8"));
  await prisma.masterDataVersion.create({
    data: { versionNum: master.version ?? 1, payload: master, note: "Initial import (seed)" },
  });

  const importResult = await importMasterData(master);
  if (!importResult.ok) {
    console.error("✗ master data validation failed:", importResult.errors);
    process.exit(1);
  }
  console.log(
    `✓ Imported ${importResult.counts.venueGroups} venue groups, ` +
    `${importResult.counts.locations} locations, ` +
    `${importResult.counts.rooms} rooms, ` +
    `${importResult.counts.eventSpaces} event spaces.`,
  ); });
  }

  // Qualifications
  for (const q of master.qualifications) {
    await prisma.qualification.upsert({
      where: { code: q.code },
      create: { code: q.code, name: q.name },
      update: { name: q.name },
    });
  }

  // Roles + required qualifications
  for (const role of master.roles) {
    const r = await prisma.role.upsert({
      where: { code: role.code },
      create: { code: role.code, name: role.name, color: role.color ?? null },
      update: { name: role.name, color: role.color ?? null },
    });
    for (const qcode of role.qualifications ?? []) {
      const q = await prisma.qualification.findUnique({ where: { code: qcode } });
      if (!q) continue;
      await prisma.roleQualification.upsert({
        where: { roleId_qualificationId: { roleId: r.id, qualificationId: q.id } },
        create: { roleId: r.id, qualificationId: q.id },
        update: {},
      });
    }
  }

  // 2) Users (admin + manager + supervisor + a few servers)
  const password = await bcrypt.hash("password123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@tng.usc.edu" },
    create: { email: "admin@tng.usc.edu", name: "T&G Admin", role: UserRole.ADMIN, passwordHash: password },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "manager@tng.usc.edu" },
    create: { email: "manager@tng.usc.edu", name: "Maria Manager", role: UserRole.MANAGER, passwordHash: password },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "supervisor@tng.usc.edu" },
    create: { email: "supervisor@tng.usc.edu", name: "Sam Supervisor", role: UserRole.SUPERVISOR, passwordHash: password },
    update: {},
  });

  // 3) Servers (~20) with hire dates spanning many years => seniority
  const firstNames = ["Alex","Jamie","Chris","Pat","Taylor","Jordan","Casey","Morgan","Riley","Avery","Cameron","Quinn","Rowan","Sky","Drew","Reese","Sage","Hayden","Emerson","Finley"];
  const lastNames  = ["Garcia","Nguyen","Patel","Smith","Johnson","Lopez","Kim","Brown","Chen","Khan","Martinez","Singh","Williams","Davis","Hernandez","Lee","Wilson","Anderson","Thomas","Moore"];

  const today = new Date();
  const servers: { id: string; firstName: string; lastName: string; classification: JobClassification; years: number }[] = [];

  for (let i = 0; i < 20; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName  = lastNames[i % lastNames.length];
    const employeeId = `E${(1000 + i).toString()}`;
    const yearsAgo = (i * 1.1) + 0.5; // 0.5–21+ years
    const hireDate = new Date(today);
    hireDate.setFullYear(hireDate.getFullYear() - Math.floor(yearsAgo));
    hireDate.setMonth(hireDate.getMonth() - Math.floor((yearsAgo % 1) * 12));

    const classification: JobClassification =
      i === 0 ? "LEAD_BANQUET_CAPTAIN" :
      i < 3 ? "BANQUET_CAPTAIN" :
      i < 5 ? "BARTENDER" :
      i === 5 ? "AV_TECH" :
      i === 6 ? "HOUSEPERSON" :
      "BANQUET_SERVER";

    const serverEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@tng.usc.edu`;

    const u = await prisma.user.upsert({
      where: { email: serverEmail },
      create: { email: serverEmail, name: `${firstName} ${lastName}`, role: UserRole.EMPLOYEE, passwordHash: password },
      update: {},
    });

    const s = await prisma.server.upsert({
      where: { employeeId },
      create: {
        employeeId,
        userId: u.id,
        firstName, lastName,
        email: serverEmail,
        phone: `213-555-${(1000+i).toString().padStart(4,"0")}`,
        hireDate,
        classification,
        preferredLocations: i % 2 === 0 ? ["TNG"] : ["TCC","TNG"],
        preferredShifts: i % 3 === 0 ? ["PM"] : ["AM","PM"],
        profile: { create: { payRate: 22 + (i*0.5), uniformSize: "M" } },
      },
      update: {},
    });

    const years = (today.getTime() - hireDate.getTime()) / (1000*60*60*24*365.25);
    const seniorityScore = years * (master.seniorityRules?.weightYears ?? 1);

    await prisma.seniorityRecord.upsert({
      where: { serverId: s.id },
      create: { serverId: s.id, yearsOfService: years, seniorityScore },
      update: { yearsOfService: years, seniorityScore },
    });

    // Default availability: Mon–Sat 06:00–23:00 unless flagged
    const days: DayOfWeek[] = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
    for (const d of days) {
      await prisma.availability.create({
        data: { serverId: s.id, dayOfWeek: d, startTime: "06:00", endTime: "23:00", preference: 0 },
      });
    }

    // A couple of qualifications for bartenders + captains
    if (["BANQUET_CAPTAIN","LEAD_BANQUET_CAPTAIN","BARTENDER"].includes(classification)) {
      const rbs = await prisma.qualification.findUnique({ where: { code: "RBS" } });
      if (rbs) {
        await prisma.serverQualification.upsert({
          where: { serverId_qualificationId: { serverId: s.id, qualificationId: rbs.id } },
          create: { serverId: s.id, qualificationId: rbs.id, obtainedDate: hireDate },
          update: {},
        });
      }
    }

    servers.push({ id: s.id, firstName, lastName, classification, years });
  }

  // Recompute seniority ranks (1 = most senior)
  const ranked = await prisma.seniorityRecord.findMany({ orderBy: [{ seniorityScore: "desc" }] });
  for (let i = 0; i < ranked.length; i++) {
    await prisma.seniorityRecord.update({ where: { id: ranked[i].id }, data: { seniorityRank: i + 1 } });
  }

  // 4) Time-off example
  if (servers[3]) {
    await prisma.timeOffRequest.create({
      data: {
        serverId: servers[3].id,
        startDate: addDays(today, 10),
        endDate: addDays(today, 12),
        reason: "Family event",
        status: "APPROVED",
      },
    });
  }

  // 5) Sample BEO + Events + Schedule + Shifts
  const tng = await prisma.location.findUnique({ where: { code: "TNG" } });
  const gbr = tng ? await prisma.room.findUnique({ where: { locationId_code: { locationId: tng.id, code: "GBR" } } }) : null;
  const foy = tng ? await prisma.room.findUnique({ where: { locationId_code: { locationId: tng.id, code: "FOY" } } }) : null;

  const eventDate = addDays(today, 4);

  const beo = await prisma.bEO.create({
    data: {
      postAs: "USC Dornsife Donor Gala",
      account: "USC Dornsife College",
      bookingId: "BK-2026-1042",
      uepaNumber: "UEPA-2026-118",
      billingMethod: "Internal Transfer",
      contactName: "Dr. Jane Goodwin",
      contactPhone: "213-555-9120",
      contactEmail: "goodwin@usc.edu",
      onsiteContact: "Eli Producer (213-555-9121)",
      cateringManager: "Maria Manager",
      locationId: tng?.id,
      eventDate,
      startTime: atTime(eventDate, "17:00"),
      endTime: atTime(eventDate, "22:30"),
      expectedGuests: 220,
      menu: {
        passed: ["Mini crab cakes", "Burrata crostini", "Lamb lollipop"],
        plated: { salad: "Heirloom tomato burrata", entree: "Filet & sea bass duo", dessert: "Chocolate ganache torte" },
        bar: ["Open bar — premium", "Signature cocktail: Cardinal Mule"],
      },
      av: { microphones: 3, podium: 1, projector: 2, livestream: true, notes: "House sound, 2x lavaliers, 1x handheld." },
      setupNotes: "Rounds of 10 in GBR. Reception hightops in Foyer 5–6:30 PM.",
      specialInstructions: "VIP table 12 — dignitary seating. Allergy: shellfish at table 4 (2 guests).",
      miscNotes: "Photographer arrives 4:30. Press table at rear.",
      handwrittenChanges: "Final guest count moved from 200 → 220 (added 20 students).",
      status: BEOStatus.CONFIRMED,
      revisionDate: addDays(today, -2),
      sections: {
        create: [
          {
            name: "Reception",
            functionType: "RECEPTION",
            startTime: atTime(eventDate, "17:00"),
            endTime: atTime(eventDate, "18:30"),
            roomCode: "FOY",
            setupType: "RECEPTION_HIGHTOP",
            guests: 220,
            staffingNeeds: [
              { roleCode: "CAP", count: 1 },
              { roleCode: "SVR", count: 4 },
              { roleCode: "BAR", count: 3 },
              { roleCode: "BBK", count: 1 },
            ],
          },
          {
            name: "Plated Dinner",
            functionType: "PLATED_DINNER",
            startTime: atTime(eventDate, "18:30"),
            endTime: atTime(eventDate, "21:30"),
            roomCode: "GBR",
            setupType: "BANQUET_ROUNDS_10",
            guests: 220,
            staffingNeeds: [
              { roleCode: "CAP", count: 2 },
              { roleCode: "SVR", count: 14 },
              { roleCode: "BAR", count: 2 },
              { roleCode: "HSP", count: 2 },
              { roleCode: "AV",  count: 1 },
            ],
          },
          {
            name: "Breakdown",
            functionType: "BREAKDOWN",
            startTime: atTime(eventDate, "21:30"),
            endTime: atTime(eventDate, "22:30"),
            roomCode: "GBR",
            staffingNeeds: [
              { roleCode: "HSP", count: 2 },
              { roleCode: "SVR", count: 4 },
            ],
          },
        ],
      },
    },
  });

  // Concrete events tied to the BEO (one per section)
  const ev1 = await prisma.event.create({
    data: {
      beoId: beo.id, roomId: foy?.id ?? null,
      name: "Dornsife Gala — Reception",
      startsAt: atTime(eventDate, "17:00"), endsAt: atTime(eventDate, "18:30"),
      guests: 220,
    },
  });
  const ev2 = await prisma.event.create({
    data: {
      beoId: beo.id, roomId: gbr?.id ?? null,
      name: "Dornsife Gala — Plated Dinner",
      startsAt: atTime(eventDate, "18:30"), endsAt: atTime(eventDate, "21:30"),
      guests: 220,
    },
  });

  // 6) Schedule for current week
  const weekStart = sundayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const schedule = await prisma.schedule.create({
    data: {
      name: `Week of ${weekStart.toISOString().slice(0,10)}`,
      weekStart, weekEnd,
      status: ScheduleStatus.DRAFT,
      notes: "Seeded sample schedule",
      revisionDate: today,
      createdBy: adminUser.id,
    },
  });

  // Shifts for the gala day
  const capRole = await prisma.role.findUnique({ where: { code: "CAP" } });
  const svrRole = await prisma.role.findUnique({ where: { code: "SVR" } });
  const barRole = await prisma.role.findUnique({ where: { code: "BAR" } });

  const shiftReception = await prisma.shift.create({
    data: {
      scheduleId: schedule.id, eventId: ev1.id,
      date: atTime(eventDate, "00:00"),
      startsAt: atTime(eventDate, "16:00"), endsAt: atTime(eventDate, "19:00"),
      locationCode: "TNG", roomCode: "FOY",
      label: "Gala Reception", statusCode: ShiftStatusCode.NONE,
      requirements: {
        create: [
          ...(capRole ? [{ roleId: capRole.id, count: 1 }] : []),
          ...(svrRole ? [{ roleId: svrRole.id, count: 4 }] : []),
          ...(barRole ? [{ roleId: barRole.id, count: 3 }] : []),
        ],
      },
    },
  });

  const shiftDinner = await prisma.shift.create({
    data: {
      scheduleId: schedule.id, eventId: ev2.id,
      date: atTime(eventDate, "00:00"),
      startsAt: atTime(eventDate, "17:30"), endsAt: atTime(eventDate, "22:30"),
      locationCode: "TNG", roomCode: "GBR",
      label: "Gala Plated Dinner", statusCode: ShiftStatusCode.NONE,
      requirements: {
        create: [
          ...(capRole ? [{ roleId: capRole.id, count: 2 }] : []),
          ...(svrRole ? [{ roleId: svrRole.id, count: 14 }] : []),
          ...(barRole ? [{ roleId: barRole.id, count: 2 }] : []),
        ],
      },
    },
  });

  // Pre-assign a couple of OFF status for top servers
  const dayBefore = addDays(eventDate, -1);
  await prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      date: atTime(dayBefore, "00:00"),
      startsAt: atTime(dayBefore, "00:00"), endsAt: atTime(dayBefore, "23:59"),
      locationCode: "TNG", label: "Off",
      statusCode: ShiftStatusCode.OFF,
      assignments: { create: [{ serverId: servers[0].id, roleCode: "OFF", reason: "Scheduled day off" }] },
    },
  });

  // Sanity-assign the lead captain to the dinner shift so demo isn't empty
  if (capRole) {
    await prisma.shiftAssignment.create({
      data: { shiftId: shiftDinner.id, serverId: servers[0].id, roleCode: "CAP", assignedBy: adminUser.id, reason: "Most senior captain, preferred location TNG" },
    });
    await prisma.shiftAssignment.create({
      data: { shiftId: shiftReception.id, serverId: servers[1].id, roleCode: "CAP", assignedBy: adminUser.id, reason: "Second-most senior captain available" },
    });
  }

  console.log("✓ Seed complete.");
  console.log("  Login: admin@tng.usc.edu / password123  (ADMIN)");
  console.log("  Login: manager@tng.usc.edu / password123 (MANAGER)");
  console.log("  Login: supervisor@tng.usc.edu / password123 (SUPERVISOR)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
