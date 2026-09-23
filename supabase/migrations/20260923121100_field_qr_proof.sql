-- Phase 2 / V1.1 — M11 QR, M12 Proof of Display + incidents, field storage
-- Live project: harding (bzgdutrmehuojindfyxi)

-- ---------------------------------------------------------------------------
-- M11 — QR token per structure
-- ---------------------------------------------------------------------------

alter table public.boards
  add column if not exists qr_token text;

update public.boards
set qr_token = replace(gen_random_uuid()::text, '-', '')
where qr_token is null;

alter table public.boards
  alter column qr_token set not null;

create unique index if not exists boards_qr_token_uidx
  on public.boards (qr_token);

create or replace function public.boards_ensure_qr_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.qr_token is null or new.qr_token = '' then
    new.qr_token := replace(gen_random_uuid()::text, '-', '');
  end if;
  return new;
end;
$$;

drop trigger if exists boards_qr_token_bi on public.boards;
create trigger boards_qr_token_bi
  before insert on public.boards
  for each row execute function public.boards_ensure_qr_token();

-- Distance from board location to a captured point (metres)
create or replace function public.board_distance_m(
  p_board_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns double precision
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when b.location is null then null
    else st_distance(
      b.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    )
  end
  from public.boards b
  where b.id = p_board_id
    and b.deleted_at is null;
$$;

revoke all on function public.board_distance_m(uuid, double precision, double precision) from public;
grant execute on function public.board_distance_m(uuid, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- M12 — Proof of Display
-- ---------------------------------------------------------------------------

create table if not exists public.proof_of_display (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid not null references public.boards (id),
  face_id uuid references public.board_faces (id),
  captured_by uuid not null references auth.users (id),
  captured_at timestamptz not null default timezone('utc', now()),
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  distance_m double precision,
  geo_ok boolean not null default false,
  photo_storage_path text not null,
  notes text,
  client_offline_id text,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  constraint proof_geo_range check (
    lat between -90 and 90 and lng between -180 and 180
  )
);

create unique index if not exists proof_offline_id_uidx
  on public.proof_of_display (organization_id, client_offline_id)
  where client_offline_id is not null and deleted_at is null;

create index if not exists proof_board_idx
  on public.proof_of_display (board_id, captured_at desc)
  where deleted_at is null;

alter table public.proof_of_display enable row level security;

drop policy if exists proof_all on public.proof_of_display;
create policy proof_all on public.proof_of_display
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create or replace function public.proof_of_display_set_geo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d double precision;
begin
  d := public.board_distance_m(new.board_id, new.lat, new.lng);
  new.distance_m := d;
  new.geo_ok := (d is not null and d <= 150);
  return new;
end;
$$;

drop trigger if exists proof_geo_bi on public.proof_of_display;
create trigger proof_geo_bi
  before insert or update of lat, lng, board_id on public.proof_of_display
  for each row execute function public.proof_of_display_set_geo();

-- ---------------------------------------------------------------------------
-- Incidents lifecycle
-- ---------------------------------------------------------------------------

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid not null references public.boards (id),
  face_id uuid references public.board_faces (id),
  reported_by uuid references auth.users (id),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'in_progress', 'resolved', 'closed')),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null default 'other',
  title text not null,
  description text,
  photo_storage_path text,
  lat double precision,
  lng double precision,
  client_offline_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text
);

create unique index if not exists incidents_offline_id_uidx
  on public.incidents (organization_id, client_offline_id)
  where client_offline_id is not null and deleted_at is null;

create index if not exists incidents_board_idx
  on public.incidents (board_id, created_at desc)
  where deleted_at is null;

create trigger incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

alter table public.incidents enable row level security;

drop policy if exists incidents_all on public.incidents;
create policy incidents_all on public.incidents
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

-- Lookup board by QR token (org-scoped via RLS on boards)
create or replace function public.lookup_board_by_qr(p_token text)
returns table (
  id uuid,
  organization_id uuid,
  board_code text,
  name text,
  city text,
  road_name text,
  lat double precision,
  lng double precision,
  qr_token text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    b.id,
    b.organization_id,
    b.board_code,
    b.name,
    b.city,
    b.road_name,
    b.lat,
    b.lng,
    b.qr_token
  from public.boards b
  where b.qr_token = trim(p_token)
    and b.deleted_at is null
  limit 1;
$$;

revoke all on function public.lookup_board_by_qr(text) from public;
grant execute on function public.lookup_board_by_qr(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: field-proofs path = {organization_id}/{board_id}/{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'field-proofs',
  'field-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists field_proofs_select on storage.objects;
drop policy if exists field_proofs_insert on storage.objects;
drop policy if exists field_proofs_update on storage.objects;
drop policy if exists field_proofs_delete on storage.objects;

create policy field_proofs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'field-proofs'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy field_proofs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'field-proofs'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy field_proofs_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'field-proofs'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy field_proofs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'field-proofs'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );
