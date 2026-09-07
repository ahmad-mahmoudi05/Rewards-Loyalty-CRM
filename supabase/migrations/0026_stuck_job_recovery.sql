-- Stuck-job recovery for the campaign queue (spec Phase 34 explicitly asks
-- for this). claim_queued_recipients only ever claims rows with
-- status = 'QUEUED' — a worker that crashes (or a serverless function that
-- times out) between a provider accepting a send and process.ts's own
-- status='SENT' write left that recipient stuck at 'SENDING' forever: never
-- retried, and finalize_campaign_if_complete would never see the campaign
-- as done since a SENDING row never reaches a terminal status. This adds a
-- claim timestamp and reclaims anything that's been SENDING for longer than
-- a real send should ever take.
--
-- Honest residual risk, not a false guarantee: reclaiming a SENDING row
-- assumes the crash happened before the provider accepted the message. If
-- it actually crashed just *after* the provider accepted it (message really
-- sent) but before the status write, the reclaimed row will be sent again
-- on the next claim — a real possible double-send in that narrow window,
-- for providers where no delivery-idempotency key is honored (see
-- docs/integrations.md "Idempotent sends"). Choosing "rare double-send" over
-- "message permanently stuck / campaign never completes" is the same
-- trade-off documented for automation_runs below.

alter table public.campaign_recipients add column claimed_at timestamptz;

create or replace function public.claim_queued_recipients(p_limit int default 25)
returns setof public.campaign_recipients
language plpgsql
security definer
set search_path = public
as $$
begin
  update campaigns set status = 'QUEUED' where status = 'SCHEDULED' and scheduled_at <= now();

  update campaign_recipients
  set status = 'QUEUED'
  where status = 'SENDING' and claimed_at < now() - interval '10 minutes';

  return query
  update campaign_recipients
  set status = 'SENDING', attempt_count = attempt_count + 1, claimed_at = now()
  where id in (
    select cr.id
    from campaign_recipients cr
    join campaigns c on c.id = cr.campaign_id
    where cr.status = 'QUEUED'
      and c.status in ('QUEUED', 'SENDING')
      and (cr.next_attempt_at is null or cr.next_attempt_at <= now())
    order by cr.created_at
    limit p_limit
    for update of cr skip locked
  )
  returning *;
end;
$$;

revoke execute on function public.claim_queued_recipients(int) from public, authenticated, anon;
