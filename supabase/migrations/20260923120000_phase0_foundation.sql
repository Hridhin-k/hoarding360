-- Phase 0 / V0 foundation — M01 Identity, M02 Asset registry core, reserved V4 shells
-- Live project: harding (bzgdutrmehuojindfyxi)
-- Money in paise; soft delete; PostGIS; org = tenant boundary

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (status machines — UI must not free-text compare)
-- ---------------------------------------------------------------------------

create type public.org_role as enum (
  'company_admin',
  'operations_manager',
  'sales_executive',
  'compliance_officer',
  'finance_officer',
  'field_supervisor',
  'field_technician'
);

create type public.lifecycle_status as enum (
  'draft',
  'pending_verification',
  'active',
  'under_maintenance',
  'blocked',
  'non_compliant',
  'retired'
);

create type public.compliance_status as enum (
  'valid',
  'expiring_soon',
  'expired',
  'missing',
  'under_renewal'
);

create type public.occupancy_status as enum (
  'vacant',
  'becoming_vacant',
  'on_hold',
  'booked_future',
  'occupied',
  'blocked'
);

create type public.ownership_type as enum (
  'owned',
  'leased_in',
  'managed_for_third_party'
);

create type public.illumination_type as enum (
  'frontlit',
  'backlit',
  'nonlit',
  'led'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- M01 — organizations, members, profiles
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  gstin text,
  address_line text,
  city text,
  state text,
  pin_code text,
  logo_url text,
  brand_primary text,
  brand_secondary text,
  plan text not null default 'starter',
  feature_flags jsonb not null default '{}'::jsonb,
  suspended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text
);

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'sales_executive',
  geography_scope jsonb,
  invited_by uuid references auth.users (id),
  deactivated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id)
  where deactivated_at is null;

create trigger organization_members_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

create or replace function public.current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and deactivated_at is null;
$$;

revoke all on function public.current_user_org_ids() from public;
grant execute on function public.current_user_org_ids() to authenticated;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- M02 — boards + board_faces
-- ---------------------------------------------------------------------------

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_code text not null,
  name text not null,
  structure_type text not null default 'hoarding',
  location public.geography(Point, 4326),
  address_line text,
  landmark text,
  city text,
  district text,
  state text,
  pin_code text,
  ward_zone text,
  road_name text,
  road_category text,
  ownership_type public.ownership_type not null default 'owned',
  installed_on date,
  lifecycle_status public.lifecycle_status not null default 'draft',
  how_to_reach text,
  street_view_url text,
  meter_no text,
  last_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  unique (organization_id, board_code)
);

create index boards_org_idx on public.boards (organization_id) where deleted_at is null;
create index boards_location_gix on public.boards using gist (location);

create trigger boards_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

create table public.board_faces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid not null references public.boards (id),
  face_label text not null,
  facing_direction text,
  width_ft numeric(8, 2),
  height_ft numeric(8, 2),
  area_sqft numeric(12, 2) generated always as (
    case
      when width_ft is not null and height_ft is not null then width_ft * height_ft
      else null
    end
  ) stored,
  illumination public.illumination_type default 'nonlit',
  visibility_m int,
  traffic_direction text,
  card_rate_paise bigint,
  floor_rate_paise bigint,
  printing_charge_paise bigint,
  mounting_charge_paise bigint,
  is_publishable boolean not null default false,
  occupancy_status public.occupancy_status not null default 'vacant',
  available_from date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  unique (board_id, face_label)
);

create index board_faces_org_idx on public.board_faces (organization_id) where deleted_at is null;
create index board_faces_board_idx on public.board_faces (board_id) where deleted_at is null;

create trigger board_faces_updated_at
  before update on public.board_faces
  for each row execute function public.set_updated_at();

create table public.board_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid not null references public.boards (id),
  face_id uuid references public.board_faces (id),
  kind text not null default 'day', -- day | night | approach | other
  storage_path text not null,
  captured_at timestamptz,
  is_cover boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text
);

-- ---------------------------------------------------------------------------
-- M03 — polymorphic documents
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  entity_type text not null,
  entity_id uuid not null,
  doc_type text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  byte_size bigint,
  checksum text,
  issuing_authority text,
  reference_no text,
  issue_date date,
  expiry_date date,
  amount_paise bigint,
  signature_status text,
  version_no int not null default 1,
  supersedes_id uuid references public.documents (id),
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text
);

create index documents_entity_idx on public.documents (organization_id, entity_type, entity_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- M04 — compliance (many clearances per board)
-- ---------------------------------------------------------------------------

create table public.compliance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid not null references public.boards (id),
  clearance_type text not null,
  governing_body text not null,
  reference_no text,
  issue_date date,
  expiry_date date,
  renewal_cycle_months int,
  fee_paid_paise bigint,
  status public.compliance_status not null default 'missing',
  document_id uuid references public.documents (id),
  supersedes_id uuid references public.compliance_records (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text
);

create index compliance_board_idx on public.compliance_records (board_id) where deleted_at is null;
create index compliance_expiry_idx on public.compliance_records (organization_id, expiry_date)
  where deleted_at is null;

create trigger compliance_records_updated_at
  before update on public.compliance_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- M05 — clients & agreements
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  gstin text,
  billing_address text,
  industry text,
  payment_terms text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text
);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid not null references public.clients (id),
  name text not null,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid not null references public.clients (id),
  campaign_id uuid, -- FK added after campaigns reserved table
  ref_code text,
  starts_on date not null,
  ends_on date not null,
  value_paise bigint,
  status text not null default 'draft', -- state machine config later
  document_id uuid references public.documents (id),
  sales_owner_id uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  check (ends_on >= starts_on)
);

