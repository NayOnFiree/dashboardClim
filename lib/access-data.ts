import "server-only";

import { database } from "@/lib/db";

export type AccessUser = { id: string; name: string; email: string; role: string; active: boolean; passkeys: number; sessions: number; invitationStatus: string; invitationExpires?: string; lastLogin?: string };

export async function getAccessUsers(organizationId: string): Promise<AccessUser[]> {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY"); await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await client.query<{ id: string; name: string; email: string; role: string; active: boolean; passkeys: string; sessions: string; invitation_status: string; invitation_expires: string | null; last_login: string | null }>(`
      SELECT profile.id, concat_ws(' ', profile.first_name, profile.last_name) AS name, profile.email,
        profile.role::text, profile.active, count(DISTINCT authenticator."credentialID")::text AS passkeys,
        count(DISTINCT session.id)::text AS sessions,
        CASE WHEN max(invitation.used_at) IS NOT NULL THEN 'used'
          WHEN max(invitation.revoked_at) IS NOT NULL THEN 'revoked'
          WHEN max(invitation.expires_at) < now() THEN 'expired'
          WHEN max(invitation.id) IS NOT NULL THEN 'pending' ELSE 'none' END AS invitation_status,
        to_char(max(invitation.expires_at) AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS invitation_expires,
        to_char(max(login.created_at) FILTER (WHERE login.outcome = 'success') AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS last_login
      FROM profiles profile LEFT JOIN users auth_user ON auth_user."profileId" = profile.id
      LEFT JOIN authenticators authenticator ON authenticator."userId" = auth_user.id
      LEFT JOIN sessions session ON session."userId" = auth_user.id AND session.expires > now()
      LEFT JOIN auth_invitations invitation ON invitation.profile_id = profile.id
      LEFT JOIN auth_login_events login ON login.profile_id = profile.id
      WHERE profile.organization_id = $1 GROUP BY profile.id ORDER BY profile.active DESC, profile.first_name, profile.last_name
    `, [organizationId]);
    await client.query("ROLLBACK");
    return result.rows.map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role, active: row.active, passkeys: Number(row.passkeys), sessions: Number(row.sessions), invitationStatus: row.invitation_status, invitationExpires: row.invitation_expires ?? undefined, lastLogin: row.last_login ?? undefined }));
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); console.error("Lecture des accès impossible.", error); return []; }
  finally { client.release(); }
}
