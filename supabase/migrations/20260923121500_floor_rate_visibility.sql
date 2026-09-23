-- M01 / V1.0: sensitive rate visibility helpers (sales never sees floor/costs)
-- Column grants cannot vary by JWT org role; enforce via helper + app select lists.

create or replace function public.member_can_see_floor_rates(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.user_id = p_user_id
      and om.deactivated_at is null
      and om.role in (
        'company_admin',
        'operations_manager',
        'finance_officer'
      )
  );
$$;

revoke all on function public.member_can_see_floor_rates(uuid) from public;
grant execute on function public.member_can_see_floor_rates(uuid) to authenticated, service_role;

comment on function public.member_can_see_floor_rates(uuid) is
  'True for company_admin / operations_manager / finance_officer. Sales and field must not read floor_rate_paise or cost columns.';
