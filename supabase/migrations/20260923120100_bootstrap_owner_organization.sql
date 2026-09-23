-- Fix owner signup bootstrap: SECURITY DEFINER bypasses RLS safely for org creation

create or replace function public.bootstrap_owner_organization(
  p_org_name text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_existing uuid;
begin
  if p_org_name is null or length(trim(p_org_name)) = 0 then
    raise exception 'organization name required';
  end if;

  if p_user_id is null then
    raise exception 'user id required';
  end if;

  -- Idempotent: if already a member, return that org
  select organization_id into v_existing
  from public.organization_members
  where user_id = p_user_id
    and deactivated_at is null
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.organizations (name)
  values (trim(p_org_name))
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, p_user_id, 'company_admin');

  return v_org_id;
end;
$$;

revoke all on function public.bootstrap_owner_organization(text, uuid) from public;
grant execute on function public.bootstrap_owner_organization(text, uuid) to service_role;

-- Allow authenticated users to create an org only when attaching themselves as first admin
-- (backup path if service role RPC unavailable)
create or replace function public.create_organization_for_me(p_org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  return public.bootstrap_owner_organization(p_org_name, v_uid);
end;
$$;

revoke all on function public.create_organization_for_me(text) from public;
grant execute on function public.create_organization_for_me(text) to authenticated;
