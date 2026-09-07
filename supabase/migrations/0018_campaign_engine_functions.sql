-- The campaign engine's trusted server-side surface. campaign_recipients has
-- no client-facing write policy (migration 0008) — every row is created and
-- transitioned here or by the worker route using the service-role key.
--
-- Segment MATCHING (which customers belong to "Inactive 30 Days" etc.) is
-- deliberately NOT done in SQL here — it lives in services/campaigns/segments.ts,
-- reusing the same customer_summary-based queries the Day 2 CRM filters
-- already use, computed through the caller's own RLS-scoped session. This
-- function's job is narrower and security-critical: given a candidate list
-- of customer ids, defensively re-validate tenancy + consent + a valid
-- destination before ever creating a recipient row. A candidate id that
-- doesn't actually belong to p_business_id (a forged/cross-tenant id) is
-- silently excluded, never an error — see docs/architecture.md.

create or replace function public.snapshot_campaign_recipients(
  p_business_id uuid,
  p_campaign_id uuid,
  p_customer_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_campaign record;
  v_inserted int;
begin
  select role into v_role from business_members
  where business_id = p_business_id and profile_id = auth.uid();
  if v_role is null or v_role not in ('OWNER', 'MANAGER') then
    raise exception 'You do not have access to this business.' using errcode = '42501';
  end if;

  select * into v_campaign from campaigns where id = p_campaign_id and business_id = p_business_id;
  if not found then
    raise exception 'This campaign does not belong to this business.';
  end if;
  if v_campaign.status != 'DRAFT' then
    raise exception 'This campaign has already been queued or sent.';
  end if;

  if v_campaign.channel = 'EMAIL' then
    insert into campaign_recipients (campaign_id, business_id, customer_id, channel_address, status)
    select p_campaign_id, p_business_id, c.id, c.email, 'QUEUED'
    from customers c
    join customer_consents cc on cc.customer_id = c.id and cc.channel = 'EMAIL' and cc.status = 'GRANTED'
    where c.id = any(p_customer_ids)
      and c.business_id = p_business_id
      and c.email is not null
      and c.email <> ''
    on conflict (campaign_id, customer_id) do nothing;
  else
    -- WHATSAPP and SMS both key off the customer's normalized phone.
    insert into campaign_recipients (campaign_id, business_id, customer_id, channel_address, status)
    select p_campaign_id, p_business_id, c.id, c.phone_normalized, 'QUEUED'
    from customers c
    join customer_consents cc on cc.customer_id = c.id and cc.channel = v_campaign.channel and cc.status = 'GRANTED'
    where c.id = any(p_customer_ids)
      and c.business_id = p_business_id
      and c.phone_normalized is not null
      and c.phone_normalized <> ''
    on conflict (campaign_id, customer_id) do nothing;
  end if;

  get diagnostics v_inserted = row_count;

  update campaigns
  set status = case when scheduled_at is not null and scheduled_at > now() then 'SCHEDULED' else 'QUEUED' end,
      started_at = case when scheduled_at is null or scheduled_at <= now() then now() else started_at end
  where id = p_campaign_id;

  return jsonb_build_object('campaign_id', p_campaign_id, 'recipients_created', v_inserted);
end;
$$;

revoke execute on function public.snapshot_campaign_recipients(uuid, uuid, uuid[]) from public;
grant execute on function public.snapshot_campaign_recipients(uuid, uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- claim_queued_recipients: the worker route's only way to read work.
-- FOR UPDATE SKIP LOCKED makes concurrent invocations (a cron tick overlapping
-- an immediate post-send trigger) safe — no two callers ever claim the same row.
-- Restricted to service_role: this has no auth.uid() check of its own, since
-- it operates across every business's due campaigns at once — it must never
-- be reachable by an authenticated business user.
-- ---------------------------------------------------------------------------

create or replace function public.claim_queued_recipients(p_limit int default 25)
returns setof public.campaign_recipients
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Promote any due scheduled campaigns first so their recipients become claimable.
  update campaigns set status = 'QUEUED' where status = 'SCHEDULED' and scheduled_at <= now();

  return query
  update campaign_recipients
  set status = 'SENDING', attempt_count = attempt_count + 1
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

-- ---------------------------------------------------------------------------
-- finalize_campaign_if_complete: rolls a campaign's own status up from its
-- recipients' terminal states once none remain QUEUED/SENDING. Distinguishes
-- "everything succeeded" from "some failed" from "all failed" — never marks
-- COMPLETED just because rows were created (Part 4).
-- ---------------------------------------------------------------------------

create or replace function public.finalize_campaign_if_complete(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending int;
  v_total int;
  v_ok int;
begin
  select count(*) filter (where status in ('QUEUED', 'SENDING')),
         count(*),
         count(*) filter (where status in ('SENT', 'DELIVERED', 'READ', 'CLICKED'))
  into v_pending, v_total, v_ok
  from campaign_recipients where campaign_id = p_campaign_id;

  if v_pending > 0 then
    return;
  end if;

  update campaigns
  set status = case
        when v_total = 0 then 'COMPLETED'
        when v_ok = v_total then 'COMPLETED'
        when v_ok = 0 then 'FAILED'
        else 'PARTIALLY_FAILED'
      end,
      completed_at = now()
  where id = p_campaign_id and status in ('QUEUED', 'SENDING');
end;
$$;

revoke execute on function public.finalize_campaign_if_complete(uuid) from public, authenticated, anon;

-- ---------------------------------------------------------------------------
-- accept_business_invitation: the only way business_members ever gains a row
-- from an invitation. business_id and role come from the invitation record
-- itself, never from the caller — this is what makes role/business
-- escalation through a modified request impossible.
-- ---------------------------------------------------------------------------

create or replace function public.accept_business_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  select * into v_invite from business_invitations where token = p_token;
  if not found then
    raise exception 'This invitation link is invalid.';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'This invitation has already been used.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invitation has expired.';
  end if;

  insert into business_members (business_id, profile_id, role, invited_by)
  values (v_invite.business_id, auth.uid(), v_invite.role, v_invite.invited_by)
  on conflict (business_id, profile_id) do nothing;

  update business_invitations set accepted_at = now() where id = v_invite.id;

  return jsonb_build_object('business_id', v_invite.business_id, 'role', v_invite.role);
end;
$$;

revoke execute on function public.accept_business_invitation(uuid) from public;
grant execute on function public.accept_business_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- redeem_customer_offer: campaign-created offers (Part 45), same atomic
-- single-use pattern as redeem_reward (Day 2's migration 0011).
-- ---------------------------------------------------------------------------

create or replace function public.redeem_customer_offer(
  p_business_id uuid,
  p_offer_id uuid,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_updated int;
  v_location_business uuid;
begin
  select role into v_role from business_members
  where business_id = p_business_id and profile_id = auth.uid();
  if v_role is null then
    raise exception 'You do not have access to this business.' using errcode = '42501';
  end if;

  if p_location_id is not null then
    select business_id into v_location_business from locations where id = p_location_id;
    if v_location_business is null or v_location_business <> p_business_id then
      raise exception 'This location does not belong to this business.';
    end if;
  end if;

  update customer_offers
  set status = 'REDEEMED', redeemed_at = now()
  where id = p_offer_id
    and business_id = p_business_id
    and status = 'ACTIVE'
    and (expires_at is null or expires_at > now());
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'This offer has already been redeemed or has expired.';
  end if;

  return jsonb_build_object('offer_id', p_offer_id, 'status', 'REDEEMED');
end;
$$;

revoke execute on function public.redeem_customer_offer(uuid, uuid, uuid) from public;
grant execute on function public.redeem_customer_offer(uuid, uuid, uuid) to authenticated;