create trigger agreements_updated_at
  before update on public.agreements
  for each row execute function public.set_updated_at();

create table public.agreement_faces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  agreement_id uuid not null references public.agreements (id),
  face_id uuid not null references public.board_faces (id),
  rate_paise bigint,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  check (ends_on >= starts_on)
);

create index agreement_faces_face_idx on public.agreement_faces (face_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- M06 — occupancy periods (materialised)
-- ---------------------------------------------------------------------------

create table public.occupancy_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  face_id uuid not null references public.board_faces (id),
  status public.occupancy_status not null,
  starts_on date not null,
  ends_on date,
  agreement_id uuid references public.agreements (id),
  block_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index occupancy_periods_face_idx on public.occupancy_periods (face_id, starts_on);

-- ---------------------------------------------------------------------------
-- M07 / M08 — notifications + activity
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references auth.users (id),
  channel text not null default 'in_app',
  priority text not null default 'medium',
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  actor_id uuid references auth.users (id),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  from_value jsonb,
  to_value jsonb,
  reason text,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index activity_events_entity_idx on public.activity_events (entity_type, entity_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Reserved shells (V2.1 / V4.0) — empty but present
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid references public.clients (id),
  name text not null,
  brand text,
  objective text,
  starts_on date,
  ends_on date,
  value_paise bigint,
  status text not null default 'draft',
  sales_owner_id uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

alter table public.agreements
  add constraint agreements_campaign_fk
  foreign key (campaign_id) references public.campaigns (id);

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid not null references public.boards (id),
  landowner_name text,
  starts_on date,
  ends_on date,
  rent_paise bigint,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid references public.boards (id),
  face_id uuid references public.board_faces (id),
  wo_type text not null default 'inspection',
  status text not null default 'draft',
  assigned_to uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  board_id uuid references public.boards (id),
  category text not null,
  amount_paise bigint not null,
  incurred_on date,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  service_types text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  created_by uuid references auth.users (id),
  entity_kind text not null,
  status text not null default 'pending',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Platform staff (M33 basic)
-- ---------------------------------------------------------------------------

create table public.platform_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'super_admin',
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.boards enable row level security;
alter table public.board_faces enable row level security;
alter table public.board_photos enable row level security;
alter table public.documents enable row level security;
alter table public.compliance_records enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_faces enable row level security;
alter table public.occupancy_periods enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_events enable row level security;
alter table public.campaigns enable row level security;
alter table public.leases enable row level security;
alter table public.work_orders enable row level security;
alter table public.expenses enable row level security;
alter table public.vendors enable row level security;
alter table public.import_jobs enable row level security;
alter table public.platform_staff enable row level security;

-- Profiles: own row
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid());

-- Members can see their orgs
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (id in (select public.current_user_org_ids()) and deleted_at is null);

create policy organization_members_select on public.organization_members
  for select to authenticated
  using (organization_id in (select public.current_user_org_ids()) or user_id = auth.uid());

-- Generic org-scoped select policies
create policy boards_select on public.boards
  for select to authenticated
  using (organization_id in (select public.current_user_org_ids()) and deleted_at is null);
create policy boards_insert on public.boards
  for insert to authenticated
  with check (organization_id in (select public.current_user_org_ids()));
create policy boards_update on public.boards
  for update to authenticated
  using (organization_id in (select public.current_user_org_ids()));

create policy board_faces_select on public.board_faces
  for select to authenticated
  using (organization_id in (select public.current_user_org_ids()) and deleted_at is null);
create policy board_faces_insert on public.board_faces
  for insert to authenticated
  with check (organization_id in (select public.current_user_org_ids()));
create policy board_faces_update on public.board_faces
  for update to authenticated
  using (organization_id in (select public.current_user_org_ids()));

create policy board_photos_all on public.board_photos
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy documents_all on public.documents
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy compliance_all on public.compliance_records
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy clients_all on public.clients
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy client_contacts_all on public.client_contacts
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy agreements_all on public.agreements
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy agreement_faces_all on public.agreement_faces
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy occupancy_all on public.occupancy_periods
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy activity_select on public.activity_events
  for select to authenticated
  using (organization_id in (select public.current_user_org_ids()) or organization_id is null);

create policy campaigns_all on public.campaigns
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy leases_all on public.leases
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy work_orders_all on public.work_orders
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy expenses_all on public.expenses
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy vendors_all on public.vendors
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy import_jobs_all on public.import_jobs
  for all to authenticated
  using (organization_id in (select public.current_user_org_ids()))
  with check (organization_id in (select public.current_user_org_ids()));

create policy platform_staff_select_own on public.platform_staff
  for select to authenticated
  using (user_id = auth.uid());

-- Org insert: authenticated users can create an org (onboarding); membership insert via security definer RPC later
create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (true);

create policy organization_members_insert_self on public.organization_members
  for insert to authenticated
  with check (user_id = auth.uid());
