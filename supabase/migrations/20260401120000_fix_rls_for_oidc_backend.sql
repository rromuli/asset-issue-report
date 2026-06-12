-- RLS alignment for custom OIDC backend auth flow.
-- In this architecture, frontend requests use Supabase anon/authenticated roles
-- without Supabase Auth session uid claims, so strict auth.uid() policies block inserts.

-- =========================
-- employee_assets
-- =========================
alter table public.employee_assets enable row level security;

grant select, insert, update, delete on public.employee_assets to anon, authenticated;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'employee_assets'
  loop
    execute format('drop policy if exists %I on public.employee_assets', p.policyname);
  end loop;
end $$;

create policy employee_assets_select_all
on public.employee_assets
for select
to anon, authenticated
using (true);

create policy employee_assets_insert_all
on public.employee_assets
for insert
to anon, authenticated
with check (true);

create policy employee_assets_update_all
on public.employee_assets
for update
to anon, authenticated
using (true)
with check (true);

create policy employee_assets_delete_all
on public.employee_assets
for delete
to anon, authenticated
using (true);

-- =========================
-- asset_issue_reports
-- =========================
alter table public.asset_issue_reports enable row level security;

grant select, insert, update, delete on public.asset_issue_reports to anon, authenticated;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'asset_issue_reports'
  loop
    execute format('drop policy if exists %I on public.asset_issue_reports', p.policyname);
  end loop;
end $$;

create policy asset_issue_reports_select_all
on public.asset_issue_reports
for select
to anon, authenticated
using (true);

create policy asset_issue_reports_insert_all
on public.asset_issue_reports
for insert
to anon, authenticated
with check (true);

create policy asset_issue_reports_update_all
on public.asset_issue_reports
for update
to anon, authenticated
using (true)
with check (true);

create policy asset_issue_reports_delete_all
on public.asset_issue_reports
for delete
to anon, authenticated
using (true);

-- =========================
-- asset_return_requests
-- =========================
alter table public.asset_return_requests enable row level security;

grant select, insert, update, delete on public.asset_return_requests to anon, authenticated;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'asset_return_requests'
  loop
    execute format('drop policy if exists %I on public.asset_return_requests', p.policyname);
  end loop;
end $$;

create policy asset_return_requests_select_all
on public.asset_return_requests
for select
to anon, authenticated
using (true);

create policy asset_return_requests_insert_all
on public.asset_return_requests
for insert
to anon, authenticated
with check (true);

create policy asset_return_requests_update_all
on public.asset_return_requests
for update
to anon, authenticated
using (true)
with check (true);

create policy asset_return_requests_delete_all
on public.asset_return_requests
for delete
to anon, authenticated
using (true);

-- =========================
-- asset_issue_attachments
-- =========================
alter table public.asset_issue_attachments enable row level security;

grant select, insert, update, delete on public.asset_issue_attachments to anon, authenticated;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'asset_issue_attachments'
  loop
    execute format('drop policy if exists %I on public.asset_issue_attachments', p.policyname);
  end loop;
end $$;

create policy asset_issue_attachments_select_all
on public.asset_issue_attachments
for select
to anon, authenticated
using (true);

create policy asset_issue_attachments_insert_all
on public.asset_issue_attachments
for insert
to anon, authenticated
with check (true);

create policy asset_issue_attachments_update_all
on public.asset_issue_attachments
for update
to anon, authenticated
using (true)
with check (true);

create policy asset_issue_attachments_delete_all
on public.asset_issue_attachments
for delete
to anon, authenticated
using (true);

-- =========================
-- Storage: asset-photos + attachments
-- =========================
grant select, insert, update, delete on storage.objects to anon, authenticated;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'storage_asset_photos_select',
        'storage_asset_photos_insert',
        'storage_asset_photos_update',
        'storage_asset_photos_delete',
        'storage_attachments_select',
        'storage_attachments_insert',
        'storage_attachments_update',
        'storage_attachments_delete'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy storage_asset_photos_select
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'asset-photos');

create policy storage_asset_photos_insert
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'asset-photos');

create policy storage_asset_photos_update
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'asset-photos')
with check (bucket_id = 'asset-photos');

create policy storage_asset_photos_delete
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'asset-photos');

create policy storage_attachments_select
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'attachments');

create policy storage_attachments_insert
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'attachments');

create policy storage_attachments_update
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'attachments')
with check (bucket_id = 'attachments');

create policy storage_attachments_delete
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'attachments');
