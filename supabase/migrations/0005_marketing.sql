-- One generic campaign engine for WhatsApp/SMS/Email, plus automations and the
-- per-business integration/connection table. See docs/architecture.md for the
-- background-job design that drives campaign_recipients to completion.

create table public.business_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null check (
    provider in ('WHATSAPP', 'SMS_TWILIO', 'EMAIL_RESEND', 'STRIPE', 'APPLE_WALLET', 'GOOGLE_WALLET')
  ),
  status text not null default 'NOT_CONNECTED' check (status in ('NOT_CONNECTED', 'PENDING', 'CONNECTED', 'ERROR')),
  config jsonb not null default '{}'::jsonb,
  secrets_ref text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

create trigger business_integrations_set_updated_at
  before update on public.business_integrations
  for each row execute function public.set_updated_at();

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('WHATSAPP', 'SMS', 'EMAIL')),
  language text not null default 'en',
  category text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')),
  content text not null,
  provider_template_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_templates_business_id_idx on public.message_templates (business_id);

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('WHATSAPP', 'SMS', 'EMAIL')),
  audience_definition jsonb not null default '{}'::jsonb,
  message_template_id uuid references public.message_templates (id),
  message_body text,
  status text not null default 'DRAFT' check (
    status in ('DRAFT', 'QUEUED', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED')
  ),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index campaigns_business_id_idx on public.campaigns (business_id);

alter table public.customer_offers
  add constraint customer_offers_campaign_id_fkey
  foreign key (campaign_id) references public.campaigns (id) on delete set null;

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  channel_address text not null,
  status text not null default 'QUEUED' check (
    status in ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'OPTED_OUT')
  ),
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index campaign_recipients_campaign_id_idx on public.campaign_recipients (campaign_id);
create index campaign_recipients_status_idx on public.campaign_recipients (status);
-- Lets the background worker claim a batch efficiently with FOR UPDATE SKIP LOCKED.
create index campaign_recipients_queued_idx on public.campaign_recipients (campaign_id) where status = 'QUEUED';

create table public.message_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  campaign_recipient_id uuid references public.campaign_recipients (id) on delete cascade,
  event_type text not null,
  provider_message_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index message_events_campaign_recipient_id_idx on public.message_events (campaign_recipient_id);
-- Webhook idempotency: never process the same provider event twice.
create unique index message_events_provider_dedupe_idx
  on public.message_events (provider_message_id, event_type)
  where provider_message_id is not null;

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  trigger_type text not null check (
    trigger_type in ('WELCOME', 'INACTIVE', 'BIRTHDAY', 'REWARD_UNLOCKED', 'NEAR_REWARD', 'VIP')
  ),
  channel text not null check (channel in ('WHATSAPP', 'SMS', 'EMAIL')),
  message_template_id uuid references public.message_templates (id),
  configuration jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automations_business_id_idx on public.automations (business_id);

create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  -- Dedup/cooldown key, e.g. 'INACTIVE_30_2026-09-07' — lets one automation fire
  -- again later without re-firing for the same window. See docs/database.md.
  dedupe_key text not null,
  triggered_at timestamptz not null default now(),
  status text not null default 'QUEUED' check (status in ('QUEUED', 'SENT', 'SKIPPED', 'FAILED')),
  action_result jsonb not null default '{}'::jsonb,
  message_id uuid,
  unique (automation_id, customer_id, dedupe_key)
);

create index automation_runs_business_id_idx on public.automation_runs (business_id);
