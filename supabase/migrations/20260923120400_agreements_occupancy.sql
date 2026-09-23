-- M05/M06: agreement overlap guard + occupancy sync from agreements

-- Active agreement statuses that hold inventory
-- draft is editable but still blocks once faces are attached (prevents double sell)

create or replace function public.agreement_holds_inventory(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status is distinct from 'cancelled' and p_status is distinct from 'terminated';
$$;

create or replace function public.check_agreement_face_overlap()
returns trigger
language plpgsql
as $$
declare
  v_ref text;
  v_id uuid;
  v_status text;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select a.id, coalesce(nullif(a.ref_code, ''), left(a.id::text, 8)), a.status
  into v_id, v_ref, v_status
  from public.agreement_faces af
  join public.agreements a on a.id = af.agreement_id
  where af.face_id = new.face_id
    and af.deleted_at is null
    and a.deleted_at is null
    and public.agreement_holds_inventory(a.status)
    and af.id is distinct from new.id
    and af.agreement_id is distinct from new.agreement_id
    and af.starts_on <= new.ends_on
    and af.ends_on >= new.starts_on
  limit 1;

  if v_id is not null then
    raise exception 'Overlapping agreement % (%) on this face for the selected dates',
      v_ref, v_id
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists agreement_faces_no_overlap on public.agreement_faces;
create trigger agreement_faces_no_overlap
  before insert or update of face_id, starts_on, ends_on, deleted_at
  on public.agreement_faces
  for each row execute function public.check_agreement_face_overlap();

-- Derive occupancy periods + face.occupancy_status for one face
create or replace function public.sync_face_occupancy(p_face_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  today date := public.ist_today();
  v_status public.occupancy_status := 'vacant';
  v_available_from date := null;
  r record;
begin
  select organization_id into v_org
  from public.board_faces
  where id = p_face_id and deleted_at is null;

  if v_org is null then
    return;
  end if;

  -- Clear derived agreement periods (keep manual blocks)
  delete from public.occupancy_periods
  where face_id = p_face_id
    and agreement_id is not null
    and (block_reason is null or block_reason = '');

  insert into public.occupancy_periods (
    organization_id, face_id, status, starts_on, ends_on, agreement_id
  )
  select
    af.organization_id,
    af.face_id,
    case
      when af.starts_on > today then 'booked_future'::public.occupancy_status
      else 'occupied'::public.occupancy_status
    end,
    af.starts_on,
    af.ends_on,
    af.agreement_id
  from public.agreement_faces af
  join public.agreements a on a.id = af.agreement_id
  where af.face_id = p_face_id
    and af.deleted_at is null
    and a.deleted_at is null
    and public.agreement_holds_inventory(a.status);

  -- Current face status
  if exists (
    select 1 from public.occupancy_periods
    where face_id = p_face_id
      and status = 'blocked'
      and starts_on <= today
      and (ends_on is null or ends_on >= today)
  ) then
    v_status := 'blocked';
  elsif exists (
    select 1 from public.occupancy_periods
    where face_id = p_face_id
      and agreement_id is not null
      and starts_on <= today and ends_on >= today
  ) then
    v_status := 'occupied';
    select min(ends_on) + 1 into v_available_from
    from public.occupancy_periods
    where face_id = p_face_id
      and agreement_id is not null
      and starts_on <= today and ends_on >= today;
    -- becoming_vacant if ends within 30 days
    if v_available_from is not null and v_available_from <= (today + 30) then
      v_status := 'becoming_vacant';
    end if;
  elsif exists (
    select 1 from public.occupancy_periods
    where face_id = p_face_id
      and agreement_id is not null
      and starts_on > today
  ) then
    v_status := 'booked_future';
    select min(starts_on) into v_available_from
    from public.occupancy_periods
    where face_id = p_face_id and agreement_id is not null and starts_on > today;
  else
    v_status := 'vacant';
    v_available_from := today;
  end if;

  -- on_hold not derived here (marketplace holds later)

  update public.board_faces
  set occupancy_status = v_status,
      available_from = v_available_from,
      updated_at = timezone('utc', now())
  where id = p_face_id;
end;
$$;

create or replace function public.sync_agreement_occupancy(p_agreement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct face_id
    from public.agreement_faces
    where agreement_id = p_agreement_id
  loop
    perform public.sync_face_occupancy(r.face_id);
  end loop;
end;
$$;

create or replace function public.trg_agreement_faces_sync_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_face_occupancy(old.face_id);
    return old;
  end if;
  perform public.sync_face_occupancy(new.face_id);
  if tg_op = 'UPDATE' and old.face_id is distinct from new.face_id then
    perform public.sync_face_occupancy(old.face_id);
  end if;
  return new;
end;
$$;

drop trigger if exists agreement_faces_sync_occupancy on public.agreement_faces;
create trigger agreement_faces_sync_occupancy
  after insert or update or delete on public.agreement_faces
  for each row execute function public.trg_agreement_faces_sync_occupancy();

create or replace function public.trg_agreements_sync_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_agreement_occupancy(new.id);
  return new;
end;
$$;

drop trigger if exists agreements_sync_occupancy on public.agreements;
create trigger agreements_sync_occupancy
  after update of status, deleted_at, starts_on, ends_on on public.agreements
  for each row execute function public.trg_agreements_sync_occupancy();

grant execute on function public.sync_face_occupancy(uuid) to authenticated;
grant execute on function public.sync_agreement_occupancy(uuid) to authenticated;

-- Upcoming vacancies helper view (faces becoming free)
create or replace view public.upcoming_vacancies
with (security_invoker = true)
as
select
  f.id as face_id,
  f.organization_id,
  f.board_id,
  f.face_label,
  f.card_rate_paise,
  f.occupancy_status,
  f.available_from,
  b.board_code,
  b.name as board_name,
  b.city
from public.board_faces f
join public.boards b on b.id = f.board_id
where f.deleted_at is null
  and b.deleted_at is null
  and f.available_from is not null
  and f.available_from <= (public.ist_today() + 90)
  and f.occupancy_status in ('becoming_vacant', 'vacant', 'booked_future');

grant select on public.upcoming_vacancies to authenticated;
