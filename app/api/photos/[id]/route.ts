import { readFile } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";
import { resolvePrivatePhoto } from "@/lib/photo-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentification requise.", { status: 401 });
  const { id } = await params;
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const result = await client.query<{ storage_path: string; mime_type: string }>(`
      SELECT ph.storage_path, ph.mime_type FROM photos ph
      JOIN jobs j ON j.id = ph.job_id
      WHERE ph.id = $1 AND ph.organization_id = $2
        AND ($3 = ANY(ARRAY['owner','admin','operations']) OR j.primary_technician_id = $4)
      LIMIT 1
    `, [id, user.organizationId, user.role, user.id]);
    await client.query("ROLLBACK");
    if (!result.rowCount) return new Response("Photo introuvable.", { status: 404 });
    const bytes = await readFile(resolvePrivatePhoto(result.rows[0].storage_path));
    return new Response(bytes, { headers: { "Content-Type": result.rows[0].mime_type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return new Response("Photo indisponible.", { status: 500 });
  } finally {
    client.release();
  }
}
