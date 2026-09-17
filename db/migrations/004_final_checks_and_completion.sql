CREATE TABLE job_final_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  notes text,
  passed boolean NOT NULL,
  incident_id uuid REFERENCES incidents(id),
  completed_by uuid NOT NULL REFERENCES profiles(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, equipment_id)
);

CREATE TABLE job_completion_details (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  client_informed boolean NOT NULL,
  review_allowed boolean NOT NULL DEFAULT false,
  completed_by uuid NOT NULL REFERENCES profiles(id),
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_final_checks_job_idx ON job_final_checks (job_id, completed_at DESC);

ALTER TABLE job_final_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON job_final_checks
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

ALTER TABLE job_completion_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON job_completion_details
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());
