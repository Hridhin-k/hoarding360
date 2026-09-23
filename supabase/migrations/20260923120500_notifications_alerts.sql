-- M07 Notifications: compliance expiry alerts + mark-read RLS
-- Live project: harding (bzgdutrmehuojindfyxi)

alter table public.notifications
  add column if not exists kind text not null default 'generic',
  add column if not exists href text;

create index if not exists notifications_open_kind_idx
  on public.notifications (user_id, kind, entity_id)
  where read_at is null;

-- Users may mark their own notifications read / acknowledged
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Emit in-app alerts for mandatory clearance risk
-- ---------------------------------------------------------------------------

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
  v_kind text;
  v_title text;
  v_body text;
  v_priority text;
  v_href text;
begin
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
      and c.status in ('expired', 'expiring_soon', 'missing')
  loop
    v_kind := 'compliance_' || r.status;
    v_href := '/manage/boards/' || r.board_id::text || '?tab=compliance';

    if r.status = 'expired' then
      v_priority := 'high';
      v_title := 'Permit expired · ' || coalesce(r.board_code, 'board');
      v_body := coalesce(r.clearance_type, 'Clearance')
        || ' on '
        || coalesce(r.board_name, r.board_code, 'board')
        || ' expired'
        || case when r.expiry_date is not null then ' on ' || to_char(r.expiry_date, 'DD-MM-YYYY') else '' end
        || '. Faces auto-unpublished.';
    elsif r.status = 'expiring_soon' then
      v_priority := 'medium';
      v_title := 'Permit expiring · ' || coalesce(r.board_code, 'board');
      v_body := coalesce(r.clearance_type, 'Clearance')
        || ' on '
        || coalesce(r.board_name, r.board_code, 'board')
        || ' expires'
        || case when r.expiry_date is not null then ' on ' || to_char(r.expiry_date, 'DD-MM-YYYY') else ' soon' end
        || '.';
    else
      v_priority := 'medium';
      v_title := 'Permit missing · ' || coalesce(r.board_code, 'board');
      v_body := coalesce(r.clearance_type, 'Clearance')
        || ' on '
        || coalesce(r.board_name, r.board_code, 'board')
        || ' has no expiry date.';
    end if;

    for m in
      select om.user_id
      from public.organization_members om
      where om.organization_id = r.organization_id
        and om.deactivated_at is null
        and om.role in (
          'company_admin'::public.org_role,
          'operations_manager'::public.org_role,
          'compliance_officer'::public.org_role
        )
    loop
      if exists (
        select 1
        from public.notifications ntf
        where ntf.user_id = m.user_id
          and ntf.entity_id = r.id
          and ntf.kind = v_kind
          and ntf.read_at is null
      ) then
        continue;
      end if;

      insert into public.notifications (
        organization_id,
        user_id,
        channel,
        priority,
        kind,
        title,
        body,
        entity_type,
        entity_id,
        href
      ) values (
        r.organization_id,
        m.user_id,
        'in_app',
        v_priority,
        v_kind,
        v_title,
        v_body,
        'compliance_record',
        r.id,
        v_href
      );

      n := n + 1;
    end loop;
  end loop;

  return n;
end;
$$;

revoke all on function public.emit_compliance_notifications() from public;
grant execute on function public.emit_compliance_notifications() to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Agreement ending soon (pre-listing window signal) — in-app only
-- ---------------------------------------------------------------------------

create or replace function public.emit_agreement_ending_notifications()
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
  v_kind text := 'agreement_ending_soon';
begin
  for r in
    select
      a.id,
      a.organization_id,
      a.ends_on,
      a.ref_code,
      c.name as client_name
    from public.agreements a
    left join public.clients c on c.id = a.client_id and c.deleted_at is null
    where a.deleted_at is null
      and public.agreement_holds_inventory(a.status)
      and a.ends_on between today and (today + 30)
  loop
    for m in
      select om.user_id
      from public.organization_members om
      where om.organization_id = r.organization_id
        and om.deactivated_at is null
        and om.role in (
          'company_admin'::public.org_role,
          'operations_manager'::public.org_role,
          'sales_executive'::public.org_role
        )
    loop
      if exists (
        select 1
        from public.notifications ntf
        where ntf.user_id = m.user_id
          and ntf.entity_id = r.id
          and ntf.kind = v_kind
          and ntf.read_at is null
      ) then
        continue;
      end if;

      insert into public.notifications (
        organization_id,
        user_id,
        channel,
        priority,
        kind,
        title,
        body,
        entity_type,
        entity_id,
        href
      ) values (
        r.organization_id,
        m.user_id,
        'in_app',
        'medium',
        v_kind,
        'Agreement ending · ' || coalesce(nullif(r.ref_code, ''), left(r.id::text, 8)),
        coalesce(r.client_name, 'Client')
          || ' ends on '
          || to_char(r.ends_on, 'DD-MM-YYYY')
          || '. Pre-list the face — Available from '
          || to_char(r.ends_on + 1, 'DD-MM-YYYY')
          || '.',
        'agreement',
        r.id,
        '/manage'
      );

      n := n + 1;
    end loop;
  end loop;

  return n;
end;
$$;

revoke all on function public.emit_agreement_ending_notifications() from public;
grant execute on function public.emit_agreement_ending_notifications() to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- One-shot refresh: recompute statuses + emit alerts
-- ---------------------------------------------------------------------------

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
begin
  recomputed := public.recompute_all_compliance_statuses();
  compliance_emitted := public.emit_compliance_notifications();
  agreement_emitted := public.emit_agreement_ending_notifications();

  return jsonb_build_object(
    'recomputed', recomputed,
    'compliance_emitted', compliance_emitted,
    'agreement_emitted', agreement_emitted
  );
end;
$$;

revoke all on function public.refresh_compliance_alerts() from public;
grant execute on function public.refresh_compliance_alerts() to service_role, authenticated;

-- Seed current risk into inboxes once
select public.refresh_compliance_alerts();
