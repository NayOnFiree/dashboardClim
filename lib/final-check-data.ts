import "server-only";

import { database } from "@/lib/db";

export type FinalCheckAnswers = Record<string, string>;
export type SavedFinalCheck = { equipmentId: string; answers: FinalCheckAnswers; notes?: string };

export async function getFinalChecks(publicCode: string, technicianId: string, organizationId: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await client.query<{ equipment_id: string; answers: FinalCheckAnswers; notes: string | null }>(`
      SELECT final.equipment_id, final.answers, final.notes
      FROM job_final_checks final
      JOIN jobs job ON job.id = final.job_id
      WHERE job.public_code = $1 AND job.organization_id = $2 AND job.primary_technician_id = $3
    `, [publicCode, organizationId, technicianId]);
    await client.query("ROLLBACK");
    return result.rows.map((row) => ({ equipmentId: row.equipment_id, answers: row.answers, notes: row.notes ?? undefined }));
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return [];
  } finally { client.release(); }
}
