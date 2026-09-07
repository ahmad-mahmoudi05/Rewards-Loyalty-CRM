-- Day 4.5: closes the Day 4 messaging/provider gaps documented in
-- docs/integrations.md — Meta webhook, Twilio webhook, WhatsApp/SMS
-- opt-out, and Meta template synchronization. See docs/database.md
-- "Day 4.5 additions" for the full design rationale.

-- ---------------------------------------------------------------------------
-- inbound_messages: one generic table for any inbound provider event that
-- isn't a status update on a message we sent (customer-initiated WhatsApp
-- messages, inbound SMS incl. STOP). Reuses the project's "one system per
-- capability, not one per channel" rule (see docs/architecture.md) rather
-- than inventing a whatsapp_events + sms_events pair. Enough to build a
-- future unified inbox on without building the inbox itself today.
-- ---------------------------------------------------------------------------

create table public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  channel text not null check (channel in ('WHATSAPP', 'SMS')),
  from_address text not null,
  to_address text,
  provider_message_id text,
  body text,
  is_optout boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index inbound_messages_business_id_idx on public.inbound_messages (business_id);

-- Webhook idempotency for inbound events, mirroring message_events' pattern.
create unique index inbound_messages_provider_dedupe_idx
  on public.inbound_messages (channel, provider_message_id)
  where provider_message_id is not null;

alter table public.inbound_messages enable row level security;

create policy "inbound_messages_select_owner_or_manager" on public.inbound_messages
for select using (business_id is not null and private.is_business_owner_or_manager(business_id));

-- ---------------------------------------------------------------------------
-- automation-sent messages don't have a dedicated provider_message_id column
-- (it lives in automation_runs.action_result, set by
-- services/automations/shared.ts::sendAutomationMessage) — an expression
-- index lets the Meta/Twilio webhooks resolve status updates for
-- automation-originated sends the same way they already do for
-- campaign_recipients, without a schema change to a table Day 4 already
-- shipped and tested.
-- ---------------------------------------------------------------------------

create index automation_runs_provider_message_idx
  on public.automation_runs ((action_result ->> 'provider_message_id'))
  where action_result ->> 'provider_message_id' is not null;

-- ---------------------------------------------------------------------------
-- message_templates: add the fields Meta template sync needs to store per
-- template (components/content, category state, last sync time), and widen
-- the status set to Meta's real template states.
-- ---------------------------------------------------------------------------

alter table public.message_templates
  add column components jsonb not null default '[]'::jsonb,
  add column last_synced_at timestamptz;

alter table public.message_templates drop constraint message_templates_status_check;
alter table public.message_templates add constraint message_templates_status_check check (
  status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED')
);

-- A synced template is uniquely identified by its Meta template id, per business.
create unique index message_templates_provider_template_idx
  on public.message_templates (business_id, provider_template_id)
  where provider_template_id is not null;

-- ---------------------------------------------------------------------------
-- Loyalty expiry decision (spec item 5): the second path was chosen —
-- LOYALTY_EXPIRY_REMINDER is removed from v1, not shipped as a fake
-- automation. Retrofitting real lot-based points/stamps expiry into the
-- already-tested Day 2 loyalty engine (record_transaction/redeem_reward,
-- both hit on every scan) is materially riskier than the rest of this
-- session's scope, which is why it's deferred rather than rushed — see
-- docs/database.md "Loyalty expiry — deferred" for the full reasoning and
-- the concrete design to implement post-launch. No business ever had this
-- automation enabled (the evaluator was a documented permanent no-op), so
-- this is a clean removal, not a breaking change to live data.
-- ---------------------------------------------------------------------------

delete from public.automation_runs where automation_id in (
  select id from public.automations where trigger_type = 'LOYALTY_EXPIRY_REMINDER'
);
delete from public.automations where trigger_type = 'LOYALTY_EXPIRY_REMINDER';

alter table public.automations drop constraint automations_trigger_type_check;
alter table public.automations add constraint automations_trigger_type_check check (
  trigger_type in ('INACTIVE_WINBACK', 'BIRTHDAY_REWARD', 'REWARD_READY_REMINDER', 'VIP_UPGRADE')
);
