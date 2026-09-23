-- M09 dashboard views: live agreements (campaigns proxy) + revenue helpers
-- Live project: harding (bzgdutrmehuojindfyxi)

create or replace view public.live_agreements
with (security_invoker = true)
as
select
  a.id,
  a.organization_id,
  a.ref_code,
  a.starts_on,
  a.ends_on,
  a.value_paise,
  a.status,
  a.campaign_id,
  c.id as client_id,
  c.name as client_name,
  (
    select count(*)::int
    from public.agreement_faces af
    where af.agreement_id = a.id
      and af.deleted_at is null
  ) as face_count
from public.agreements a
join public.clients c on c.id = a.client_id and c.deleted_at is null
where a.deleted_at is null
  and public.agreement_holds_inventory(a.status)
  and a.starts_on <= public.ist_today()
  and a.ends_on >= public.ist_today();

grant select on public.live_agreements to authenticated;

-- Contracted revenue currently live (sum of live agreement values)
create or replace function public.org_live_revenue_paise(p_organization_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(value_paise), 0)::bigint
  from public.live_agreements
  where organization_id = p_organization_id;
$$;

revoke all on function public.org_live_revenue_paise(uuid) from public;
grant execute on function public.org_live_revenue_paise(uuid) to authenticated;
