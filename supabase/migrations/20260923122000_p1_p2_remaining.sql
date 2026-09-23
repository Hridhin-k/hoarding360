-- Remaining Manage P1 + Field V1.1 + P2 foundations
-- Live: harding (bzgdutrmehuojindfyxi)

-- ---------------------------------------------------------------------------
-- Org ops settings (pre-listing window M06)
-- ---------------------------------------------------------------------------
create table if not exists public.organization_ops_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  prelisting_window_days integer not null default 30
    check (prelisting_window_days between 0 and 90),
  alert_escalate_after_hours integer not null default 24
    check (alert_escalate_after_hours between 1 and 168),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id)
);

alter table public.organization_ops_settings enable row level security;

drop policy if exists org_ops_settings_all on public.organization_ops_settings;
create policy org_ops_settings_all on public.organization_ops_settings
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

insert into public.organization_ops_settings (organization_id)
select id from public.organizations where deleted_at is null
on conflict (organization_id) do nothing;

-- ---------------------------------------------------------------------------
-- Tenant clearance type catalogue (M04)
-- ---------------------------------------------------------------------------
create table if not exists public.organization_clearance_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  label text not null,
  is_mandatory_default boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, code)
);

alter table public.organization_clearance_types enable row level security;

drop policy if exists org_clearance_types_all on public.organization_clearance_types;
create policy org_clearance_types_all on public.organization_clearance_types
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

-- Seed defaults per org if empty
insert into public.organization_clearance_types (organization_id, code, label, is_mandatory_default, sort_order)
select o.id, t.code, t.label, t.mand, t.ord
from public.organizations o
cross join (values
  ('municipal_licence', 'Municipal licence', true, 1),
  ('traffic_noc', 'Traffic NOC', true, 2),
  ('structural_certificate', 'Structural certificate', true, 3),
  ('electricity_bill', 'Electricity bill', false, 4),
  ('lease_deed', 'Lease deed', false, 5)
) as t(code, label, mand, ord)
where o.deleted_at is null
  and not exists (
    select 1 from public.organization_clearance_types c where c.organization_id = o.id
  );

-- ---------------------------------------------------------------------------
-- Document versioning (M03)
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists version_no integer not null default 1,
  add column if not exists supersedes_id uuid references public.documents (id),
  add column if not exists is_current boolean not null default true;

create index if not exists documents_entity_current_idx
  on public.documents (organization_id, entity_type, entity_id, doc_type)
  where deleted_at is null and is_current = true;

-- ---------------------------------------------------------------------------
-- Client reminder controls (M05) — destinations stored; send later with email
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists reminder_email text,
  add column if not exists reminder_mobile text,
  add column if not exists contract_reminders_enabled boolean not null default true,
  add column if not exists reminder_days_before integer[] not null default '{90,60,30,15,7}';

-- ---------------------------------------------------------------------------
-- Field supervisor geo scope (P2)
-- ---------------------------------------------------------------------------
alter table public.organization_members
  add column if not exists scoped_cities text[] not null default '{}',
  add column if not exists scoped_districts text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Proof share tokens (M12)
-- ---------------------------------------------------------------------------
create table if not exists public.proof_share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid not null references public.boards (id),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by uuid references auth.users (id),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '14 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists proof_share_token_idx on public.proof_share_links (token)
  where revoked_at is null;

alter table public.proof_share_links enable row level security;

drop policy if exists proof_share_owner on public.proof_share_links;
create policy proof_share_owner on public.proof_share_links
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

