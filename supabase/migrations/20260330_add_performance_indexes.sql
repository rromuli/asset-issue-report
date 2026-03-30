-- Performance indexes for dashboard/list queries.
-- Run once in Supabase SQL Editor (or via Supabase migrations pipeline).

create index if not exists idx_asset_issue_reports_status
  on public.asset_issue_reports (status);

create index if not exists idx_asset_issue_reports_approval_status
  on public.asset_issue_reports (approval_status);

create index if not exists idx_asset_issue_reports_created_at_desc
  on public.asset_issue_reports (created_at desc);

create index if not exists idx_asset_issue_reports_employee_id
  on public.asset_issue_reports (employee_id);

create index if not exists idx_asset_issue_reports_severity
  on public.asset_issue_reports (severity);

create index if not exists idx_asset_issue_attachments_report_id
  on public.asset_issue_attachments (report_id);

create index if not exists idx_employee_assets_created_at_desc
  on public.employee_assets (created_at desc);
