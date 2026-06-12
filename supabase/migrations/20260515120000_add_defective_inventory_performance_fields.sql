-- Add defective inventory status and hardware performance details for stock records.

alter table public.inventory_assets
add column if not exists cpu text,
add column if not exists gpu text,
add column if not exists ram text,
add column if not exists storage text,
add column if not exists performance_notes text;

alter table public.inventory_assets
drop constraint if exists inventory_assets_status_check;

alter table public.inventory_assets
add constraint inventory_assets_status_check
check (status in ('available', 'defective', 'assigned', 'maintenance', 'retired'));