-- Public read of proofs via token handled in Next route with service role / RPC
create or replace function public.get_proof_share_board(p_token text)
returns table (
  board_id uuid,
  organization_id uuid,
  board_code text,
  board_name text,
  org_name text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    b.id,
    b.organization_id,
    b.board_code,
    b.name,
    o.name,
    l.expires_at
  from public.proof_share_links l
  join public.boards b on b.id = l.board_id
  join public.organizations o on o.id = l.organization_id
  where l.token = p_token
    and l.revoked_at is null
    and l.expires_at > timezone('utc', now())
    and b.deleted_at is null;
$$;

revoke all on function public.get_proof_share_board(text) from public;
grant execute on function public.get_proof_share_board(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public QR incident report (anonymous) P2
-- ---------------------------------------------------------------------------
create table if not exists public.public_incident_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid not null references public.boards (id),
  reporter_name text,
  reporter_phone text,
  category text not null default 'other',
  title text not null,
  description text,
  lat double precision,
  lng double precision,
  status text not null default 'open',
  incident_id uuid references public.incidents (id),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.public_incident_reports enable row level security;

drop policy if exists public_incident_owner_select on public.public_incident_reports;
create policy public_incident_owner_select on public.public_incident_reports
  for select to authenticated
  using (organization_id in (select public.current_user_org_ids()));

create or replace function public.submit_public_incident_report(
  p_qr_token text,
  p_title text,
  p_category text,
  p_description text default null,
  p_reporter_name text default null,
  p_reporter_phone text default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.boards%rowtype;
  v_id uuid;
  v_inc uuid;
begin
  select * into b from public.boards
  where qr_token = p_qr_token and deleted_at is null;
  if not found then
    raise exception 'Board not found';
  end if;
  if length(trim(p_title)) < 3 then
    raise exception 'Title required';
  end if;

  insert into public.incidents (
    organization_id, board_id, title, category, severity, description, status, lat, lng
  ) values (
    b.organization_id, b.id, trim(p_title), coalesce(nullif(trim(p_category), ''), 'other'),
    'medium', nullif(trim(p_description), ''), 'open', p_lat, p_lng
  )
  returning id into v_inc;

  insert into public.public_incident_reports (
    organization_id, board_id, reporter_name, reporter_phone, category, title,
    description, lat, lng, incident_id
  ) values (
    b.organization_id, b.id, nullif(trim(p_reporter_name), ''), nullif(trim(p_reporter_phone), ''),
    coalesce(nullif(trim(p_category), ''), 'other'), trim(p_title),
    nullif(trim(p_description), ''), p_lat, p_lng, v_inc
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_public_incident_report(text, text, text, text, text, text, double precision, double precision) from public;
grant execute on function public.submit_public_incident_report(text, text, text, text, text, text, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Alert escalation tracking (P2)
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists escalated_at timestamptz,
  add column if not exists acknowledged_at timestamptz;

create or replace function public.escalate_stale_critical_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  hours integer;
begin
  for r in
    select ntf.*, coalesce(ops.alert_escalate_after_hours, 24) as hours
    from public.notifications ntf
    left join public.organization_ops_settings ops
      on ops.organization_id = ntf.organization_id
    where ntf.priority = 'critical'
      and ntf.read_at is null
      and ntf.acknowledged_at is null
      and ntf.escalated_at is null
      and ntf.created_at < timezone('utc', now()) - make_interval(hours => coalesce(ops.alert_escalate_after_hours, 24))
  loop
    update public.notifications
    set escalated_at = timezone('utc', now()),
        title = '[ESCALATED] ' || title
    where id = r.id
      and escalated_at is null;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.escalate_stale_critical_alerts() from public;
grant execute on function public.escalate_stale_critical_alerts() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Pre-listing window in sync_face_occupancy (M06)
-- ---------------------------------------------------------------------------
create or replace function public.org_prelisting_days(p_org uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select prelisting_window_days from public.organization_ops_settings where organization_id = p_org),
    30
  );
$$;

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
  v_window integer := 30;
begin
  select organization_id into v_org
  from public.board_faces
  where id = p_face_id and deleted_at is null;

  if v_org is null then
    return;
  end if;

  v_window := public.org_prelisting_days(v_org);

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
    if v_available_from is not null and v_available_from <= (today + v_window) then
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

  update public.board_faces
  set occupancy_status = v_status,
      available_from = v_available_from,
      updated_at = timezone('utc', now())
  where id = p_face_id;
end;
$$;

-- Proof review fields for supervisor geo-fail
alter table public.proof_of_display
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'waived')),
  add column if not exists reviewed_by uuid references auth.users (id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

update public.proof_of_display
set review_status = case when geo_ok then 'approved' else 'pending' end
where review_status = 'pending';
