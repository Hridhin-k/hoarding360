-- M04 Compliance engine: computed status, mandatory flag, unpublish on expiry

alter table public.compliance_records
  add column if not exists is_mandatory boolean not null default true,
  add column if not exists under_renewal boolean not null default false,
  add column if not exists notes text;

create or replace function public.ist_today()
returns date
language sql
stable
as $$
  select (timezone('Asia/Kolkata', now()))::date;
$$;

create or replace function public.compute_compliance_status(
  p_expiry date,
  p_under_renewal boolean default false
)
returns public.compliance_status
language plpgsql
immutable
as $$
begin
  if coalesce(p_under_renewal, false) then
    return 'under_renewal';
  end if;
  if p_expiry is null then
    return 'missing';
  end if;
  -- Compare using calendar dates; caller should pass IST-oriented dates
  if p_expiry < current_date then
    return 'expired';
  end if;
  if p_expiry <= (current_date + 30) then
    return 'expiring_soon';
  end if;
  return 'valid';
end;
$$;

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
  elsif new.expiry_date <= (today + 30) then
    new.status := 'expiring_soon';
  else
    new.status := 'valid';
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_records_status_bi on public.compliance_records;
create trigger compliance_records_status_bi
  before insert or update of expiry_date, under_renewal on public.compliance_records
  for each row execute function public.compliance_records_set_status();

-- Recompute all statuses (for nightly job / manual refresh)
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
    when expiry_date <= (today + 30) then 'expiring_soon'::public.compliance_status
    else 'valid'::public.compliance_status
  end,
  updated_at = timezone('utc', now())
  where deleted_at is null;

  get diagnostics n = row_count;

  -- Auto-unpublish faces on boards with expired mandatory clearance
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

revoke all on function public.recompute_all_compliance_statuses() from public;
grant execute on function public.recompute_all_compliance_statuses() to service_role, authenticated;

-- Board rollup: worst mandatory status
create or replace function public.board_compliance_rollup(p_board_id uuid)
returns public.compliance_status
language sql
stable
as $$
  select coalesce(
    (
      select case
        when bool_or(status = 'expired') then 'expired'::public.compliance_status
        when bool_or(status = 'missing') then 'missing'::public.compliance_status
        when bool_or(status = 'under_renewal') then 'under_renewal'::public.compliance_status
        when bool_or(status = 'expiring_soon') then 'expiring_soon'::public.compliance_status
        when bool_or(status = 'valid') then 'valid'::public.compliance_status
        else 'missing'::public.compliance_status
      end
      from public.compliance_records
      where board_id = p_board_id
        and deleted_at is null
        and is_mandatory = true
    ),
    'missing'::public.compliance_status
  );
$$;

grant execute on function public.board_compliance_rollup(uuid) to authenticated;

-- Refresh existing rows once
select public.recompute_all_compliance_statuses();
