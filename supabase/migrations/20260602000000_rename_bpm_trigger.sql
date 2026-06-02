-- Rename trigger_table to use_case_id in bpm_workflows
ALTER TABLE bpm_workflows
  RENAME COLUMN trigger_table TO use_case_id;

-- Optionally, if it's supposed to be a UUID referencing ui_views
-- Since it was TEXT before, we cast it to UUID (assuming the existing values are UUID strings)
ALTER TABLE bpm_workflows
  ALTER COLUMN use_case_id TYPE UUID USING use_case_id::UUID;

-- Add foreign key constraint
ALTER TABLE bpm_workflows
  ADD CONSTRAINT fk_bpm_workflows_use_case
  FOREIGN KEY (use_case_id)
  REFERENCES ui_views(id)
  ON DELETE CASCADE;
