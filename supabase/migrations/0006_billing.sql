-- Stripe SaaS billing: plan catalog, one subscription per business, usage.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_monthly numeric(12, 2) not null,
  currency text not null default 'AED',
  max_locations int not null,
  max_staff int not null,
  max_customers int not null,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  automation_enabled boolean not null default false,
  white_label_enabled boolean not null default false,
  custom_domain_enabled boolean not null default false,
  advanced_analytics boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'TRIALING' check (
    status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE')
  ),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  metric text not null,
  quantity numeric(14, 2) not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now()
);

create index usage_records_business_id_idx on public.usage_records (business_id);
