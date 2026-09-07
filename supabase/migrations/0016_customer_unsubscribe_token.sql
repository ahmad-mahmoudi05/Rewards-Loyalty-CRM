-- A stable, per-customer opaque token for the email unsubscribe link
-- (/unsubscribe/[token]) — deliberately separate from customers.wallet_token
-- (the loyalty-card identity from Day 3): different purpose, different
-- exposure surface (this one goes out in every marketing email), and
-- rotating one must never affect the other.

alter table public.customers
  add column unsubscribe_token uuid not null unique default gen_random_uuid();
