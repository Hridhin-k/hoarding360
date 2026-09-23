-- M07 / V1.1: WhatsApp + SMS outbound queue + org channel settings
-- Live project: harding (bzgdutrmehuojindfyxi)

create table if not exists public.organization_notify_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  -- Prefer E.164 (+91xxxxxxxxxx). Dry-run stays on until provider secrets are set.
  dry_run boolean not null default true,
  ops_mobile text,
  compliance_alerts_enabled boolean not null default true,
  agreement_reminders_enabled boolean not null default true,
  client_reminders_enabled boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id)
);

alter table public.organization_notify_settings enable row level security;

drop policy if exists org_notify_settings_all on public.organization_notify_settings;
create policy org_notify_settings_all on public.organization_notify_settings
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel text not null check (channel in ('sms', 'whatsapp')),
  template_key text not null,
  to_e164 text not null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'dry_run', 'skipped')),
  provider text,
  provider_message_id text,
  error text,
  entity_type text,
  entity_id uuid,
  attempts int not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz
);

create index if not exists outbound_messages_pending_idx
  on public.outbound_messages (status, created_at)
  where status = 'pending';

create unique index if not exists outbound_messages_dedupe_uidx
  on public.outbound_messages (organization_id, channel, template_key, entity_id, to_e164)
  where status in ('pending', 'sent', 'dry_run') and entity_id is not null;

alter table public.outbound_messages enable row level security;

drop policy if exists outbound_messages_select on public.outbound_messages;
create policy outbound_messages_select on public.outbound_messages
  for select to authenticated
  using (organization_id in (select public.current_user_org_ids()));

