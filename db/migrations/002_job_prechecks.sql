CREATE TABLE job_prechecks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  notes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(notes) = 'object'),
  safety_confirmed boolean NOT NULL,
  anomaly_count integer NOT NULL DEFAULT 0 CHECK (anomaly_count >= 0),
  completed_by uuid NOT NULL REFERENCES profiles(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, equipment_id)
);

CREATE INDEX job_prechecks_job_idx ON job_prechecks (job_id, completed_at DESC);

ALTER TABLE job_prechecks ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON job_prechecks
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());
