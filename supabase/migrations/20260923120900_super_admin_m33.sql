-- M33 Super Admin basic: platform staff helpers, org ops RLS, impersonation audit
-- Live project: harding (bzgdutrmehuojindfyxi)

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_staff
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_staff() from public;
grant execute on function public.is_platform_staff() to authenticated;

-- Staff can see / update all orgs (including suspended)
drop policy if exists organizations_select_staff on public.organizations;
create policy organizations_select_staff on public.organizations
  for select to authenticated
  using (public.is_platform_staff());

drop policy if exists organizations_update_staff on public.organizations;
create policy organizations_update_staff on public.organizations
  for update to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create table if not exists public.impersonation_audits (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users (id),
  organization_id uuid references public.organizations (id),
  target_user_id uuid references auth.users (id),
  reason text not null check (char_length(trim(reason)) > 0),
  started_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '1 hour'),
  ended_at timestamptz,
  notes text
);

alter table public.impersonation_audits enable row level security;

drop policy if exists impersonation_staff_all on public.impersonation_audits;
create policy impersonation_staff_all on public.impersonation_audits
  for all to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff() and staff_user_id = auth.uid());

-- Platform health snapshot (staff only)
create or replace function public.platform_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff only';
  end if;

  return jsonb_build_object(
    'organizations', (select count(*)::int from public.organizations where deleted_at is null),
    'suspended', (select count(*)::int from public.organizations where deleted_at is null and suspended_at is not null),
    'boards', (select count(*)::int from public.boards where deleted_at is null),
    'faces', (select count(*)::int from public.board_faces where deleted_at is null),
    'agreements_live', (select count(*)::int from public.live_agreements),
    'expired_mandatory', (
      select count(*)::int
      from public.compliance_records
      where deleted_at is null
        and is_mandatory = true
        and status = 'expired'
    ),
    'open_alerts', (
      select count(*)::int
      from public.notifications
      where read_at is null
    ),
    'storage_objects', (
      select count(*)::int
      from storage.objects
      where bucket_id in ('board-images', 'org-documents')
    ),
    -- This stack has no Redis job queue or event bus (live Supabase only).
    'job_queue_depth', null,
    'event_bus_lag_seconds', null
  );
end;
$$;

revoke all on function public.platform_health() from public;
grant execute on function public.platform_health() to authenticated;

-- Create tenant as platform staff (returns org id)
create or replace function public.admin_create_organization(
  p_name text,
  p_feature_flags jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff only';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Name required';
  end if;

  insert into public.organizations (name, feature_flags)
  values (trim(p_name), coalesce(p_feature_flags, '{}'::jsonb))
  returning id into v_id;

  insert into public.activity_events (
    organization_id, actor_id, entity_type, entity_id, event_type, to_value
  ) values (
    v_id,
    auth.uid(),
    'organization',
    v_id,
    'org.created_by_admin',
    jsonb_build_object('name', trim(p_name))
  );

  return v_id;
end;
$$;

revoke all on function public.admin_create_organization(text, jsonb) from public;
grant execute on function public.admin_create_organization(text, jsonb) to authenticated;

create or replace function public.admin_set_organization_suspended(
  p_organization_id uuid,
  p_suspend boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff only';
  end if;

  update public.organizations
  set
    suspended_at = case when p_suspend then timezone('utc', now()) else null end,
    updated_at = timezone('utc', now())
  where id = p_organization_id
    and deleted_at is null;

  insert into public.activity_events (
    organization_id, actor_id, entity_type, entity_id, event_type, reason, to_value
  ) values (
    p_organization_id,
    auth.uid(),
    'organization',
    p_organization_id,
    case when p_suspend then 'org.suspended' else 'org.unsuspended' end,
    p_reason,
    jsonb_build_object('suspended', p_suspend)
  );
end;
$$;

revoke all on function public.admin_set_organization_suspended(uuid, boolean, text) from public;
grant execute on function public.admin_set_organization_suspended(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_feature_flags(
  p_organization_id uuid,
  p_feature_flags jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff only';
  end if;

  update public.organizations
  set
    feature_flags = coalesce(p_feature_flags, '{}'::jsonb),
    updated_at = timezone('utc', now())
  where id = p_organization_id
    and deleted_at is null;

  insert into public.activity_events (
    organization_id, actor_id, entity_type, entity_id, event_type, to_value
  ) values (
    p_organization_id,
    auth.uid(),
    'organization',
    p_organization_id,
    'org.feature_flags_updated',
    p_feature_flags
  );
end;
$$;

revoke all on function public.admin_set_feature_flags(uuid, jsonb) from public;
grant execute on function public.admin_set_feature_flags(uuid, jsonb) to authenticated;

create or replace function public.admin_set_organization_plan(
  p_organization_id uuid,
  p_plan text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := lower(trim(p_plan));
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff only';
  end if;

  if v_plan not in ('listing', 'starter', 'professional', 'enterprise', 'white_label') then
    raise exception 'Unknown plan';
  end if;

  update public.organizations
  set plan = v_plan, updated_at = timezone('utc', now())
  where id = p_organization_id
    and deleted_at is null;

  insert into public.activity_events (
    organization_id, actor_id, entity_type, entity_id, event_type, to_value
  ) values (
    p_organization_id,
    auth.uid(),
    'organization',
    p_organization_id,
    'org.plan_updated',
    jsonb_build_object('plan', v_plan)
  );
end;
$$;

revoke all on function public.admin_set_organization_plan(uuid, text) from public;
grant execute on function public.admin_set_organization_plan(uuid, text) to authenticated;
