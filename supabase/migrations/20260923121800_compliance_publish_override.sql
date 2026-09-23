-- M04: Audited compliance publish override (admin only)
-- Expired mandatory clearance still auto-unpublishes unless a time-boxed override is active.
-- Live: harding (bzgdutrmehuojindfyxi)

alter table public.boards
  add column if not exists compliance_publish_override_until date,
  add column if not exists compliance_publish_override_reason text,
  add column if not exists compliance_publish_override_by uuid references auth.users (id),
  add column if not exists compliance_publish_override_at timestamptz;

create or replace function public.board_has_active_publish_override(p_board_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.boards b
    where b.id = p_board_id
      and b.deleted_at is null
      and b.compliance_publish_override_until is not null
      and b.compliance_publish_override_until >= public.ist_today()
  );
$$;

create or replace function public.face_compliance_ok(p_board_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    public.board_has_active_publish_override(p_board_id)
    or not exists (
      select 1
      from public.compliance_records c
      where c.board_id = p_board_id
        and c.deleted_at is null
        and c.is_mandatory = true
        and c.status = 'expired'
    );
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

  -- Auto-unpublish unless audited override is still in force
  update public.board_faces f
  set is_publishable = false,
      updated_at = timezone('utc', now())
  where f.deleted_at is null
    and f.is_publishable = true
    and not public.board_has_active_publish_override(f.board_id)
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

create or replace function public.grant_compliance_publish_override(
  p_board_id uuid,
  p_reason text,
  p_until date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.boards%rowtype;
  v_role text;
begin
  if p_reason is null or length(trim(p_reason)) < 8 then
    raise exception 'Override reason must be at least 8 characters';
  end if;
  if p_until is null or p_until < public.ist_today() then
    raise exception 'Override until date must be today or later';
  end if;
  if p_until > (public.ist_today() + 30) then
    raise exception 'Override cannot exceed 30 days';
  end if;

  select * into b from public.boards where id = p_board_id and deleted_at is null;
  if not found then
    raise exception 'Board not found';
  end if;
  if b.organization_id not in (select public.current_user_org_ids()) then
    raise exception 'Not a member of organization';
  end if;

  select m.role into v_role
  from public.organization_members m
  where m.organization_id = b.organization_id
    and m.user_id = auth.uid()
    and m.deactivated_at is null
  limit 1;

  if v_role is distinct from 'company_admin'
     and v_role is distinct from 'operations_manager' then
    raise exception 'Only company admin or operations manager may grant override';
  end if;

  update public.boards
  set
    compliance_publish_override_until = p_until,
    compliance_publish_override_reason = trim(p_reason),
    compliance_publish_override_by = auth.uid(),
    compliance_publish_override_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_board_id;

  perform public.log_activity_event(
    b.organization_id,
    'board',
    p_board_id,
    'compliance.publish_override_granted',
    p_board_id,
    null,
    jsonb_build_object(
      'until', p_until,
      'reason', trim(p_reason)
    ),
    trim(p_reason)
  );
end;
$$;

create or replace function public.revoke_compliance_publish_override(
  p_board_id uuid,
  p_reason text default 'Override revoked'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.boards%rowtype;
  v_role text;
  f record;
begin
  select * into b from public.boards where id = p_board_id and deleted_at is null;
  if not found then
    raise exception 'Board not found';
  end if;
  if b.organization_id not in (select public.current_user_org_ids()) then
    raise exception 'Not a member of organization';
  end if;

  select m.role into v_role
  from public.organization_members m
  where m.organization_id = b.organization_id
    and m.user_id = auth.uid()
    and m.deactivated_at is null
  limit 1;

  if v_role is distinct from 'company_admin'
     and v_role is distinct from 'operations_manager' then
    raise exception 'Only company admin or operations manager may revoke override';
  end if;

  update public.boards
  set
    compliance_publish_override_until = null,
    compliance_publish_override_reason = null,
    compliance_publish_override_by = null,
    compliance_publish_override_at = null,
    updated_at = timezone('utc', now())
  where id = p_board_id;

  -- Re-run unpublish for this board's faces if still expired
  update public.board_faces f
  set is_publishable = false,
      updated_at = timezone('utc', now())
  where f.board_id = p_board_id
    and f.deleted_at is null
    and f.is_publishable = true
    and exists (
      select 1 from public.compliance_records c
      where c.board_id = p_board_id
        and c.deleted_at is null
        and c.is_mandatory = true
        and c.status = 'expired'
    );

  perform public.log_activity_event(
    b.organization_id,
    'board',
    p_board_id,
    'compliance.publish_override_revoked',
    p_board_id,
    null,
    jsonb_build_object('reason', coalesce(nullif(trim(p_reason), ''), 'Override revoked')),
    coalesce(nullif(trim(p_reason), ''), 'Override revoked')
  );

  for f in
    select id from public.board_faces
    where board_id = p_board_id and deleted_at is null
  loop
    perform public.refresh_marketplace_listing(f.id);
  end loop;
end;
$$;

revoke all on function public.grant_compliance_publish_override(uuid, text, date) from public;
grant execute on function public.grant_compliance_publish_override(uuid, text, date) to authenticated;

revoke all on function public.revoke_compliance_publish_override(uuid, text) from public;
grant execute on function public.revoke_compliance_publish_override(uuid, text) to authenticated;

revoke all on function public.board_has_active_publish_override(uuid) from public;
grant execute on function public.board_has_active_publish_override(uuid) to authenticated, anon, service_role;
