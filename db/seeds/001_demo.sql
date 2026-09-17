INSERT INTO organizations (id, name)
VALUES ('10000000-0000-4000-8000-000000000001', 'Clim Air Services')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO profiles (id, organization_id, email, role, first_name, last_name, phone)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'emma@clim-air.local', 'admin', 'Emma', 'Martin', '0600000000'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'thomas@clim-air.local', 'technician', 'Thomas', 'Renard', '0600000001'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'nora@clim-air.local', 'technician', 'Nora', 'Bensaid', '0600000002'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'leo@clim-air.local', 'technician', 'Leo', 'Marchand', '0600000003')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  active = true;

INSERT INTO technician_profiles (user_id, worker_type, document_expiry_at)
VALUES
  ('20000000-0000-4000-8000-000000000002', 'internal', '2027-04-30'),
  ('20000000-0000-4000-8000-000000000003', 'internal', '2027-08-31'),
  ('20000000-0000-4000-8000-000000000004', 'subcontractor', '2026-09-29')
ON CONFLICT (user_id) DO UPDATE SET
  worker_type = EXCLUDED.worker_type,
  document_expiry_at = EXCLUDED.document_expiry_at;

INSERT INTO customers (id, organization_id, customer_type, name, phone, email)
VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'individual', 'Maison Lenoir', '0611111111', 'lenoir@example.test'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'individual', 'Camille Dupont', '0622222222', 'camille@example.test'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'company', 'Cabinet Rivoli', '0633333333', 'contact@rivoli.example'),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'individual', 'Sarah Martin', '0644444444', 'sarah@example.test'),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'company', 'Atelier Voltaire', '0655555555', 'atelier@voltaire.example')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email;

INSERT INTO sites (id, organization_id, customer_id, label, address_line1, postal_code, city, site_type, access_notes)
VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Domicile', '18 rue des Mazieres', '91000', 'Evry-Courcouronnes', 'home', null),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Domicile', '7 avenue Carnot', '91100', 'Corbeil-Essonnes', 'home', 'Acces par la cour. Interphone 24B.'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'Cabinet', '34 rue de Rivoli', '75001', 'Paris 1er', 'office', null),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'Domicile', '5 allee du Japon', '91300', 'Massy', 'home', 'Stationnement au parking visiteurs.'),
  ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', 'Atelier', '81 boulevard Voltaire', '75011', 'Paris 11e', 'office', null)
ON CONFLICT (id) DO UPDATE SET access_notes = EXCLUDED.access_notes;

INSERT INTO equipment (id, organization_id, site_id, public_code, brand, model, room, difficulty)
VALUES
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'EQ-0001', 'Daikin', 'Perfera', 'Salon', 'simple'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'EQ-0002', 'Daikin', 'Perfera', 'Chambre', 'simple'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'EQ-0003', 'Mitsubishi', 'MSZ-AP', 'Salon', 'medium'),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'EQ-0004', 'Toshiba', 'Seiya', 'Accueil', 'simple'),
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'EQ-0005', 'Toshiba', 'Seiya', 'Bureau 1', 'medium'),
  ('50000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'EQ-0006', 'Toshiba', 'Seiya', 'Salle de reunion', 'complex'),
  ('50000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 'EQ-0007', 'Atlantic', 'Takao', 'Salon', 'simple'),
  ('50000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 'EQ-0008', 'Atlantic', 'Takao', 'Chambre', 'simple'),
  ('50000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', 'EQ-0009', 'Panasonic', 'TZ', 'Atelier', 'medium')
ON CONFLICT (id) DO UPDATE SET room = EXCLUDED.room, difficulty = EXCLUDED.difficulty;

INSERT INTO jobs (id, organization_id, public_code, site_id, primary_technician_id, scheduled_start, scheduled_end, status, service_type, notes, price_cents, payment_status, started_at, completed_at)
VALUES
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'INT-2026-000123', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '2026-09-17 08:30:00+02', '2026-09-17 10:15:00+02', 'completed', 'deep_clean', null, 15900, 'paid_card', '2026-09-17 08:32:00+02', '2026-09-17 10:08:00+02'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'INT-2026-000124', '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '2026-09-17 10:45:00+02', '2026-09-17 12:00:00+02', 'in_progress', 'maintenance', 'Acces par la cour. Interphone 24B.', 9900, 'pending', '2026-09-17 10:48:00+02', null),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'INT-2026-000125', '40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '2026-09-17 11:30:00+02', '2026-09-17 13:45:00+02', 'blocked', 'deep_clean', null, 24900, 'not_required', '2026-09-17 11:34:00+02', null),
  ('60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'INT-2026-000126', '40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', '2026-09-17 14:00:00+02', '2026-09-17 15:30:00+02', 'en_route', 'maintenance', 'Stationnement au parking visiteurs.', 15900, 'pending', null, null),
  ('60000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'INT-2026-000127', '40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', '2026-09-17 16:15:00+02', '2026-09-17 17:30:00+02', 'scheduled', 'maintenance', null, 11900, 'not_required', null, null)
ON CONFLICT (id) DO UPDATE SET
  scheduled_start = EXCLUDED.scheduled_start,
  scheduled_end = EXCLUDED.scheduled_end,
  status = EXCLUDED.status,
  price_cents = EXCLUDED.price_cents,
  payment_status = EXCLUDED.payment_status,
  started_at = EXCLUDED.started_at,
  completed_at = EXCLUDED.completed_at;

INSERT INTO job_equipment (job_id, equipment_id, sequence, status)
VALUES
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'completed'),
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 2, 'completed'),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', 1, 'in_progress'),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000004', 1, 'completed'),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000005', 2, 'completed'),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000006', 3, 'blocked'),
  ('60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000007', 1, 'pending'),
  ('60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000008', 2, 'pending'),
  ('60000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000009', 1, 'pending')
