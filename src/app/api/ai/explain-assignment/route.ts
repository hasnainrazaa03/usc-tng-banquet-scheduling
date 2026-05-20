import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * AI assist — return a plain-English explanation of why a specific server
 * was (or could be) assigned to a shift. Reads the stored `reason` string
 * from auto-scheduling, plus contextual server data.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
  }

  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      server: {
        include: {
          seniority: true,
          qualifications: { include: { qualification: true } },
        },
      },
      shift: true,
    },
  });

  if (!assignment) return NextResponse.json({ error: "not found" }, { status: 404 });

  const seniority = assignment.server.seniority;
  const bullets: string[] = [];
  if (assignment.reason) bullets.push(assignment.reason);
  if (seniority) {
    bullets.push(
      `Seniority rank #${seniority.seniorityRank ?? "—"} (score ${seniority.seniorityScore.toFixed(2)}, based on tenure).`,
    );
  }
  const quals = assignment.server.qualifications.map((q) => q.qualification.code);
  if (quals.length) bullets.push(`Qualifications: ${quals.join(", ")}.`);
  if (assignment.locked) bullets.push("This assignment is locked and will not be changed by auto-scheduling.");
  if (assignment.acknowledged) bullets.push("Employee has acknowledged the shift.");

  return NextResponse.json({
    assignment: {
      id: assignment.id,
      serverName: `${assignment.server.firstName} ${assignment.server.lastName}`,
      shiftId: assignment.shiftId,
      roleCode: assignment.roleCode,
      locked: assignment.locked,
      acknowledged: assignment.acknowledged,
    },
    explanation: bullets,
  });
}
