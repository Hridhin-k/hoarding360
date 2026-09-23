-- Performance: evaluate auth.uid() once per query, and refresh alerts off the request path.
-- Live project: harding (bzgdutrmehuojindfyxi)

create extension if not exists pg_cron with schema pg_catalog;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()));

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (
    organization_id in (select public.current_user_org_ids())
    or user_id = (select auth.uid())
  );

drop policy if exists organization_members_insert_self on public.organization_members;
create policy organization_members_insert_self on public.organization_members
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists platform_staff_select_own on public.platform_staff;
create policy platform_staff_select_own on public.platform_staff
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists activity_insert on public.activity_events;
create policy activity_insert on public.activity_events
  for insert to authenticated
  with check (
    organization_id in (select public.current_user_org_ids())
    and (actor_id is null or actor_id = (select auth.uid()))
  );

drop policy if exists impersonation_staff_all on public.impersonation_audits;
create policy impersonation_staff_all on public.impersonation_audits
  for all to authenticated
  using ((select public.is_platform_staff()))
  with check (
    (select public.is_platform_staff())
    and staff_user_id = (select auth.uid())
  );

drop policy if exists notification_user_prefs_all on public.notification_user_prefs;
create policy notification_user_prefs_all on public.notification_user_prefs
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and organization_id in (select public.current_user_org_ids())
  )
  with check (
    user_id = (select auth.uid())
    and organization_id in (select public.current_user_org_ids())
  );

-- Dashboard and compliance pages no longer call this on every view.
do $$
declare
  existing bigint;
begin
  select jobid into existing
  from cron.job
  where jobname = 'h360_refresh_compliance_alerts';

  if existing is not null then
    perform cron.unschedule(existing);
  end if;

  perform cron.schedule(
    'h360_refresh_compliance_alerts',
    '*/15 * * * *',
    'select public.refresh_compliance_alerts()'
  );
end $$;
