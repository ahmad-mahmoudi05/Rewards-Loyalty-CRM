-- Day 5: real Stripe billing. The plan catalog and one-subscription-per-
-- business shape already existed (Day 1, migration 0006) with the exact
-- entitlement flags/prices this session's spec asks for — this migration
-- adds only what was genuinely missing: Stripe price mapping, trial
-- tracking, the fuller Stripe subscription-status vocabulary, webhook
-- idempotency, and the write path a business's own OWNER needs to create
-- their initial (trial) subscription row during onboarding.

alter table public.plans add column stripe_price_id text;

alter table public.subscriptions add column trial_ends_at timestamptz;

-- Stripe's real subscription statuses (trialing/active/past_due/canceled/
-- incomplete/incomplete_expired/unpaid/paused) — widened from Day 1's
-- smaller placeholder set now that real webhook mapping needs to be exact,
-- not lossy.
alter table public.subscriptions drop constraint subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check check (
  status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID', 'PAUSED')
);

-- The owner creates their own business's subscription row once, at
-- onboarding (a starter trial — no payment collected yet). Day 1 only ever
-- granted SELECT here; this is the one legitimate client-facing write path,
-- scoped to OWNER and (defensively) to a business with no subscription row
-- yet, so this can never be used to rewrite an existing paid subscription's
-- plan/status from the browser — only the Stripe webhook (service-role) may
-- ever do that after this initial row exists.
create policy "subscriptions_insert_owner_once" on public.subscriptions
for insert with check (
  private.business_role(business_id) = 'OWNER'
  and not exists (select 1 from public.subscriptions s where s.business_id = subscriptions.business_id)
);

-- Stripe webhook idempotency — same shape as message_events/inbound_messages:
-- Stripe's own event id is globally unique and is exactly the right dedupe key.
create table public.stripe_webhook_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
-- No client-facing policy at all: written only by the service-role webhook
-- route, read by nobody through the API (not even the owner — this is an
-- internal dedupe log, not a customer-facing audit trail).

comment on column public.subscriptions.trial_ends_at is
  'Set once, at subscription creation (onboarding). NULL for a subscription that never had a trial (e.g. created directly via a paid checkout). Trial access is gated in application code (lib/entitlements.ts) by comparing now() against this column and status = ''TRIALING'', not by a scheduled job that mutates status — Stripe itself is the source of truth for when TRIALING actually transitions to ACTIVE/INCOMPLETE_EXPIRED via the subscription.updated webhook.';
comment on column public.plans.stripe_price_id is
  'The Stripe Price id (price_...) for this plan''s monthly subscription. NULL until a real Stripe account exists and Products/Prices are created there — see docs/integrations.md. Checkout is gated on this being set, exactly like every other provider integration in this codebase.';
