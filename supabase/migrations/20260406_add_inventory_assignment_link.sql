alter table public.inventory_assets
add column if not exists assigned_employee_email text,
add column if not exists assigned_employee_asset_id bigint references public.employee_assets(id) on delete set null;

create index if not exists idx_inventory_assets_assigned_employee_email
  on public.inventory_assets(assigned_employee_email);

create index if not exists idx_inventory_assets_assigned_employee_asset_id
  on public.inventory_assets(assigned_employee_asset_id);
