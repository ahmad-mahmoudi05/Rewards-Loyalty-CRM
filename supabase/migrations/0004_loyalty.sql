-- The configurable loyalty engine: programs, per-customer accounts, the
-- generic transaction ledger, the auditable loyalty ledger, and rewards.
--
-- IMPORTANT: nothing here is coffee/padel/barber-specific. `loyalty_programs`
-- is configuration; `transactions` is a generic event; the same tables serve
-- every business_type. See docs/architecture.md.

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  description text,
  type text not null check (type in ('STAMPS', 'POINTS')),
  is_active boolean not null default true,

  -- STAMPS configuration
  stamp_required_count int check (stamp_required_count > 0),
  stamp_min_transaction_value numeric(12, 2),

  -- POINTS configuration
  points_per_currency_unit numeric(12, 4),
  points_min_transaction_value numeric(12, 2),
  points_reward_threshold numeric(12, 2),

  -- Reward configuration (single reward tier per program for MVP; tiers/multi-reward
  -- programs are a documented future extension, see docs/database.md)
  reward_name text not null,
  reward_description text,
  reward_type text not null default 'FREE_ITEM' check (reward_type in ('FREE_ITEM', 'DISCOUNT_PERCENT', 'DISCOUNT_AMOUNT', 'CREDIT')),
  reward_value numeric(12, 2),
  reward_expiry_days int,
  progress_resets_on_redeem boolean not null default true,
  allow_multiple_rewards boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint loyalty_programs_type_config check (
    (type = 'STAMPS' and stamp_required_count is not null)
    or (type = 'POINTS' and points_per_currency_unit is not null and points_reward_threshold is not null)
  )
);

create index loyalty_programs_business_id_idx on public.loyalty_programs (business_id);

create trigger loyalty_programs_set_updated_at
  before update on public.loyalty_programs
  for each row execute function public.set_updated_at();

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  loyalty_program_id uuid not null references public.loyalty_programs (id) on delete cascade,
  stamps_count int not null default 0,
  points_balance numeric(12, 2) not null default 0,
  lifetime_points numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, loyalty_program_id)
);

create index loyalty_accounts_business_id_idx on public.loyalty_accounts (business_id);

create trigger loyalty_accounts_set_updated_at
  before update on public.loyalty_accounts
  for each row execute function public.set_updated_at();

-- Generic transaction: a coffee purchase, a padel booking, a haircut, ... .
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.locations (id),
  customer_id uuid not null references public.customers (id),
  staff_user_id uuid references public.profiles (id),
  subtotal numeric(12, 2),
  total numeric(12, 2) not null,
  currency text not null default 'AED',
  external_reference text,
  source text not null default 'STAFF' check (source in ('STAFF', 'POS', 'BOOKING', 'API')),
  status text not null default 'COMPLETED' check (status in ('COMPLETED', 'VOID')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index transactions_business_id_idx on public.transactions (business_id);
create index transactions_customer_id_idx on public.transactions (customer_id);

-- Auditable ledger. Never mutate loyalty_accounts balances without a matching row here.
create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.locations (id),
  customer_id uuid not null references public.customers (id),
  loyalty_program_id uuid not null references public.loyalty_programs (id),
  source_transaction_id uuid references public.transactions (id),
  staff_user_id uuid references public.profiles (id),
  transaction_type text not null check (
    transaction_type in ('EARN', 'REDEEM', 'BONUS', 'MANUAL_ADJUSTMENT', 'REVERSAL', 'EXPIRATION')
  ),
  points_delta numeric(12, 2) not null default 0,
  stamps_delta int not null default 0,
  description text,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_reason text
);

create index loyalty_transactions_business_id_idx on public.loyalty_transactions (business_id);
create index loyalty_transactions_customer_id_idx on public.loyalty_transactions (customer_id);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  loyalty_program_id uuid not null references public.loyalty_programs (id),
  loyalty_account_id uuid not null references public.loyalty_accounts (id),
  name text not null,
  description text,
  reward_type text not null,
  value numeric(12, 2),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  source_loyalty_transaction_id uuid references public.loyalty_transactions (id),
  created_at timestamptz not null default now()
);

create index rewards_business_id_idx on public.rewards (business_id);
create index rewards_customer_id_idx on public.rewards (customer_id);
create index rewards_status_idx on public.rewards (status);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  location_id uuid references public.locations (id),
  staff_user_id uuid references public.profiles (id),
  redeemed_at timestamptz not null default now(),
  notes text,
  -- A reward can only ever be redeemed once: enforced here, not just in app code.
  unique (reward_id)
);

create table public.customer_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  campaign_id uuid,
  offer_type text not null,
  value numeric(12, 2),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
  valid_from timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index customer_offers_business_id_idx on public.customer_offers (business_id);
create index customer_offers_customer_id_idx on public.customer_offers (customer_id);

create table public.wallet_passes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  platform text not null check (platform in ('APPLE', 'GOOGLE')),
  pass_type_identifier text,
  serial_number text,
  auth_token text,
  last_pushed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (customer_id, platform)
);
