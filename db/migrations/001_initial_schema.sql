CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'operations', 'technician', 'subcontractor', 'sales');
CREATE TYPE job_status AS ENUM ('draft', 'needs_qualification', 'scheduled', 'assigned', 'en_route', 'arrived', 'in_progress', 'blocked', 'completed_pending_payment', 'completed', 'cancelled', 'no_show', 'interrupted');
CREATE TYPE payment_status AS ENUM ('not_required', 'pending', 'paid_cash', 'paid_card', 'paid_transfer', 'payment_link_sent', 'failed', 'refunded');
CREATE TYPE incident_severity AS ENUM ('information', 'minor', 'critical');
CREATE TYPE incident_status AS ENUM ('open', 'in_review', 'action_required', 'resolved', 'closed_no_action');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  email text NOT NULL,
  role user_role NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE TABLE technician_profiles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id),
  worker_type text NOT NULL CHECK (worker_type IN ('internal', 'subcontractor')),
  company_name text,
  registration_number text,
  notes text,
  document_expiry_at date
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_type text NOT NULL CHECK (customer_type IN ('individual', 'company')),
  name text NOT NULL,
  phone text,
  email text,
  lead_source text,
  twenty_id text,
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  label text,
  address_line1 text NOT NULL,
  address_line2 text,
  postal_code text NOT NULL,
  city text NOT NULL,
  site_type text NOT NULL DEFAULT 'home',
  access_notes text,
  contact_name text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  site_id uuid NOT NULL REFERENCES sites(id),
  public_code text NOT NULL,
  equipment_type text NOT NULL DEFAULT 'wall_split',
  brand text,
  model text,
  serial_number text,
  room text NOT NULL,
  difficulty text CHECK (difficulty IN ('simple', 'medium', 'complex')),
  internal_notes text,
  qr_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, public_code)
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  public_code text NOT NULL,
  site_id uuid NOT NULL REFERENCES sites(id),
  primary_technician_id uuid REFERENCES profiles(id),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status job_status NOT NULL DEFAULT 'draft',
  service_type text NOT NULL,
  notes text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  payment_status payment_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  next_followup_at timestamptz,
  review_request_sent_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, public_code),
  CHECK (completed_at IS NULL OR started_at IS NOT NULL)
);

CREATE TABLE job_equipment (
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id),
  sequence smallint NOT NULL CHECK (sequence > 0),
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  result text,
  PRIMARY KEY (job_id, equipment_id),
  UNIQUE (job_id, sequence)
);

CREATE TABLE checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  service_type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name, version)
);

CREATE TABLE checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  response_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  critical_required boolean NOT NULL DEFAULT false,
  required_or_reason boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL,
  condition_json jsonb,
  UNIQUE (template_id, code)
);

CREATE TABLE job_checklist_snapshots (
  job_id uuid PRIMARY KEY REFERENCES jobs(id),
  template_id uuid NOT NULL REFERENCES checklist_templates(id),
  template_version integer NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES equipment(id),
  item_id uuid NOT NULL REFERENCES checklist_items(id),
  value_json jsonb NOT NULL,
  reason text,
  user_id uuid NOT NULL REFERENCES profiles(id),
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, equipment_id, item_id)
);

CREATE TABLE incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  public_code text NOT NULL,
  job_id uuid NOT NULL REFERENCES jobs(id),
  equipment_id uuid REFERENCES equipment(id),
  incident_type text NOT NULL,
  moment text NOT NULL CHECK (moment IN ('before', 'during', 'after')),
  severity incident_severity NOT NULL,
  status incident_status NOT NULL DEFAULT 'open',
  description text NOT NULL,
  client_informed_at timestamptz,
  closure_override boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES profiles(id),
  resolved_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (organization_id, public_code)
);

CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  job_id uuid NOT NULL REFERENCES jobs(id),
  equipment_id uuid REFERENCES equipment(id),
  incident_id uuid REFERENCES incidents(id),
  photo_type text NOT NULL,
  storage_path text NOT NULL,
  source text NOT NULL CHECK (source IN ('technician', 'client', 'admin')),
  captured_at timestamptz NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  manufacturer text,
  instructions text NOT NULL,
  contact_time_minutes integer CHECK (contact_time_minutes >= 0),
  rinse_rule text NOT NULL,
  safety_notes text,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE product_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id),
  equipment_id uuid REFERENCES equipment(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity_ml integer CHECK (quantity_ml >= 0)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  job_id uuid NOT NULL REFERENCES jobs(id),
  method text NOT NULL,
  status payment_status NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  provider text,
  external_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_id uuid REFERENCES profiles(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  event_type text NOT NULL,
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX jobs_technician_schedule_idx ON jobs (primary_technician_id, scheduled_start);
CREATE INDEX jobs_site_schedule_idx ON jobs (site_id, scheduled_start DESC);
CREATE INDEX equipment_site_idx ON equipment (site_id);
CREATE INDEX photos_job_equipment_type_idx ON photos (job_id, equipment_id, photo_type);
CREATE INDEX incidents_status_severity_idx ON incidents (status, severity);
CREATE INDEX integration_events_status_created_idx ON integration_events (status, created_at);
CREATE INDEX customers_phone_idx ON customers (organization_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX customers_email_idx ON customers (organization_id, lower(email)) WHERE email IS NOT NULL;

CREATE FUNCTION current_organization_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles','customers','sites','equipment','jobs','checklist_templates','incidents','photos','products','payments','audit_logs','integration_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY organization_isolation ON %I USING (organization_id = current_organization_id()) WITH CHECK (organization_id = current_organization_id())', table_name);
  END LOOP;
END $$;
