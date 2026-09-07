-- Optional offer attached to a campaign (Part 43). Kept on the campaign row
-- itself (the offer *template*); snapshot_campaign_recipients (updated
-- below) creates one real customer_offers row per eligible recipient at
-- snapshot time, so "expiry" is a concrete date usable in the rendered
-- message and staff can see/redeem it from the scanner (Day 3's
-- CustomerOperationalPanel, extended not redesigned).

alter table public.campaigns add column offer_type text
  check (offer_type in ('PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_ITEM', 'BONUS_POINTS', 'BONUS_STAMP', 'CUSTOM_REWARD'));
alter table public.campaigns add column offer_value numeric(12, 2);
alter table public.campaigns add column offer_expiry_days int;
alter table public.campaigns add column offer_description text;

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

  if v_campaign.offer_type is not null then
    insert into customer_offers (business_id, customer_id, campaign_id, offer_type, value, status, expires_at)
    select p_business_id, cr.customer_id, p_campaign_id, v_campaign.offer_type, v_campaign.offer_value, 'ACTIVE',
      case when v_campaign.offer_expiry_days is not null then now() + (v_campaign.offer_expiry_days || ' days')::interval else null end
    from campaign_recipients cr
    where cr.campaign_id = p_campaign_id;
  end if;

  update campaigns
  set status = case when scheduled_at is not null and scheduled_at > now() then 'SCHEDULED' else 'QUEUED' end,
      started_at = case when scheduled_at is null or scheduled_at <= now() then now() else started_at end
  where id = p_campaign_id;

  return jsonb_build_object('campaign_id', p_campaign_id, 'recipients_created', v_inserted);
end;
$$;

revoke execute on function public.snapshot_campaign_recipients(uuid, uuid, uuid[]) from public;
grant execute on function public.snapshot_campaign_recipients(uuid, uuid, uuid[]) to authenticated;
