-- Phase 3 / V2.0 plumbing — M25 marketplace publishable projection
-- Live project: harding (bzgdutrmehuojindfyxi)
-- Public reads projection only — never floor rates, costs, or client names.

create table if not exists public.organization_marketplace_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  marketplace_enabled boolean not null default false,
  public_display_name text,
  default_price_on_request boolean not null default false,
  accept_enquiries boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id)
);

alter table public.organization_marketplace_settings enable row level security;

drop policy if exists org_market_settings_all on public.organization_marketplace_settings;
create policy org_market_settings_all on public.organization_marketplace_settings
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

alter table public.board_faces
  add column if not exists price_on_request boolean not null default false,
  add column if not exists market_title text,
  add column if not exists market_blurb text,
  add column if not exists published_at timestamptz;

-- Denormalised / publishable projection (hot path for Market)
create table if not exists public.marketplace_listings (
  face_id uuid primary key references public.board_faces (id),
  board_id uuid not null references public.boards (id),
  organization_id uuid not null references public.organizations (id),
  is_listed boolean not null default false,
  listing_slug text not null,
  public_owner_name text,
  board_code text not null,
  board_name text not null,
  city text,
  state text,
  road_name text,
  lat double precision,
  lng double precision,
  face_label text not null,
  width_ft numeric(8, 2),
  height_ft numeric(8, 2),
  area_sqft numeric(12, 2),
  illumination text,
  facing_direction text,
  -- Card rate only; floor/costs never projected
  card_rate_paise bigint,
  price_on_request boolean not null default false,
  occupancy_status text,
  available_from date,
  available_label text,
  cover_storage_path text,
  photo_captured_at timestamptz,
  compliance_ok boolean not null default false,
  photo_fresh boolean not null default false,
  market_title text,
  market_blurb text,
  published_at timestamptz,
  refreshed_at timestamptz not null default timezone('utc', now())
);

create index if not exists marketplace_listings_listed_idx
  on public.marketplace_listings (is_listed, city)
  where is_listed = true;

create index if not exists marketplace_listings_geo_idx
  on public.marketplace_listings (lat, lng)
  where is_listed = true and lat is not null;

create unique index if not exists marketplace_listings_slug_uidx
  on public.marketplace_listings (listing_slug);

alter table public.marketplace_listings enable row level security;

grant select on public.marketplace_listings to anon, authenticated;

-- Public can read listed rows only (anon + authenticated)
drop policy if exists marketplace_listings_public_select on public.marketplace_listings;
create policy marketplace_listings_public_select on public.marketplace_listings
  for select to anon, authenticated
  using (is_listed = true);

-- Owners can see all their projection rows (including unpublished drafts in projection)
drop policy if exists marketplace_listings_owner_select on public.marketplace_listings;
create policy marketplace_listings_owner_select on public.marketplace_listings
  for select to authenticated
  using (organization_id in (select public.current_user_org_ids()));

