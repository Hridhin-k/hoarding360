-- M01 / M04 / M07 V1.0: Manage CRM P0 — org profile RLS, team admin, invite ledger, alert ladder

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_org_company_admin(p_org uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_org
      and om.user_id = p_user
      and om.deactivated_at is null
      and om.role = 'company_admin'
  );
$$;

revoke all on function public.is_org_company_admin(uuid, uuid) from public;
grant execute on function public.is_org_company_admin(uuid, uuid) to authenticated, service_role;

-- Company admin may update own org profile (GSTIN, address, branding)
drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (public.is_org_company_admin(id) and deleted_at is null)
  with check (public.is_org_company_admin(id) and deleted_at is null);

-- Company admin may invite / change role / deactivate members
drop policy if exists organization_members_admin_insert on public.organization_members;
create policy organization_members_admin_insert on public.organization_members
  for insert to authenticated
  with check (public.is_org_company_admin(organization_id));

drop policy if exists organization_members_admin_update on public.organization_members;
create policy organization_members_admin_update on public.organization_members
  for update to authenticated
  using (public.is_org_company_admin(organization_id))
  with check (public.is_org_company_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Pending invites (audit + UI before Auth invite settles)
-- ---------------------------------------------------------------------------

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  email text not null,
  role public.org_role not null default 'sales_executive',
  invited_by uuid references auth.users (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  auth_user_id uuid references auth.users (id),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (organization_id, email)
);

create index if not exists organization_invites_org_idx
  on public.organization_invites (organization_id)
  where status = 'pending';

alter table public.organization_invites enable row level security;

drop policy if exists organization_invites_admin_all on public.organization_invites;
create policy organization_invites_admin_all on public.organization_invites
  for all to authenticated
  using (public.is_org_company_admin(organization_id))
  with check (public.is_org_company_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Compliance: expiring_soon window = 90 days; alert ladder 90/60/30/15/7
-- ---------------------------------------------------------------------------

create or replace function public.compliance_records_set_status()
returns trigger
language plpgsql
as $$
declare
  today date := public.ist_today();
begin
  if coalesce(new.under_renewal, false) then
    new.status := 'under_renewal';
  elsif new.expiry_date is null then
    new.status := 'missing';
  elsif new.expiry_date < today then
    new.status := 'expired';
  elsif new.expiry_date <= (today + 90) then
    new.status := 'expiring_soon';
  else
    new.status := 'valid';
  end if;
  return new;
end;
$$;

create or replace function public.recompute_all_compliance_statuses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  today date := public.ist_today();
begin
  update public.compliance_records
  set status = case
    when under_renewal then 'under_renewal'::public.compliance_status
    when expiry_date is null then 'missing'::public.compliance_status
    when expiry_date < today then 'expired'::public.compliance_status
    when expiry_date <= (today + 90) then 'expiring_soon'::public.compliance_status
    else 'valid'::public.compliance_status
  end,
  updated_at = timezone('utc', now())
  where deleted_at is null;

  get diagnostics n = row_count;

  update public.board_faces f
  set is_publishable = false,
      updated_at = timezone('utc', now())
  where f.deleted_at is null
    and f.is_publishable = true
    and exists (
      select 1
      from public.compliance_records c
      where c.board_id = f.board_id
        and c.deleted_at is null
        and c.is_mandatory = true
        and c.status = 'expired'
    );

  return n;
end;
$$;

create or replace function public.emit_compliance_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  m record;
  today date := public.ist_today();
  v_days int;
  v_kind text;
  v_title text;
  v_body text;
  v_priority text;
  v_href text;
  v_ms int;
begin
  perform public.recompute_all_compliance_statuses();

  for r in
    select
      c.id,
      c.organization_id,
      c.board_id,
      c.clearance_type,
      c.status::text as status,
      c.expiry_date,
      b.board_code,
      b.name as board_name
    from public.compliance_records c
    join public.boards b on b.id = c.board_id and b.deleted_at is null
    where c.deleted_at is null
      and c.is_mandatory = true
      and (
        c.status = 'expired'
        or c.status = 'missing'
        or (c.expiry_date is not null and c.expiry_date >= today and c.expiry_date <= (today + 90))
      )
  loop
    v_href := '/manage/boards/' || r.board_id::text || '?tab=compliance';

    if r.status = 'expired' or (r.expiry_date is not null and r.expiry_date < today) then
      v_kind := 'compliance_expired';
      v_priority := 'high';
      v_title := 'Permit expired · ' || coalesce(r.board_code, 'board');
      v_body := coalesce(r.clearance_type, 'Clearance')
        || ' on '
        || coalesce(r.board_name, r.board_code, 'board')
        || ' expired'
        || case when r.expiry_date is not null then ' on ' || to_char(r.expiry_date, 'DD-MM-YYYY') else '' end
        || '. Faces auto-unpublished.';
    elsif r.status = 'missing' or r.expiry_date is null then
      v_kind := 'compliance_missing';
      v_priority := 'medium';
      v_title := 'Permit missing · ' || coalesce(r.board_code, 'board');
      v_body := coalesce(r.clearance_type, 'Clearance')
        || ' on '
        || coalesce(r.board_name, r.board_code, 'board')
        || ' has no expiry date.';
    else
      v_days := (r.expiry_date - today);
      -- Ladder buckets: 90 / 60 / 30 / 15 / 7 days (product Manage PDF)
      v_ms := case
        when v_days <= 7 then 7
        when v_days <= 15 then 15
        when v_days <= 30 then 30
        when v_days <= 60 then 60
        when v_days <= 90 then 90
        else null
      end;
      if v_ms is null then
        continue;
      end if;
      v_kind := 'compliance_d' || v_ms::text;
      v_priority := case when v_ms <= 15 then 'high' when v_ms <= 30 then 'medium' else 'low' end;
      v_title := 'Permit · ' || v_ms::text || 'd · ' || coalesce(r.board_code, 'board');
      v_body := coalesce(r.clearance_type, 'Clearance')
        || ' on '
        || coalesce(r.board_name, r.board_code, 'board')
        || ' expires on '
        || to_char(r.expiry_date, 'DD-MM-YYYY')
        || ' (' || v_days::text || ' days).';
    end if;

    for m in
      select om.user_id
      from public.organization_members om
      where om.organization_id = r.organization_id
        and om.deactivated_at is null
        and om.role in (
          'company_admin',
          'operations_manager',
          'compliance_officer'
        )
    loop
      if not exists (
        select 1 from public.notifications n
        where n.user_id = m.user_id
          and n.kind = v_kind
          and n.entity_id = r.id
          and n.read_at is null
      ) then
        insert into public.notifications (
          organization_id, user_id, channel, kind, title, body, priority, href, entity_type, entity_id
        ) values (
          r.organization_id, m.user_id, 'in_app', v_kind, v_title, v_body, v_priority, v_href,
          'compliance_record', r.id
        );
        n := n + 1;
      end if;
    end loop;
  end loop;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vacancy loss helper (days vacant * card rate / 30)
-- ---------------------------------------------------------------------------

create or replace function public.org_vacancy_loss_paise(p_organization_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := public.ist_today();
  total bigint := 0;
  r record;
  days int;
begin
  for r in
    select f.card_rate_paise, f.available_from, f.occupancy_status
    from public.board_faces f
    where f.organization_id = p_organization_id
      and f.deleted_at is null
      and f.occupancy_status in ('vacant', 'becoming_vacant')
      and f.card_rate_paise is not null
  loop
    days := greatest(0, (today - coalesce(r.available_from, today)));
    if r.occupancy_status = 'vacant' and days > 0 then
      total := total + (r.card_rate_paise * days / 30);
    end if;
  end loop;
  return total;
end;
$$;

revoke all on function public.org_vacancy_loss_paise(uuid) from public;
grant execute on function public.org_vacancy_loss_paise(uuid) to authenticated, service_role;

create or replace view public.vacancy_loss_faces as
select
  f.id as face_id,
  f.organization_id,
  f.board_id,
  b.board_code,
  b.name as board_name,
  b.city,
  f.face_label,
  f.occupancy_status,
  f.available_from,
  f.card_rate_paise,
  greatest(0, (public.ist_today() - coalesce(f.available_from, public.ist_today()))) as days_vacant,
  case
    when f.card_rate_paise is null then 0
    else (f.card_rate_paise
      * greatest(0, (public.ist_today() - coalesce(f.available_from, public.ist_today())))
      / 30)
  end as loss_paise
from public.board_faces f
join public.boards b on b.id = f.board_id and b.deleted_at is null
where f.deleted_at is null
  and f.occupancy_status = 'vacant';

grant select on public.vacancy_loss_faces to authenticated;

create or replace view public.revenue_by_client as
select
  a.organization_id,
  a.client_id,
  c.name as client_name,
  count(*)::int as agreement_count,
  coalesce(sum(a.value_paise), 0)::bigint as value_paise
from public.agreements a
join public.clients c on c.id = a.client_id
where a.deleted_at is null
  and a.status in ('active', 'draft', 'signed')
group by a.organization_id, a.client_id, c.name;

grant select on public.revenue_by_client to authenticated;
