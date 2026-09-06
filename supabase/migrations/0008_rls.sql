-- Row Level Security: this is the tenant-isolation boundary for the
-- authenticated dashboard path (see docs/architecture.md "Two data paths").
--
-- Design rules applied consistently below:
-- 1. Every business-owned table has RLS enabled.
-- 2. SELECT is generally available to any member of the business (STAFF
--    included) because staff need to see customers/loyalty/rewards to do
--    their job at the counter — EXCEPT tables explicitly called out in
--    AGENTS spec section 5 as staff-hidden (billing, integrations/API
--    credentials, audit log, campaign recipient contact data).
-- 3. Ledger tables that must never reflect unvalidated client math
--    (loyalty_accounts, transactions, loyalty_transactions, rewards,
--    reward_redemptions) intentionally get NO client-facing INSERT/UPDATE
--    policy. Rows are written exclusively by SECURITY DEFINER RPC functions
--    (added alongside the loyalty engine, Day 2) or the service-role key
--    (public customer-signup path). Table owner (postgres) is exempt from
--    its own RLS, so those definer functions still work — this is the same
--    mechanism the private.is_business_member() helper already relies on.
-- 4. Writing "no policy" for a command is deliberate, not an oversight.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_self_or_teammate_or_admin" on public.profiles
for select using (
  id = auth.uid()
  or private.is_platform_admin()
  or exists (
    select 1 from public.business_members mine
    join public.business_members theirs on theirs.business_id = mine.business_id
    where mine.profile_id = auth.uid() and theirs.profile_id = public.profiles.id
  )
);

create policy "profiles_update_self" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

alter table public.businesses enable row level security;

create policy "businesses_select_members" on public.businesses
for select using (private.is_business_member(id) or private.is_platform_admin());

create policy "businesses_insert_self_as_owner" on public.businesses
for insert with check (owner_profile_id = auth.uid());

