-- Phase 0: the seller's uploaded artwork library.
-- Pixels live in storage; this table holds metadata and the storage path.

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Object path inside the private 'designs' bucket: {user_id}/{design_id}.{ext}
  storage_path text not null,
  mime_type text,
  width_px integer,
  height_px integer,
  bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists designs_user_created_idx
  on public.designs (user_id, created_at desc);

alter table public.designs enable row level security;

drop policy if exists "designs_select_own" on public.designs;
create policy "designs_select_own" on public.designs
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "designs_insert_own" on public.designs;
create policy "designs_insert_own" on public.designs
  for insert with check (auth.uid() = user_id);

drop policy if exists "designs_update_own" on public.designs;
create policy "designs_update_own" on public.designs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "designs_delete_own" on public.designs;
create policy "designs_delete_own" on public.designs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- storage: private bucket, partitioned by user id. The first path segment is
-- the ownership check, so paths must be {user_id}/{design_id}.{ext}.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('designs', 'designs', false)
on conflict (id) do nothing;

-- Garment outline images are reference data shown to every seller, so this
-- bucket is public-read and admin-write.
insert into storage.buckets (id, name, public)
values ('garments', 'garments', true)
on conflict (id) do nothing;

drop policy if exists "designs_objects_select_own" on storage.objects;
create policy "designs_objects_select_own" on storage.objects
  for select using (
    bucket_id = 'designs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "designs_objects_insert_own" on storage.objects;
create policy "designs_objects_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "designs_objects_update_own" on storage.objects;
create policy "designs_objects_update_own" on storage.objects
  for update using (
    bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "designs_objects_delete_own" on storage.objects;
create policy "designs_objects_delete_own" on storage.objects
  for delete using (
    bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "garment_objects_select_all" on storage.objects;
create policy "garment_objects_select_all" on storage.objects
  for select using (bucket_id = 'garments');

drop policy if exists "garment_objects_write_admin" on storage.objects;
create policy "garment_objects_write_admin" on storage.objects
  for all using (bucket_id = 'garments' and public.is_admin())
  with check (bucket_id = 'garments' and public.is_admin());
