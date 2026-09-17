import "server-only";

import { database } from "@/lib/db";

export type ChecklistValue = {
  answer?: string;
  productId?: string;
  quantityMl?: number;
};

export type ServiceChecklistItem = {
  id: string;
  code: string;
  label: string;
  responseType: "choice" | "product";
  required: boolean;
  criticalRequired: boolean;
  requiredOrReason: boolean;
  orderIndex: number;
  options: string[];
  value?: ChecklistValue;
  reason?: string;
};

export type ChecklistProduct = {
  id: string;
  name: string;
  manufacturer?: string;
  instructions: string;
  contactTimeMinutes?: number;
  rinseRule: string;
  safetyNotes?: string;
};

export type ServiceChecklist = {
  templateName: string;
  templateVersion: number;
  items: ServiceChecklistItem[];
  products: ChecklistProduct[];
};

type Snapshot = {
  templateName: string;
  templateVersion: number;
  items: ServiceChecklistItem[];
};

type ItemRow = {
  id: string; code: string; label: string; response_type: "choice" | "product";
  required: boolean; critical_required: boolean; required_or_reason: boolean;
  order_index: number; condition_json: { options?: string[] } | null;
};

export async function getServiceChecklist(publicCode: string, equipmentId: string, technicianId: string, organizationId: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const jobResult = await client.query<{ id: string; service_type: string }>(`
      SELECT j.id, j.service_type
      FROM jobs j
      JOIN job_equipment je ON je.job_id = j.id
      WHERE j.public_code = $1 AND j.organization_id = $2
        AND j.primary_technician_id = $3 AND je.equipment_id = $4
      LIMIT 1
      FOR UPDATE OF j
    `, [publicCode, organizationId, technicianId, equipmentId]);
    if (!jobResult.rowCount) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const job = jobResult.rows[0];
    const savedSnapshot = await client.query<{ snapshot_json: Snapshot }>(
      "SELECT snapshot_json FROM job_checklist_snapshots WHERE job_id = $1",
      [job.id],
    );
    let snapshot = savedSnapshot.rows[0]?.snapshot_json;

    if (!snapshot) {
      const templateResult = await client.query<{ id: string; name: string; version: number }>(`
        SELECT template.id, template.name, template.version
        FROM checklist_templates template
        WHERE template.organization_id = $1 AND template.service_type = $2 AND template.active = true
          AND EXISTS (SELECT 1 FROM checklist_items item WHERE item.template_id = template.id)
        ORDER BY template.version DESC
        LIMIT 1
      `, [organizationId, job.service_type]);
      const template = templateResult.rows[0];
      if (!template) {
        await client.query("ROLLBACK");
        return undefined;
      }
      const itemResult = await client.query<ItemRow>(`
        SELECT id, code, label, response_type, required, critical_required,
          required_or_reason, order_index, condition_json
        FROM checklist_items WHERE template_id = $1 ORDER BY order_index
      `, [template.id]);
      snapshot = {
        templateName: template.name,
        templateVersion: template.version,
        items: itemResult.rows.map((item) => ({
          id: item.id,
          code: item.code,
          label: item.label,
          responseType: item.response_type,
          required: item.required,
          criticalRequired: item.critical_required,
          requiredOrReason: item.required_or_reason,
          orderIndex: item.order_index,
          options: item.condition_json?.options ?? [],
        })),
      };
      await client.query(`
        INSERT INTO job_checklist_snapshots (job_id, template_id, template_version, snapshot_json)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (job_id) DO NOTHING
      `, [job.id, template.id, template.version, JSON.stringify(snapshot)]);
    }

    const [responses, products] = await Promise.all([
      client.query<{ item_id: string; value_json: ChecklistValue; reason: string | null }>(`
        SELECT item_id, value_json, reason FROM checklist_responses
        WHERE job_id = $1 AND equipment_id = $2
      `, [job.id, equipmentId]),
      client.query<{ id: string; name: string; manufacturer: string | null; instructions: string; contact_time_minutes: number | null; rinse_rule: string; safety_notes: string | null }>(`
        SELECT id, name, manufacturer, instructions, contact_time_minutes, rinse_rule, safety_notes
        FROM products WHERE organization_id = $1 AND active = true ORDER BY name
      `, [organizationId]),
    ]);
    const byItem = new Map(responses.rows.map((response) => [response.item_id, response]));
    await client.query("COMMIT");
    return {
      templateName: snapshot.templateName,
      templateVersion: snapshot.templateVersion,
      items: snapshot.items.map((item) => ({
        ...item,
        value: byItem.get(item.id)?.value_json,
        reason: byItem.get(item.id)?.reason ?? undefined,
      })),
      products: products.rows.map((product) => ({
        id: product.id,
        name: product.name,
        manufacturer: product.manufacturer ?? undefined,
        instructions: product.instructions,
        contactTimeMinutes: product.contact_time_minutes ?? undefined,
        rinseRule: product.rinse_rule,
        safetyNotes: product.safety_notes ?? undefined,
      })),
    } satisfies ServiceChecklist;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture de la checklist impossible.", error);
    return undefined;
  } finally {
    client.release();
  }
}
