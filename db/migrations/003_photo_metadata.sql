ALTER TABLE photos
  ADD COLUMN mime_type text NOT NULL DEFAULT 'image/jpeg',
  ADD COLUMN size_bytes integer CHECK (size_bytes IS NULL OR size_bytes > 0),
  ADD COLUMN width_px integer CHECK (width_px IS NULL OR width_px > 0),
  ADD COLUMN height_px integer CHECK (height_px IS NULL OR height_px > 0),
  ADD COLUMN active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX photos_active_slot_idx
  ON photos (job_id, equipment_id, photo_type)
  WHERE active = true AND equipment_id IS NOT NULL;
