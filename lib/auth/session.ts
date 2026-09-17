import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { database } from "@/lib/db";
import { auth } from "@/auth";

const COOKIE_NAME = "clim_pilot_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type AppRole = "owner" | "admin" | "operations" | "technician" | "subcontractor" | "sales";

type SessionPayload = {
  userId: string;
  organizationId: string;
  email: string;
  role: AppRole;
  expiresAt: number;
};

export type CurrentUser = {
  id: string;
  organizationId: string;
  email: string;
  role: AppRole;
  firstName: string;
  lastName: string;
};

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET doit contenir au moins 32 caracteres.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || !payload.organizationId || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(user: CurrentUser) {
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000;
  const token = encodeSession({
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: user.role,
    expiresAt,
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV === "production") {
    const session = await auth();
    if (!session?.user?.id || !session.user.organizationId) return null;
    const client = await database.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SELECT set_config('app.organization_id', $1, true)", [session.user.organizationId]);
      const result = await client.query<{ id: string; organization_id: string; email: string; role: AppRole; first_name: string; last_name: string }>(`
        SELECT id, organization_id, email, role::text, first_name, last_name FROM profiles
        WHERE id = $1 AND organization_id = $2 AND active = true LIMIT 1
      `, [session.user.id, session.user.organizationId]);
      await client.query("ROLLBACK");
      const profile = result.rows[0];
      return profile ? { id: profile.id, organizationId: profile.organization_id, email: profile.email, role: profile.role, firstName: profile.first_name, lastName: profile.last_name } : null;
    } catch { await client.query("ROLLBACK").catch(() => undefined); return null; }
    finally { client.release(); }
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = decodeSession(token);
  if (!session) return null;

  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [session.organizationId]);
    const result = await client.query<{
      id: string; organization_id: string; email: string; role: AppRole; first_name: string; last_name: string;
    }>(`
      SELECT id, organization_id, email, role::text, first_name, last_name
      FROM profiles
      WHERE id = $1 AND organization_id = $2 AND active = true
      LIMIT 1
    `, [session.userId, session.organizationId]);
    await client.query("ROLLBACK");
    const profile = result.rows[0];
    if (!profile) return null;
    return {
      id: profile.id,
      organizationId: profile.organization_id,
      email: profile.email,
      role: profile.role,
      firstName: profile.first_name,
      lastName: profile.last_name,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return null;
  } finally {
    client.release();
  }
}

export async function requireUser(roles?: AppRole[], returnTo = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (roles && !roles.includes(user.role)) {
    redirect(user.role === "technician" || user.role === "subcontractor" ? "/app/today" : "/admin/dashboard");
  }
  return user;
}
