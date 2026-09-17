ALTER TABLE integration_events
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN locked_at timestamptz;

ALTER TABLE integration_events
  ADD CONSTRAINT integration_events_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'dead'));

CREATE INDEX integration_events_dispatch_idx
  ON integration_events (next_attempt_at, created_at)
  WHERE status = 'pending';
