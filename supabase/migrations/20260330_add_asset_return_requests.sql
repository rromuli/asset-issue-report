-- Employee asset return confirmation workflow table.
-- Run in Supabase SQL Editor (or your migration pipeline).

create table if not exists public.asset_return_requests (
  id bigserial primary key,
  asset_id bigint references public.employee_assets(id) on delete set null,
  employee_email text not null,
  employee_name text,
  asset_name text not null,
  asset_type text,
  asset_tag text,
  serial_number text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_return_requests_status
  on public.asset_return_requests(status);

create index if not exists idx_asset_return_requests_requested_at_desc
  on public.asset_return_requests(requested_at desc);

create index if not exists idx_asset_return_requests_employee_email
  on public.asset_return_requests(employee_email);

create index if not exists idx_asset_return_requests_asset_id
  on public.asset_return_requests(asset_id);