create or replace function public.normalize_in_mobile(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if p_raw is null then
    return null;
  end if;
  d := regexp_replace(p_raw, '[^0-9+]', '', 'g');
  if d ~ '^\+91[6-9][0-9]{9}$' then
    return d;
  end if;
  if d ~ '^91[6-9][0-9]{9}$' then
    return '+' || d;
  end if;
  if d ~ '^[6-9][0-9]{9}$' then
    return '+91' || d;
  end if;
  if d ~ '^\+[1-9][0-9]{7,14}$' then
    return d;
  end if;
  return null;
end;
$$;

create or replace function public.enqueue_outbound_message(
  p_organization_id uuid,
  p_channel text,
  p_template_key text,
  p_to_raw text,
  p_body text,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to text;
  v_id uuid;
  v_settings public.organization_notify_settings%rowtype;
begin
  v_to := public.normalize_in_mobile(p_to_raw);
  if v_to is null or nullif(trim(p_body), '') is null then
    return null;
  end if;

  select * into v_settings
  from public.organization_notify_settings
  where organization_id = p_organization_id;

  if found then
    if p_channel = 'sms' and not v_settings.sms_enabled then
      return null;
    end if;
    if p_channel = 'whatsapp' and not v_settings.whatsapp_enabled then
      return null;
    end if;
  end if;

  if p_entity_id is not null and exists (
    select 1
    from public.outbound_messages m
    where m.organization_id = p_organization_id
      and m.channel = p_channel
      and m.template_key = p_template_key
      and m.entity_id = p_entity_id
      and m.to_e164 = v_to
      and m.status in ('pending', 'sent', 'dry_run')
  ) then
    return null;
  end if;

  insert into public.outbound_messages (
    organization_id, channel, template_key, to_e164, body, entity_type, entity_id
  ) values (
    p_organization_id, p_channel, p_template_key, v_to, p_body, p_entity_type, p_entity_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.enqueue_outbound_message(uuid, text, text, text, text, text, uuid) from public;
grant execute on function public.enqueue_outbound_message(uuid, text, text, text, text, text, uuid) to authenticated, service_role;

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
  v_phone text;
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
  end loop;

  for r in
    select
      a.id,
      a.organization_id,
      a.ends_on,
      a.ref_code,
      a.client_id,
      c.name as client_name
    from public.agreements a
    left join public.clients c on c.id = a.client_id and c.deleted_at is null
    where a.deleted_at is null
      and public.agreement_holds_inventory(a.status)
      and a.ends_on between public.ist_today() and (public.ist_today() + 30)
  loop
    select * into s
    from public.organization_notify_settings
    where organization_id = r.organization_id;
    v_has_settings := found;

    if v_has_settings and not s.agreement_reminders_enabled then
      continue;
    end if;

    v_body := 'HOARDINGS360: Agreement '
      || coalesce(nullif(r.ref_code, ''), left(r.id::text, 8))
      || ' with '
      || coalesce(r.client_name, 'client')
      || ' ends on '
      || to_char(r.ends_on, 'DD-MM-YYYY')
      || '. Pre-list faces — Available from '
      || to_char(r.ends_on + 1, 'DD-MM-YYYY')
      || '.';

    if v_has_settings and coalesce(s.ops_mobile, '') <> '' then
      if s.sms_enabled then
        v_id := public.enqueue_outbound_message(
          r.organization_id, 'sms', 'agreement_ending_ops', s.ops_mobile, v_body,
          'agreement', r.id
        );
        if v_id is not null then n := n + 1; end if;
      end if;
      if s.whatsapp_enabled then
        v_id := public.enqueue_outbound_message(
          r.organization_id, 'whatsapp', 'agreement_ending_ops', s.ops_mobile, v_body,
          'agreement', r.id
        );
        if v_id is not null then n := n + 1; end if;
      end if;
    end if;

    if (not v_has_settings) or s.client_reminders_enabled then
      select phone into v_phone
      from public.client_contacts
      where client_id = r.client_id
        and deleted_at is null
        and phone is not null
      order by is_primary desc
      limit 1;

      if v_phone is not null and v_has_settings and s.sms_enabled then
        v_body := 'HOARDINGS360: Your campaign ends on '
          || to_char(r.ends_on, 'DD-MM-YYYY')
          || ' (ref '
          || coalesce(nullif(r.ref_code, ''), left(r.id::text, 8))
          || '). Contact your media owner to renew.';
        v_id := public.enqueue_outbound_message(
          r.organization_id, 'sms', 'agreement_ending_client', v_phone, v_body,
          'agreement', r.id
        );
        if v_id is not null then n := n + 1; end if;
      end if;
    end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.enqueue_expiry_outbound_messages() from public;
grant execute on function public.enqueue_expiry_outbound_messages() to authenticated, service_role;

-- Extend refresh to enqueue outbound after in-app alerts
create or replace function public.refresh_compliance_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  recomputed integer;
  compliance_emitted integer;
  agreement_emitted integer;
  outbound_enqueued integer;
begin
  recomputed := public.recompute_all_compliance_statuses();
  compliance_emitted := public.emit_compliance_notifications();
  agreement_emitted := public.emit_agreement_ending_notifications();
  outbound_enqueued := public.enqueue_expiry_outbound_messages();

  return jsonb_build_object(
    'recomputed', recomputed,
    'compliance_emitted', compliance_emitted,
    'agreement_emitted', agreement_emitted,
    'outbound_enqueued', outbound_enqueued
  );
end;
$$;

revoke all on function public.refresh_compliance_alerts() from public;
grant execute on function public.refresh_compliance_alerts() to service_role, authenticated;

-- Claim pending outbound for Edge Function (service role)
create or replace function public.claim_pending_outbound_messages(p_limit int default 25)
returns setof public.outbound_messages
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with cte as (
    select id
    from public.outbound_messages
    where status = 'pending'
    order by created_at
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  )
  update public.outbound_messages m
  set attempts = m.attempts + 1
  from cte
  where m.id = cte.id
  returning m.*;
end;
$$;

revoke all on function public.claim_pending_outbound_messages(int) from public;
grant execute on function public.claim_pending_outbound_messages(int) to service_role;
