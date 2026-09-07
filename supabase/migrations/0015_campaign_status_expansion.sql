-- Day 4 expands the Day 1 campaign/recipient status models to the full
-- lifecycle the spec requires, and adds the bookkeeping a real background
-- worker needs (retry count, next attempt, atomic per-recipient claiming).
-- No existing rows to migrate — these tables are empty in production so far.

alter table public.campaigns drop constraint campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check check (
  status in ('DRAFT', 'SCHEDULED', 'QUEUED', 'SENDING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED')
);

alter table public.campaign_recipients drop constraint campaign_recipients_status_check;
alter table public.campaign_recipients add constraint campaign_recipients_status_check check (
  status in (
    'PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'CLICKED',
    'FAILED', 'SKIPPED_NO_CONSENT', 'SKIPPED_INVALID_ADDRESS', 'UNSUBSCRIBED', 'CANCELLED'
  )
);

-- A customer appears at most once per campaign's recipient snapshot —
-- the ON CONFLICT DO NOTHING in the snapshot RPC relies on this.
alter table public.campaign_recipients add constraint campaign_recipients_campaign_customer_key
  unique (campaign_id, customer_id);

alter table public.campaign_recipients add column attempt_count int not null default 0;
alter table public.campaign_recipients add column next_attempt_at timestamptz;

comment on column public.campaign_recipients.attempt_count is
  'Incremented on every send attempt. Permanent failures (bad address, no consent) never retry; transient provider errors (timeout/429/5xx) retry with bounded exponential backoff up to a small cap enforced in application code — see services/messaging.';
comment on column public.campaign_recipients.next_attempt_at is
  'Worker claim query only picks up rows where this is null or in the past — implements backoff without a separate scheduler.';
