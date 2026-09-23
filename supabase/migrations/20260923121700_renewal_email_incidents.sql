-- M04/M07/M11: email notify settings, email outbound channel, incidents index

alter table public.organization_notify_settings
  add column if not exists email_enabled boolean not null default false,
  add column if not exists ops_email text;

create index if not exists incidents_org_status_idx
  on public.incidents (organization_id, status)
  where deleted_at is null;

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.outbound_messages'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%channel%';
  if cname is not null then
    execute format('alter table public.outbound_messages drop constraint %I', cname);
  end if;
end $$;

alter table public.outbound_messages
  add constraint outbound_messages_channel_check
  check (channel in ('sms', 'whatsapp', 'email'));

create or replace function public.enqueue_expiry_outbound_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  s public.organization_notify_settings%rowtype;
  v_body text;
  v_id uuid;
  v_has_settings boolean;
begin
  for r in
    select
      c.id,
      c.organization_id,
      c.status::text as status,
      c.clearance_type,
      c.expiry_date,
      b.board_code
    from public.compliance_records c
    join public.boards b on b.id = c.board_id and b.deleted_at is null
    where c.deleted_at is null
      and c.is_mandatory = true
      and c.status in ('expired', 'expiring_soon')
  loop
    select * into s
    from public.organization_notify_settings
    where organization_id = r.organization_id;
    v_has_settings := found;

    if v_has_settings and not s.compliance_alerts_enabled then
      continue;
    end if;

    if r.status = 'expired' then
      v_body := 'HOARDINGS360: Permit expired on '
        || coalesce(r.board_code, 'board')
        || ' (' || coalesce(r.clearance_type, 'clearance') || ')'
        || case when r.expiry_date is not null then ' on ' || to_char(r.expiry_date, 'DD-MM-YYYY') else '' end
        || '. Faces unpublished. Open Manage to renew.';
    else
      v_body := 'HOARDINGS360: Permit expiring on '
        || coalesce(r.board_code, 'board')
        || ' (' || coalesce(r.clearance_type, 'clearance') || ')'
        || case when r.expiry_date is not null then ' by ' || to_char(r.expiry_date, 'DD-MM-YYYY') else ' soon' end
        || '. Renew before expiry.';
    end if;

    if v_has_settings and coalesce(s.ops_mobile, '') <> '' then
      if s.sms_enabled then
        v_id := public.enqueue_outbound_message(
          r.organization_id, 'sms', 'compliance_' || r.status, s.ops_mobile, v_body,
          'compliance_record', r.id
        );
        if v_id is not null then n := n + 1; end if;
      end if;
      if s.whatsapp_enabled then
        v_id := public.enqueue_outbound_message(
          r.organization_id, 'whatsapp', 'compliance_' || r.status, s.ops_mobile, v_body,
          'compliance_record', r.id
        );
        if v_id is not null then n := n + 1; end if;
      end if;
    end if;

    if v_has_settings and coalesce(s.email_enabled, false) and coalesce(s.ops_email, '') <> '' then
      v_id := public.enqueue_outbound_message(
        r.organization_id, 'email', 'compliance_' || r.status, lower(s.ops_email), v_body,
        'compliance_record', r.id
      );
      if v_id is not null then n := n + 1; end if;
    end if;
  end loop;

  return n;
end;
$$;
