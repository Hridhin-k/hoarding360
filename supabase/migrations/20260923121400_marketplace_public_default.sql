-- Make marketplace publicly browsable with practical publish gates (soft preview).
-- List when: org marketplace on + face publishable + board active + GPS + not suspended.
-- Block only on expired mandatory clearance (missing no longer blocks soft preview).
-- Photo preferred but not required to list.
-- Live project: harding (bzgdutrmehuojindfyxi)

create or replace function public.face_compliance_ok(p_board_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  -- Soft preview: only expired mandatory clearances block listing
  select not exists (
    select 1
    from public.compliance_records c
    where c.board_id = p_board_id
      and c.deleted_at is null
      and c.is_mandatory = true
      and c.status = 'expired'
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
  v_market_on boolean;
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

  -- Default: marketplace treated as ON until owner opts out (public-by-default)
  v_market_on := coalesce(s.marketplace_enabled, true);

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
    v_market_on
    and f.is_publishable
    and b.lifecycle_status = 'active'
    and o.suspended_at is null
    and o.deleted_at is null
    and v_compliance_ok
    and b.lat is not null
    and b.lng is not null;

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
end;
$$;

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
      raise exception 'Expired mandatory clearance blocks publish';
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

-- Ensure every org has marketplace settings (public by default)
insert into public.organization_marketplace_settings (
  organization_id, marketplace_enabled, accept_enquiries
)
select id, true, true
from public.organizations
where deleted_at is null
on conflict (organization_id) do update
set marketplace_enabled = true;

-- Activate + publish all current inventory with GPS (so CSV imports appear)
update public.boards
set lifecycle_status = 'active',
    updated_at = timezone('utc', now())
where deleted_at is null
  and lat is not null
  and lng is not null
  and lifecycle_status is distinct from 'retired';

update public.board_faces f
set is_publishable = true,
    published_at = coalesce(f.published_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
from public.boards b
where f.board_id = b.id
  and f.deleted_at is null
  and b.deleted_at is null
  and b.lat is not null
  and b.lng is not null
  and b.lifecycle_status = 'active';

select public.refresh_all_marketplace_listings();

-- Anon must be able to read listed rows (reaffirm)
grant select on public.marketplace_listings to anon, authenticated;