create or replace function public.face_compliance_ok(p_board_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select not exists (
    select 1
    from public.compliance_records c
    where c.board_id = p_board_id
      and c.deleted_at is null
      and c.is_mandatory = true
      and c.status = 'expired'
  )
  and exists (
    select 1
    from public.compliance_records c
    where c.board_id = p_board_id
      and c.deleted_at is null
      and c.is_mandatory = true
      and c.status in ('valid', 'expiring_soon', 'under_renewal')
  );
$$;

create or replace function public.refresh_marketplace_listing(p_face_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  b record;
  o record;
  s public.organization_marketplace_settings%rowtype;
  v_photo_path text;
  v_photo_at timestamptz;
  v_compliance_ok boolean;
  v_photo_fresh boolean;
  v_listed boolean;
  v_slug text;
  v_owner text;
  v_por boolean;
  v_rate bigint;
  v_available_label text;
begin
  select * into f
  from public.board_faces
  where id = p_face_id and deleted_at is null;

  if not found then
    delete from public.marketplace_listings where face_id = p_face_id;
    return;
  end if;

  select * into b
  from public.boards
  where id = f.board_id and deleted_at is null;

  if not found then
    delete from public.marketplace_listings where face_id = p_face_id;
    return;
  end if;

  select * into o from public.organizations where id = f.organization_id;
  select * into s from public.organization_marketplace_settings where organization_id = f.organization_id;

  v_compliance_ok := public.face_compliance_ok(b.id);

  select storage_path, captured_at
  into v_photo_path, v_photo_at
  from public.board_photos
  where board_id = b.id
    and deleted_at is null
  order by is_cover desc, captured_at desc nulls last
  limit 1;

  v_photo_fresh := v_photo_at is not null
    and v_photo_at >= (timezone('utc', now()) - interval '12 months');

  v_por := coalesce(f.price_on_request, false)
    or coalesce(s.default_price_on_request, false);
  v_rate := case when v_por then null else f.card_rate_paise end;

  if f.available_from is not null and f.available_from > public.ist_today() then
    v_available_label := 'Available from ' || to_char(f.available_from, 'DD-MM-YYYY');
  elsif f.occupancy_status::text in ('vacant', 'becoming_vacant') then
    v_available_label := 'Available now';
  else
    v_available_label := initcap(replace(f.occupancy_status::text, '_', ' '));
  end if;

  v_listed :=
    coalesce(s.marketplace_enabled, false)
    and f.is_publishable
    and b.lifecycle_status = 'active'
    and o.suspended_at is null
    and o.deleted_at is null
    and v_compliance_ok
    and b.lat is not null
    and b.lng is not null
    and v_photo_path is not null;

  v_slug := lower(regexp_replace(
    coalesce(nullif(b.city, ''), 'india') || '-' || b.board_code || '-' || f.face_label,
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  ));
  v_owner := coalesce(nullif(s.public_display_name, ''), o.name);

  insert into public.marketplace_listings as ml (
    face_id, board_id, organization_id, is_listed, listing_slug,
    public_owner_name, board_code, board_name, city, state, road_name,
    lat, lng, face_label, width_ft, height_ft, area_sqft, illumination,
    facing_direction, card_rate_paise, price_on_request, occupancy_status,
    available_from, available_label, cover_storage_path, photo_captured_at,
    compliance_ok, photo_fresh, market_title, market_blurb, published_at, refreshed_at
  ) values (
    f.id, b.id, f.organization_id, v_listed, v_slug,
    v_owner, b.board_code, b.name, b.city, b.state, b.road_name,
    b.lat, b.lng, f.face_label, f.width_ft, f.height_ft, f.area_sqft,
    f.illumination::text, f.facing_direction, v_rate, v_por,
    f.occupancy_status::text, f.available_from, v_available_label,
    v_photo_path, v_photo_at, v_compliance_ok, v_photo_fresh,
    coalesce(f.market_title, b.name || ' · Face ' || f.face_label),
    f.market_blurb,
    case when v_listed then coalesce(f.published_at, timezone('utc', now())) else f.published_at end,
    timezone('utc', now())
  )
  on conflict (face_id) do update set
    board_id = excluded.board_id,
    organization_id = excluded.organization_id,
    is_listed = excluded.is_listed,
    listing_slug = excluded.listing_slug,
    public_owner_name = excluded.public_owner_name,
    board_code = excluded.board_code,
    board_name = excluded.board_name,
    city = excluded.city,
    state = excluded.state,
    road_name = excluded.road_name,
    lat = excluded.lat,
    lng = excluded.lng,
    face_label = excluded.face_label,
    width_ft = excluded.width_ft,
    height_ft = excluded.height_ft,
    area_sqft = excluded.area_sqft,
    illumination = excluded.illumination,
    facing_direction = excluded.facing_direction,
    card_rate_paise = excluded.card_rate_paise,
    price_on_request = excluded.price_on_request,
    occupancy_status = excluded.occupancy_status,
    available_from = excluded.available_from,
    available_label = excluded.available_label,
    cover_storage_path = excluded.cover_storage_path,
    photo_captured_at = excluded.photo_captured_at,
    compliance_ok = excluded.compliance_ok,
    photo_fresh = excluded.photo_fresh,
    market_title = excluded.market_title,
    market_blurb = excluded.market_blurb,
    published_at = excluded.published_at,
    refreshed_at = excluded.refreshed_at;

  if v_listed and f.published_at is null then
    update public.board_faces
    set published_at = timezone('utc', now())
    where id = f.id;
  end if;

  if not v_listed and f.is_publishable = false then
    update public.board_faces
    set published_at = null
    where id = f.id and published_at is not null;
  end if;
end;
$$;

revoke all on function public.refresh_marketplace_listing(uuid) from public;
grant execute on function public.refresh_marketplace_listing(uuid) to authenticated, service_role;

create or replace function public.refresh_all_marketplace_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
begin
  for r in
    select id from public.board_faces where deleted_at is null
  loop
    perform public.refresh_marketplace_listing(r.id);
    n := n + 1;
  end loop;

  delete from public.marketplace_listings ml
  where not exists (
    select 1 from public.board_faces f
    where f.id = ml.face_id and f.deleted_at is null
  );

  return n;
end;
$$;

revoke all on function public.refresh_all_marketplace_listings() from public;
grant execute on function public.refresh_all_marketplace_listings() to authenticated, service_role;

-- Keep projection warm when publish flag / rates change
create or replace function public.board_faces_refresh_market_ai()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_marketplace_listing(new.id);
  return new;
end;
$$;

drop trigger if exists board_faces_market_ai on public.board_faces;
create trigger board_faces_market_ai
  after insert or update of is_publishable, card_rate_paise, price_on_request,
    market_title, market_blurb, occupancy_status, available_from, deleted_at
  on public.board_faces
  for each row execute function public.board_faces_refresh_market_ai();

-- Owner publish with compliance gate
create or replace function public.set_face_publishable(
  p_face_id uuid,
  p_publishable boolean,
  p_price_on_request boolean default null,
  p_market_title text default null,
  p_market_blurb text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.board_faces%rowtype;
  b public.boards%rowtype;
begin
  select * into f from public.board_faces where id = p_face_id and deleted_at is null;
  if not found then
    raise exception 'Face not found';
  end if;
  if f.organization_id not in (select public.current_user_org_ids()) then
    raise exception 'Not a member of organization';
  end if;

  select * into b from public.boards where id = f.board_id and deleted_at is null;

  if p_publishable then
    if b.lifecycle_status is distinct from 'active' then
      raise exception 'Board must be active to publish';
    end if;
    if b.lat is null or b.lng is null then
      raise exception 'Board GPS required to publish';
    end if;
    if not public.face_compliance_ok(b.id) then
      raise exception 'Valid mandatory clearance required (expired blocks publish)';
    end if;
    if not exists (
      select 1 from public.board_photos p
      where p.board_id = b.id and p.deleted_at is null
    ) then
      raise exception 'At least one board photo required to publish';
    end if;
  end if;

  update public.board_faces
  set
    is_publishable = p_publishable,
    price_on_request = coalesce(p_price_on_request, price_on_request),
    market_title = coalesce(p_market_title, market_title),
    market_blurb = coalesce(p_market_blurb, market_blurb),
    published_at = case
      when p_publishable then coalesce(published_at, timezone('utc', now()))
      else null
    end,
    updated_at = timezone('utc', now())
  where id = p_face_id;

  perform public.refresh_marketplace_listing(p_face_id);

  return jsonb_build_object(
    'face_id', p_face_id,
    'is_publishable', p_publishable,
    'listed', (select is_listed from public.marketplace_listings where face_id = p_face_id)
  );
end;
$$;

revoke all on function public.set_face_publishable(uuid, boolean, boolean, text, text) from public;
grant execute on function public.set_face_publishable(uuid, boolean, boolean, text, text) to authenticated;

-- Seed projection for existing faces
select public.refresh_all_marketplace_listings();