ON CONFLICT (job_id, equipment_id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO incidents (id, organization_id, public_code, job_id, equipment_id, incident_type, moment, severity, status, description, client_informed_at, created_by)
VALUES ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'INC-2026-000018', '60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000006', 'access', 'during', 'critical', 'action_required', 'Acces impossible a l''unite de la salle de reunion', '2026-09-17 11:52:00+02', '20000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description;

INSERT INTO checklist_templates (id, organization_id, name, version, service_type, active)
VALUES
  ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Nettoyage standard', 1, 'maintenance', true),
  ('80000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Nettoyage approfondi', 1, 'deep_clean', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  service_type = EXCLUDED.service_type,
  active = EXCLUDED.active;

INSERT INTO checklist_items (id, template_id, code, label, response_type, required, critical_required, required_or_reason, order_index, condition_json)
SELECT
  (CASE source.code
    WHEN 'protection_zone' THEN '81000000-0000-4000-8000-000000000001'
    WHEN 'tarp_installed' THEN '81000000-0000-4000-8000-000000000002'
    WHEN 'electronics_protected' THEN '81000000-0000-4000-8000-000000000003'
    WHEN 'filters_cleaned' THEN '81000000-0000-4000-8000-000000000004'
    WHEN 'dry_dusting' THEN '81000000-0000-4000-8000-000000000005'
    WHEN 'product_applied' THEN '81000000-0000-4000-8000-000000000006'
    WHEN 'contact_time' THEN '81000000-0000-4000-8000-000000000007'
    WHEN 'coil_cleaned' THEN '81000000-0000-4000-8000-000000000008'
    WHEN 'blower_cleaned' THEN '81000000-0000-4000-8000-000000000009'
    WHEN 'drain_pan' THEN '81000000-0000-4000-8000-000000000010'
    WHEN 'rinsing' THEN '81000000-0000-4000-8000-000000000011'
    WHEN 'plastics_cleaned' THEN '81000000-0000-4000-8000-000000000012'
    WHEN 'drying' THEN '81000000-0000-4000-8000-000000000013'
    ELSE '81000000-0000-4000-8000-000000000014'
  END)::uuid,
  template.id,
  source.code,
  source.label,
  source.response_type,
  source.required,
  source.critical_required,
  source.required_or_reason,
  source.order_index,
  source.condition_json::jsonb
FROM checklist_templates template
CROSS JOIN (VALUES
  ('protection_zone', 'Protéger la zone de travail', 'choice', true, false, false, 1, '{"options":["Fait","Non applicable"]}'),
  ('tarp_installed', 'Installer la bâche de protection', 'choice', true, true, false, 2, '{"options":["Fait"]}'),
  ('electronics_protected', 'Protéger les composants électroniques', 'choice', true, true, false, 3, '{"options":["Fait"]}'),
  ('filters_cleaned', 'Nettoyer et désinfecter les filtres', 'choice', true, false, false, 4, '{"options":["Fait","Remplacés"]}'),
  ('dry_dusting', 'Effectuer le dépoussiérage à sec', 'choice', true, false, false, 5, '{"options":["Fait"]}'),
  ('product_applied', 'Appliquer le produit de nettoyage', 'product', true, false, false, 6, '{}'),
  ('contact_time', 'Respecter le temps de contact', 'choice', true, true, false, 7, '{"options":["Fait"]}'),
  ('coil_cleaned', 'Nettoyer l’échangeur', 'choice', true, false, false, 8, '{"options":["Fait","Partiel"]}'),
  ('blower_cleaned', 'Nettoyer la turbine', 'choice', true, false, true, 9, '{"options":["Fait","Partiel","Non accessible"]}'),
  ('drain_pan', 'Nettoyer le bac à condensats et l’évacuation', 'choice', true, false, true, 10, '{"options":["Fait","Partiel","Non accessible"]}'),
  ('rinsing', 'Rincer conformément à la fiche produit', 'choice', true, false, false, 11, '{"options":["Fait","Sans rinçage"]}'),
  ('plastics_cleaned', 'Nettoyer les plastiques et le capot', 'choice', true, false, false, 12, '{"options":["Fait"]}'),
  ('drying', 'Sécher les éléments avant remontage', 'choice', true, false, false, 13, '{"options":["Fait"]}'),
  ('final_visual_inspection', 'Réaliser le contrôle visuel final', 'choice', true, true, false, 14, '{"options":["Fait"]}')
) AS source(code, label, response_type, required, critical_required, required_or_reason, order_index, condition_json)
WHERE template.id = '80000000-0000-4000-8000-000000000001'
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  response_type = EXCLUDED.response_type,
  required = EXCLUDED.required,
  critical_required = EXCLUDED.critical_required,
  required_or_reason = EXCLUDED.required_or_reason,
  order_index = EXCLUDED.order_index,
  condition_json = EXCLUDED.condition_json;

INSERT INTO products (id, organization_id, name, manufacturer, instructions, contact_time_minutes, rinse_rule, safety_notes, active)
VALUES ('82000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Clima-Net', 'Clim Air Services', 'Pulvériser uniformément sur les surfaces après dépoussiérage. Ne pas appliquer sur les composants électroniques.', 5, 'Rincer à l’eau claire après le temps de contact.', 'Porter des gants et des lunettes. Ventiler la pièce pendant l’utilisation.', true)
ON CONFLICT (id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  contact_time_minutes = EXCLUDED.contact_time_minutes,
  rinse_rule = EXCLUDED.rinse_rule,
  safety_notes = EXCLUDED.safety_notes,
  active = EXCLUDED.active;
