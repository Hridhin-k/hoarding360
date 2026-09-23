-- M02 V1.0: lat/lng helpers + board-images storage policies

alter table public.boards
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create or replace function public.sync_board_geo_from_latlng()
returns trigger
language plpgsql
as $$
begin
  if new.lat is not null and new.lng is not null then
    if new.lat < -90 or new.lat > 90 or new.lng < -180 or new.lng > 180 then
      raise exception 'lat/lng out of range';
    end if;
    new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  end if;
  return new;
end;
$$;

drop trigger if exists boards_sync_geo on public.boards;
create trigger boards_sync_geo
  before insert or update of lat, lng on public.boards
  for each row execute function public.sync_board_geo_from_latlng();

-- Backfill lat/lng from existing geography if any
update public.boards
set
  lat = st_y(location::geometry),
  lng = st_x(location::geometry)
where location is not null
  and (lat is null or lng is null);

-- Storage: board-images path = {organization_id}/{board_id}/{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-images',
  'board-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Clean old policies if re-run
drop policy if exists board_images_select on storage.objects;
drop policy if exists board_images_insert on storage.objects;
drop policy if exists board_images_update on storage.objects;
drop policy if exists board_images_delete on storage.objects;

create policy board_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'board-images'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy board_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'board-images'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy board_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'board-images'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy board_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'board-images'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

-- Activity helper when board is created/updated (best-effort from app; optional trigger later)
