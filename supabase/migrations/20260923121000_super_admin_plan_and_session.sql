-- M33 follow-up: plan assignment + time-boxed support sessions
-- Applied after 20260923120900 landed without these columns/functions.
-- Live project: harding (bzgdutrmehuojindfyxi)

alter table public.impersonation_audits
  add column if not exists expires_at timestamptz;

update public.impersonation_audits
set expires_at = started_at + interval '1 hour'
where expires_at is null;

alter table public.impersonation_audits
  alter column expires_at set default (timezone('utc', now()) + interval '1 hour');

alter table public.impersonation_audits
  alter column expires_at set not null;

alter table public.impersonation_audits
  drop constraint if exists impersonation_audits_reason_not_blank;

alter table public.impersonation_audits
  add constraint impersonation_audits_reason_not_blank
  check (char_length(trim(reason)) > 0);

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
    'job_queue_depth', null,
    'event_bus_lag_seconds', null
  );
end;
$$;

revoke all on function public.platform_health() from public;
grant execute on function public.platform_health() to authenticated;

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
