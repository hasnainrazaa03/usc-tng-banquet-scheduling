import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { UserRole } from "@prisma/client";

// Read AUTH_SECRET lazily on every call so dev-server env reloads (and Vercel
// secret rotations between deploys) take effect without a process restart. If
// we captured this at module scope, a JWT signed with the new secret would be
// verified against a stale module-cached secret → user appears logged-in but
// every redirect bounces them back to /login.
function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me");
}
const COOKIE = "tng_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  cookies().delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const session = payload as unknown as SessionUser;
    // Defend against stale cookies pointing at a userId that was wiped by a
    // re-seed: verify the user still exists and is active before trusting
    // the session. Without this, downstream `userId` FK writes (AuditLog,
    // etc.) blow up with P2003 and 500 every request.
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, active: true, role: true },
    });
    if (!user || !user.active) return null;
    // Keep role fresh in case it changed since the JWT was issued.
    return { ...session, role: user.role };
  } catch {
    return null;
  }
}

export async function requireRole(allowed: UserRole[]): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  if (!allowed.includes(s.role)) throw new Error("FORBIDDEN");
  return s;
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!u || !u.active) return null;
  const ok = await verifyPassword(password, u.passwordHash);
  if (!ok) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}
