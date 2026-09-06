-- Core tenancy: profiles (1:1 with auth.users), businesses, business_members,
-- locations, business_branding. Plus the SECURITY DEFINER helper functions that
-- every later RLS policy relies on to avoid recursive-policy problems.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created (signup).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type text not null default 'OTHER'
    check (business_type in (
      'COFFEE_SHOP', 'PADEL', 'BARBER', 'SALON', 'GYM', 'RESTAURANT', 'OTHER'
    )),
  owner_profile_id uuid not null references public.profiles (id),
  country text not null default 'AE',
  currency text not null default 'AED',
  timezone text not null default 'Asia/Dubai',
  status text not null default 'TRIALING'
    check (status in ('TRIALING', 'ACTIVE', 'SUSPENDED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_owner_profile_id_idx on public.businesses (owner_profile_id);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- business_members
-- ---------------------------------------------------------------------------

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('OWNER', 'MANAGER', 'STAFF')),
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (business_id, profile_id)
);

create index business_members_profile_id_idx on public.business_members (profile_id);
create index business_members_business_id_idx on public.business_members (business_id);

-- Whenever a business is created, its owner automatically becomes an OWNER member.
-- This keeps "create a business" a single INSERT from the client while still
-- guaranteeing every business has exactly one authoritative owner membership.
create or replace function public.handle_new_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_members (business_id, profile_id, role)
  values (new.id, new.owner_profile_id, 'OWNER')
  on conflict (business_id, profile_id) do nothing;
  return new;
end;
$$;

create trigger on_business_created
  after insert on public.businesses
  for each row execute function public.handle_new_business();

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  address text,
  phone text,
  map_url text,
  timezone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_business_id_idx on public.locations (business_id);

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- business_branding
-- ---------------------------------------------------------------------------

create table public.business_branding (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  logo_url text,
  square_logo_url text,
  wallet_logo_url text,
  primary_color text not null default '#171717',
  secondary_color text,
  background_color text not null default '#ffffff',
  text_color text not null default '#171717',
  font_family text,
  button_style text not null default 'rounded' check (button_style in ('rounded', 'pill', 'square')),
  custom_terminology jsonb not null default '{}'::jsonb,
  white_label_level text not null default 'STANDARD'
    check (white_label_level in ('STANDARD', 'WHITE_LABEL', 'ENTERPRISE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger business_branding_set_updated_at
  before update on public.business_branding
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER: bypass RLS on the tables they read,
-- so policies that call them don't recurse into themselves).
-- ---------------------------------------------------------------------------

create or replace function private.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function private.business_role(target_business_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.business_members
  where business_id = target_business_id and profile_id = auth.uid()
  limit 1;
$$;

create or replace function private.is_business_member(target_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id and profile_id = auth.uid()
  );
$$;

create or replace function private.is_business_owner_or_manager(target_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id
      and profile_id = auth.uid()
      and role in ('OWNER', 'MANAGER')
  );
$$;