create policy "businesses_update_owner" on public.businesses
for update using (private.business_role(id) = 'OWNER' or private.is_platform_admin())
with check (private.business_role(id) = 'OWNER' or private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- business_members
-- ---------------------------------------------------------------------------

alter table public.business_members enable row level security;

create policy "business_members_select_same_business" on public.business_members
for select using (private.is_business_member(business_id) or private.is_platform_admin());

create policy "business_members_write_owner_or_manager" on public.business_members
for all using (private.is_business_owner_or_manager(business_id) or private.is_platform_admin())
with check (private.is_business_owner_or_manager(business_id) or private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------

alter table public.locations enable row level security;

create policy "locations_select_members" on public.locations
for select using (private.is_business_member(business_id));

create policy "locations_write_owner_or_manager" on public.locations
for all using (private.is_business_owner_or_manager(business_id))
with check (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- business_branding
-- ---------------------------------------------------------------------------

alter table public.business_branding enable row level security;

create policy "business_branding_select_members" on public.business_branding
for select using (private.is_business_member(business_id));

create policy "business_branding_write_owner_or_manager" on public.business_branding
for all using (private.is_business_owner_or_manager(business_id))
with check (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;

create policy "customers_select_members" on public.customers
for select using (private.is_business_member(business_id));

create policy "customers_insert_members" on public.customers
for insert with check (private.is_business_member(business_id));

create policy "customers_update_members" on public.customers
for update using (private.is_business_member(business_id))
with check (private.is_business_member(business_id));

create policy "customers_delete_owner" on public.customers
for delete using (private.business_role(business_id) = 'OWNER');

-- ---------------------------------------------------------------------------
-- customer_consents
-- ---------------------------------------------------------------------------

alter table public.customer_consents enable row level security;

create policy "customer_consents_select_members" on public.customer_consents
for select using (private.is_business_member(business_id));

create policy "customer_consents_write_members" on public.customer_consents
for all using (private.is_business_member(business_id))
with check (private.is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- tags / customer_tags
-- ---------------------------------------------------------------------------

alter table public.tags enable row level security;

create policy "tags_all_members" on public.tags
for all using (private.is_business_member(business_id))
with check (private.is_business_member(business_id));

alter table public.customer_tags enable row level security;

create policy "customer_tags_all_members" on public.customer_tags
for all using (
  exists (
    select 1 from public.customers c
    where c.id = customer_tags.customer_id and private.is_business_member(c.business_id)
  )
)
with check (
  exists (
    select 1 from public.customers c
    where c.id = customer_tags.customer_id and private.is_business_member(c.business_id)
  )
);

-- ---------------------------------------------------------------------------
-- loyalty_programs (config: OWNER/MANAGER only write, all members read)
-- ---------------------------------------------------------------------------

alter table public.loyalty_programs enable row level security;

create policy "loyalty_programs_select_members" on public.loyalty_programs
for select using (private.is_business_member(business_id));

create policy "loyalty_programs_write_owner_or_manager" on public.loyalty_programs
for all using (private.is_business_owner_or_manager(business_id))
with check (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- loyalty_accounts (read-only to clients; written only by definer RPCs)
-- ---------------------------------------------------------------------------

alter table public.loyalty_accounts enable row level security;

create policy "loyalty_accounts_select_members" on public.loyalty_accounts
for select using (private.is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- transactions (read-only to clients; written only by definer RPCs)
-- ---------------------------------------------------------------------------

alter table public.transactions enable row level security;

create policy "transactions_select_members" on public.transactions
for select using (private.is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- loyalty_transactions (read-only to clients; written only by definer RPCs)
-- ---------------------------------------------------------------------------

alter table public.loyalty_transactions enable row level security;

create policy "loyalty_transactions_select_members" on public.loyalty_transactions
for select using (private.is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- rewards (read-only to clients; written only by definer RPCs)
-- ---------------------------------------------------------------------------

alter table public.rewards enable row level security;

create policy "rewards_select_members" on public.rewards
for select using (private.is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- reward_redemptions (read-only to clients; written only by definer RPCs)
-- ---------------------------------------------------------------------------

alter table public.reward_redemptions enable row level security;

create policy "reward_redemptions_select_members" on public.reward_redemptions
for select using (private.is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- customer_offers
-- ---------------------------------------------------------------------------

alter table public.customer_offers enable row level security;

create policy "customer_offers_select_members" on public.customer_offers
for select using (private.is_business_member(business_id));

create policy "customer_offers_write_owner_or_manager" on public.customer_offers
for all using (private.is_business_owner_or_manager(business_id))
with check (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- wallet_passes
-- ---------------------------------------------------------------------------

alter table public.wallet_passes enable row level security;

create policy "wallet_passes_select_members" on public.wallet_passes
for select using (private.is_business_member(business_id));

create policy "wallet_passes_write_members" on public.wallet_passes
for all using (private.is_business_member(business_id))
with check (private.is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- business_integrations (contains credential references — OWNER/MANAGER only)
-- ---------------------------------------------------------------------------

alter table public.business_integrations enable row level security;

create policy "business_integrations_owner_or_manager_only" on public.business_integrations
for all using (private.is_business_owner_or_manager(business_id))
with check (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- message_templates
-- ---------------------------------------------------------------------------

alter table public.message_templates enable row level security;

create policy "message_templates_select_members" on public.message_templates
for select using (private.is_business_member(business_id));

create policy "message_templates_write_owner_or_manager" on public.message_templates
for all using (private.is_business_owner_or_manager(business_id))
with check (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- campaigns (marketing is an owner/manager function, not staff)
-- ---------------------------------------------------------------------------

alter table public.campaigns enable row level security;

create policy "campaigns_select_owner_or_manager" on public.campaigns
for select using (private.is_business_owner_or_manager(business_id));

create policy "campaigns_write_owner_or_manager" on public.campaigns
for all using (private.is_business_owner_or_manager(business_id))
with check (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- campaign_recipients (customer contact data + send status; system-written)
-- ---------------------------------------------------------------------------

alter table public.campaign_recipients enable row level security;

create policy "campaign_recipients_select_owner_or_manager" on public.campaign_recipients
for select using (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- message_events (webhook log; system-written)
-- ---------------------------------------------------------------------------

alter table public.message_events enable row level security;

create policy "message_events_select_owner_or_manager" on public.message_events
for select using (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- automations
-- ---------------------------------------------------------------------------

alter table public.automations enable row level security;

create policy "automations_select_members" on public.automations
for select using (private.is_business_member(business_id));

create policy "automations_write_owner_or_manager" on public.automations
for all using (private.is_business_owner_or_manager(business_id))
with check (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- automation_runs (system-written)
-- ---------------------------------------------------------------------------

alter table public.automation_runs enable row level security;

create policy "automation_runs_select_owner_or_manager" on public.automation_runs
for select using (private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- plans (public pricing catalog — readable by anyone, written by platform only)
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;

create policy "plans_select_anyone" on public.plans
for select using (true);

-- ---------------------------------------------------------------------------
-- subscriptions (billing — OWNER only, not even MANAGER, per spec section 5)
-- ---------------------------------------------------------------------------

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_owner" on public.subscriptions
for select using (private.business_role(business_id) = 'OWNER');

-- ---------------------------------------------------------------------------
-- usage_records (billing-adjacent — OWNER only)
-- ---------------------------------------------------------------------------

alter table public.usage_records enable row level security;

create policy "usage_records_select_owner" on public.usage_records
for select using (private.business_role(business_id) = 'OWNER');

-- ---------------------------------------------------------------------------
-- audit_logs (OWNER/MANAGER read-only; never client-writable)
-- ---------------------------------------------------------------------------

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_owner_or_manager" on public.audit_logs
for select using (
  business_id is null and private.is_platform_admin()
  or private.is_business_owner_or_manager(business_id)
);
