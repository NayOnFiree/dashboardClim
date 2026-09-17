import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";

export async function DELETE(_: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const user = await getCurrentUser(); if (!user || !["owner", "admin"].includes(user.role)) return Response.json({ error: "Accès refusé." }, { status: 403 });
  const { profileId } = await params; const client = await database.connect();
  try {
    await client.query("BEGIN"); await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const target = await client.query("SELECT id FROM profiles WHERE id=$1 AND organization_id=$2", [profileId, user.organizationId]);
    if (!target.rowCount) { await client.query("ROLLBACK"); return Response.json({ error: "Utilisateur introuvable." }, { status: 404 }); }
    const deleted = await client.query("DELETE FROM sessions WHERE \"userId\" IN (SELECT id FROM users WHERE \"profileId\"=$1)", [profileId]);
    await client.query("INSERT INTO audit_logs (organization_id,actor_id,entity_type,entity_id,action,after_json) VALUES ($1,$2,'profile',$3,'auth.sessions_revoked',$4::jsonb)", [user.organizationId, user.id, profileId, JSON.stringify({ count: deleted.rowCount })]);
    await client.query("COMMIT"); return Response.json({ revoked: deleted.rowCount });
  } catch { await client.query("ROLLBACK").catch(() => undefined); return Response.json({ error: "Révocation impossible." }, { status: 500 }); }
  finally { client.release(); }
}
