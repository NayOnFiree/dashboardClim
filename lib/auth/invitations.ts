import "server-only";

import { createHash } from "node:crypto";
import { database } from "@/lib/db";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export type InvitationInfo = { email: string; name: string; role: string; expiresAt: string; available: boolean };

export async function getInvitationInfo(token: string): Promise<InvitationInfo | undefined> {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return undefined;
  const result = await database.query<{ email: string; name: string; role: string; expires_at: string; available: boolean }>(`
    SELECT identity.email, concat_ws(' ', profile.first_name, profile.last_name) AS name, identity.role::text,
      to_char(invitation.expires_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY à HH24:MI') AS expires_at,
      invitation.expires_at > now() AND invitation.used_at IS NULL AND invitation.revoked_at IS NULL AS available
    FROM auth_invitations invitation JOIN auth_identities identity ON identity.profile_id = invitation.profile_id
    JOIN profiles profile ON profile.id = identity.profile_id
    WHERE invitation.token_hash = $1 LIMIT 1
  `, [tokenHash(token)]);
  const row = result.rows[0];
  return row ? { email: row.email, name: row.name, role: row.role, expiresAt: row.expires_at, available: row.available } : undefined;
}

export async function activateInvitationToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return { ok: false as const, error: "Invitation invalide." };
  const result = await database.query<{ email: string }>(`
    UPDATE auth_invitations invitation SET activated_at = now()
    FROM auth_identities identity
    WHERE invitation.profile_id = identity.profile_id AND invitation.token_hash = $1
      AND invitation.expires_at > now() AND invitation.used_at IS NULL AND invitation.revoked_at IS NULL
    RETURNING identity.email
  `, [tokenHash(token)]);
  const email = result.rows[0]?.email;
  return email ? { ok: true as const, email } : { ok: false as const, error: "Cette invitation a expiré ou a déjà été utilisée." };
}
