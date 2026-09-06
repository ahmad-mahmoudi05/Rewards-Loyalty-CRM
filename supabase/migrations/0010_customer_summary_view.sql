-- Read-model for the CRM customer list/profile: pre-joins the aggregates the
-- dashboard needs (transaction count/spend, available rewards, consent
-- flags, current loyalty progress) so the app avoids N+1 queries.
--
-- `security_invoker = true` is essential here: without it, a view is
-- evaluated with the OWNER's (postgres) privileges, which bypasses RLS on
-- every underlying table — exactly the cross-tenant leak this project must
-- never allow. With it, the view re-checks RLS as the querying role
-- (authenticated), so it's exactly as tenant-safe as querying the tables
-- directly. Scalar subqueries/LATERAL (not JOINs) are used for the
-- one-to-many aggregates (transactions, rewards, consents) to avoid
-- fan-out row multiplication that plain JOINs would cause.

create view public.customer_summary
with (security_invoker = true) as
select
  c.id,
  c.business_id,
  c.first_name,
  c.last_name,
  c.phone_raw,
  c.phone_normalized,
  c.email,
  c.birthday,
  c.wallet_token,
  c.source,
  c.notes,
  c.created_at,
  c.updated_at,
  (select count(*) from public.transactions t where t.customer_id = c.id and t.status = 'COMPLETED') as transaction_count,
  (select coalesce(sum(t.total), 0) from public.transactions t where t.customer_id = c.id and t.status = 'COMPLETED') as total_spend,
  (select max(t.created_at) from public.transactions t where t.customer_id = c.id and t.status = 'COMPLETED') as last_transaction_at,
  (select count(*) from public.rewards r where r.customer_id = c.id and r.status = 'AVAILABLE') as available_rewards_count,
  exists (
    select 1 from public.customer_consents cc
    where cc.customer_id = c.id and cc.channel = 'WHATSAPP' and cc.status = 'GRANTED'
  ) as whatsapp_subscribed,
  exists (
    select 1 from public.customer_consents cc
    where cc.customer_id = c.id and cc.channel = 'SMS' and cc.status = 'GRANTED'
  ) as sms_subscribed,
  exists (
    select 1 from public.customer_consents cc
    where cc.customer_id = c.id and cc.channel = 'EMAIL' and cc.status = 'GRANTED'
  ) as email_subscribed,
  la.loyalty_program_id,
  la.stamps_count,
  la.points_balance,
  lp.name as loyalty_program_name,
  lp.type as loyalty_type,
  lp.stamp_required_count,
  lp.points_reward_threshold
from public.customers c
left join lateral (
  select la2.loyalty_program_id, la2.stamps_count, la2.points_balance
  from public.loyalty_accounts la2
  join public.loyalty_programs lp2 on lp2.id = la2.loyalty_program_id and lp2.is_active = true
  where la2.customer_id = c.id
  order by la2.updated_at desc
  limit 1
) la on true
left join public.loyalty_programs lp on lp.id = la.loyalty_program_id;

-- Views need their own grant; contains customer PII so authenticated only,
-- never anon (matches every other CRM-facing table in this schema).
grant select on public.customer_summary to authenticated;
