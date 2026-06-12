CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id            bigserial PRIMARY KEY,
  employee_email text NOT NULL,
  employee_name  text,
  department     text,
  created_by     text NOT NULL,
  notes          text,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

CREATE TABLE IF NOT EXISTS onboarding_checklist_items (
  id               bigserial PRIMARY KEY,
  checklist_id     bigint NOT NULL
                     REFERENCES onboarding_checklists(id) ON DELETE CASCADE,
  item_description text NOT NULL,
  item_type        text NOT NULL DEFAULT 'other'
                     CHECK (item_type IN ('asset', 'software', 'access', 'other')),
  asset_tag        text,
  serial_number    text,
  signed_off_at    timestamptz,
  signed_off_by    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE onboarding_checklists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklist_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_access_onboarding_checklists"
  ON onboarding_checklists FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "open_access_onboarding_checklist_items"
  ON onboarding_checklist_items FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_onboarding_checklists_employee_email
  ON onboarding_checklists (employee_email);

CREATE INDEX idx_onboarding_checklists_status
  ON onboarding_checklists (status);

CREATE INDEX idx_onboarding_checklist_items_checklist_id
  ON onboarding_checklist_items (checklist_id);
