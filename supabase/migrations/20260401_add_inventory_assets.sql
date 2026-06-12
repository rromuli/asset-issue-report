-- Central inventory assets table for admin IT stock management and report assignment.

create table if not exists public.inventory_assets (
  id bigserial primary key,
  asset_name text not null,
  asset_type text not null,
  serial_number text,
  asset_tag text,
  make_model text,
  condition_notes text,
  status text not null default 'available' check (status in ('available', 'assigned', 'maintenance', 'retired')),
  assigned_report_id bigint references public.asset_issue_reports(id) on delete set null,
  assigned_employee_name text,
  assigned_employee_identifier text,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_assets_status
  on public.inventory_assets(status);

create index if not exists idx_inventory_assets_created_at_desc
  on public.inventory_assets(created_at desc);

create index if not exists idx_inventory_assets_asset_type
  on public.inventory_assets(asset_type);

create index if not exists idx_inventory_assets_asset_tag
  on public.inventory_assets(asset_tag);

create index if not exists idx_inventory_assets_serial_number
  on public.inventory_assets(serial_number);

create or replace function public.set_inventory_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_inventory_assets_updated_at on public.inventory_assets;
create trigger trg_inventory_assets_updated_at
before update on public.inventory_assets
for each row
execute function public.set_inventory_assets_updated_at();

alter table public.inventory_assets enable row level security;

grant select, insert, update, delete on public.inventory_assets to anon, authenticated;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'inventory_assets'
  loop
    execute format('drop policy if exists %I on public.inventory_assets', p.policyname);
  end loop;
end $$;

create policy inventory_assets_select_all
on public.inventory_assets
for select
to anon, authenticated
using (true);

create policy inventory_assets_insert_all
on public.inventory_assets
for insert
to anon, authenticated
with check (true);

create policy inventory_assets_update_all
on public.inventory_assets
for update
to anon, authenticated
using (true)
with check (true);

create policy inventory_assets_delete_all
on public.inventory_assets
for delete
to anon, authenticated
using (true);
