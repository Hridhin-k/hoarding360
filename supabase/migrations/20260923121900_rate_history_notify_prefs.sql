-- M02 rate history · M07 per-user notification prefs
-- Live: harding (bzgdutrmehuojindfyxi)

-- ---------------------------------------------------------------------------
-- Face rate history (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.face_rate_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  face_id uuid not null references public.board_faces (id),
  board_id uuid not null references public.boards (id),
  card_rate_paise bigint,
  floor_rate_paise bigint,
  printing_charge_paise bigint,
  mounting_charge_paise bigint,
  changed_by uuid references auth.users (id),
  reason text,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index if not exists face_rate_history_face_idx
  on public.face_rate_history (face_id, occurred_at desc);

create index if not exists face_rate_history_org_idx
  on public.face_rate_history (organization_id, occurred_at desc);

alter table public.face_rate_history enable row level security;

drop policy if exists face_rate_history_select on public.face_rate_history;
create policy face_rate_history_select on public.face_rate_history
  for select to authenticated
  using (organization_id in (select public.current_user_org_ids()));

drop policy if exists face_rate_history_insert on public.face_rate_history;
create policy face_rate_history_insert on public.face_rate_history
  for insert to authenticated
  with check (organization_id in (select public.current_user_org_ids()));

create or replace function public.trg_board_faces_rate_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.card_rate_paise is distinct from old.card_rate_paise
       or new.floor_rate_paise is distinct from old.floor_rate_paise
       or new.printing_charge_paise is distinct from old.printing_charge_paise
       or new.mounting_charge_paise is distinct from old.mounting_charge_paise
     ) then
    insert into public.face_rate_history (
      organization_id, face_id, board_id,
      card_rate_paise, floor_rate_paise, printing_charge_paise, mounting_charge_paise,
      changed_by
    ) values (
      new.organization_id, new.id, new.board_id,
      new.card_rate_paise, new.floor_rate_paise, new.printing_charge_paise, new.mounting_charge_paise,
      auth.uid()
    );
  elsif tg_op = 'INSERT'
     and (
       new.card_rate_paise is not null
       or new.floor_rate_paise is not null
     ) then
    insert into public.face_rate_history (
      organization_id, face_id, board_id,
      card_rate_paise, floor_rate_paise, printing_charge_paise, mounting_charge_paise,
      changed_by, reason
    ) values (
      new.organization_id, new.id, new.board_id,
      new.card_rate_paise, new.floor_rate_paise, new.printing_charge_paise, new.mounting_charge_paise,
      auth.uid(), 'initial'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists board_faces_rate_history on public.board_faces;
create trigger board_faces_rate_history
  after insert or update of card_rate_paise, floor_rate_paise, printing_charge_paise, mounting_charge_paise
  on public.board_faces
  for each row execute function public.trg_board_faces_rate_history();

-- Seed current rates once for existing faces
insert into public.face_rate_history (
  organization_id, face_id, board_id,
  card_rate_paise, floor_rate_paise, printing_charge_paise, mounting_charge_paise,
  reason
)
select
  f.organization_id, f.id, f.board_id,
  f.card_rate_paise, f.floor_rate_paise, f.printing_charge_paise, f.mounting_charge_paise,
  'backfill'
from public.board_faces f
where f.deleted_at is null
  and not exists (
    select 1 from public.face_rate_history h where h.face_id = f.id
  );

-- ---------------------------------------------------------------------------
-- Per-user notification / digest preferences (M07)
-- ---------------------------------------------------------------------------

create table if not exists public.notification_user_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  in_app_enabled boolean not null default true,
  email_digest_enabled boolean not null default true,
  digest_frequency text not null default 'daily'
    check (digest_frequency in ('off', 'daily', 'weekly')),
  compliance_alerts boolean not null default true,
  agreement_alerts boolean not null default true,
  incident_alerts boolean not null default true,
  vacancy_alerts boolean not null default true,
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint check (quiet_hours_end between 0 and 23),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, organization_id)
);

alter table public.notification_user_prefs enable row level security;

drop policy if exists notification_user_prefs_all on public.notification_user_prefs;
create policy notification_user_prefs_all on public.notification_user_prefs
  for all to authenticated
  using (
    user_id = auth.uid()
    and organization_id in (select public.current_user_org_ids())
  )
  with check (
    user_id = auth.uid()
    and organization_id in (select public.current_user_org_ids())
  );

create or replace function public.upsert_notification_user_prefs(
  p_organization_id uuid,
  p_in_app_enabled boolean,
  p_email_digest_enabled boolean,
  p_digest_frequency text,
  p_compliance_alerts boolean,
  p_agreement_alerts boolean,
  p_incident_alerts boolean,
  p_vacancy_alerts boolean,
  p_quiet_hours_start smallint default null,
  p_quiet_hours_end smallint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_organization_id not in (select public.current_user_org_ids()) then
    raise exception 'Not a member of organization';
  end if;
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.notification_user_prefs as p (
    user_id, organization_id,
    in_app_enabled, email_digest_enabled, digest_frequency,
    compliance_alerts, agreement_alerts, incident_alerts, vacancy_alerts,
    quiet_hours_start, quiet_hours_end, updated_at
  ) values (
    auth.uid(), p_organization_id,
    coalesce(p_in_app_enabled, true),
    coalesce(p_email_digest_enabled, true),
    coalesce(p_digest_frequency, 'daily'),
    coalesce(p_compliance_alerts, true),
    coalesce(p_agreement_alerts, true),
    coalesce(p_incident_alerts, true),
    coalesce(p_vacancy_alerts, true),
    p_quiet_hours_start,
    p_quiet_hours_end,
    timezone('utc', now())
  )
  on conflict (user_id, organization_id) do update set
    in_app_enabled = excluded.in_app_enabled,
    email_digest_enabled = excluded.email_digest_enabled,
    digest_frequency = excluded.digest_frequency,
    compliance_alerts = excluded.compliance_alerts,
    agreement_alerts = excluded.agreement_alerts,
    incident_alerts = excluded.incident_alerts,
    vacancy_alerts = excluded.vacancy_alerts,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.upsert_notification_user_prefs(
  uuid, boolean, boolean, text, boolean, boolean, boolean, boolean, smallint, smallint
) from public;
grant execute on function public.upsert_notification_user_prefs(
  uuid, boolean, boolean, text, boolean, boolean, boolean, boolean, smallint, smallint
) to authenticated;
