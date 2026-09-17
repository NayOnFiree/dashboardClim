import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getCurrentUser, type AppRole } from "@/lib/auth/session";
import { database } from "@/lib/db";

const roles = new Set<AppRole>(["admin", "operations", "technician", "subcontractor", "sales"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["owner", "admin"].includes(user.role)) return Response.json({ error: "Accès refusé." }, { status: 403 });
  try {
    const payload = await request.json() as { email?: string; firstName?: string; lastName?: string; role?: AppRole };
    const email = payload.email?.trim().toLowerCase(); const firstName = payload.firstName?.trim(); const lastName = payload.lastName?.trim(); const role = payload.role;
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName || !role || !roles.has(role)) throw new Error("VALIDATION:Informations d’invitation invalides.");
    if (user.role !== "owner" && ["admin", "operations"].includes(role)) return Response.json({ error: "Seul l’Owner peut inviter un administrateur." }, { status: 403 });
    const token = randomBytes(32).toString("base64url"); const hash = createHash("sha256").update(token).digest("hex"); const client = await database.connect();
    try {
      await client.query("BEGIN"); await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
      const existingAuth = await client.query("SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);
      if (existingAuth.rowCount) throw new Error("VALIDATION:Ce compte possède déjà une passkey.");
      const profile = await client.query<{ id: string }>(`INSERT INTO profiles (organization_id,email,role,first_name,last_name,active)
        VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (organization_id,email) DO UPDATE
        SET role = EXCLUDED.role, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, active = true RETURNING id`, [user.organizationId, email, role, firstName, lastName]);
      const profileId = profile.rows[0].id;
      await client.query(`INSERT INTO auth_identities (profile_id,organization_id,email,role,active) VALUES ($1,$2,$3,$4,true)
        ON CONFLICT (profile_id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role, active=true`, [profileId, user.organizationId, email, role]);
      await client.query("UPDATE auth_invitations SET revoked_at=now() WHERE profile_id=$1 AND used_at IS NULL AND revoked_at IS NULL", [profileId]);
      await client.query("INSERT INTO auth_invitations (id,profile_id,token_hash,expires_at,invited_by) VALUES ($1,$2,$3,now()+interval '30 minutes',$4)", [randomUUID(), profileId, hash, user.id]);
      await client.query("INSERT INTO audit_logs (organization_id,actor_id,entity_type,entity_id,action,after_json) VALUES ($1,$2,'profile',$3,'auth.invited',$4::jsonb)", [user.organizationId, user.id, profileId, JSON.stringify({ email, role })]);
      await client.query("COMMIT");
      const baseUrl = (process.env.APP_BASE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
      return Response.json({ activationUrl: `${baseUrl}/activate/${token}`, expiresInMinutes: 30 }, { status: 201 });
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitation impossible.";
    return Response.json({ error: message.startsWith("VALIDATION:") ? message.slice(11) : "L’invitation n’a pas pu être créée." }, { status: message.startsWith("VALIDATION:") ? 400 : 500 });
  }
}
