-- CRM: customers, per-channel marketing consent, tags.
--
-- Uniqueness is (business_id, phone_normalized) — NOT globally unique — because
-- the same person can be a customer of unrelated businesses on the platform.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  first_name text not null,
  last_name text,
  phone_raw text not null,
  phone_normalized text not null,
  email text,
  birthday date,
  gender text,
  wallet_token uuid not null unique default gen_random_uuid(),
  source text not null default 'MANUAL',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone_normalized)
);

create index customers_business_id_idx on public.customers (business_id);
create index customers_wallet_token_idx on public.customers (wallet_token);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create table public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  channel text not null check (channel in ('WHATSAPP', 'SMS', 'EMAIL')),
  status text not null check (status in ('GRANTED', 'REVOKED')),
  consented_at timestamptz,
  revoked_at timestamptz,
  source text,
  policy_version text,
  created_at timestamptz not null default now(),
  unique (business_id, customer_id, channel)
);

create index customer_consents_customer_id_idx on public.customer_consents (customer_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.customer_tags (
  customer_id uuid not null references public.customers (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id)
);
