ALTER TABLE asset_issue_reports
  ADD COLUMN IF NOT EXISTS sla_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_asset_issue_reports_sla_notified
  ON asset_issue_reports (sla_notified_at)
  WHERE sla_notified_at IS NULL;
