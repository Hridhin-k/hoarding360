-- M08 Activity events: append-only insert RLS + board_id for Board 360 timeline
-- Live project: harding (bzgdutrmehuojindfyxi)

alter table public.activity_events
  add column if not exists board_id uuid references public.boards (id);

create index if not exists activity_events_board_idx
  on public.activity_events (board_id, occurred_at desc)
  where board_id is not null;

create index if not exists activity_events_org_idx
  on public.activity_events (organization_id, occurred_at desc);

-- Append-only: members may insert for their org as themselves; no update/delete
drop policy if exists activity_insert on public.activity_events;
create policy activity_insert on public.activity_events
  for insert to authenticated
  with check (
    organization_id in (select public.current_user_org_ids())
    and (actor_id is null or actor_id = auth.uid())
  );

-- Convenience RPC for consistent logging from clients / server actions
create or replace function public.log_activity_event(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_board_id uuid default null,
  p_from_value jsonb default null,
  p_to_value jsonb default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor uuid := auth.uid();
begin
  if p_organization_id is null
     or p_organization_id not in (select public.current_user_org_ids()) then
    raise exception 'Not a member of organization';
  end if;

  insert into public.activity_events (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    event_type,
    board_id,
    from_value,
    to_value,
    reason
  ) values (
    p_organization_id,
    v_actor,
    p_entity_type,
    p_entity_id,
    p_event_type,
    p_board_id,
    p_from_value,
    p_to_value,
    p_reason
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_activity_event(
  uuid, text, uuid, text, uuid, jsonb, jsonb, text
) from public;
grant execute on function public.log_activity_event(
  uuid, text, uuid, text, uuid, jsonb, jsonb, text
) to authenticated, service_role;
