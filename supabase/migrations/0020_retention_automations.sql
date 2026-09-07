-- Retention automation system, v1: exactly five fixed automation types (not
-- an arbitrary workflow builder). This supersedes the looser trigger_type
-- set from migration 0005 (WELCOME/INACTIVE/BIRTHDAY/REWARD_UNLOCKED/
-- NEAR_REWARD/VIP) — none of those had been used by any app code yet, so
-- this is a clean swap, not a breaking migration of live data.
--
-- Reuses existing architecture throughout, per instructions:
-- - `tags`/`customer_tags` (Day 1) for AT_RISK / VIP status, not a new column.
-- - `loyalty_transactions` (Day 2) with transaction_type = 'BONUS' for any
--   points/stamps an automation grants — never a direct balance mutation.
-- - `automations`/`automation_runs` (Day 1) for config + audit + dedup —
--   no parallel automation system.

alter table public.automations drop constraint automations_trigger_type_check;
alter table public.automations add constraint automations_trigger_type_check check (
  trigger_type in ('INACTIVE_WINBACK', 'BIRTHDAY_REWARD', 'REWARD_READY_REMINDER', 'VIP_UPGRADE', 'LOYALTY_EXPIRY_REMINDER')
);

alter table public.automation_runs add column trigger_entity_id uuid;

comment on column public.automation_runs.trigger_entity_id is
  'The specific row that caused this run where applicable — a reward id for REWARD_READY_REMINDER, a transaction id for VIP_UPGRADE, etc. Nullable for purely time-based triggers (birthday, inactivity) that are not about one entity.';
comment on column public.automation_runs.dedupe_key is
  'Format is per trigger_type — see services/automations: INACTIVE_WINBACK uses the ISO date of the customer''s last visit (a new value once they return and go inactive again = a new cycle); BIRTHDAY_REWARD uses the year; REWARD_READY_REMINDER uses "<reward_id>:initial" or "<reward_id>:followup"; VIP_UPGRADE uses a constant per automation (fires at most once ever unless the automation is recreated); LOYALTY_EXPIRY_REMINDER is defined but never fires — see docs/database.md.';

-- ---------------------------------------------------------------------------
-- grant_automation_bonus: the ONLY way an automation may add loyalty value.
-- Restricted to service_role (this worker has no authenticated staff
-- session to check business_members against — it runs as a trusted
-- background job, not on behalf of a logged-in user, so the Day 2/3 "auth.uid()
-- must be a member" pattern doesn't apply here; the boundary instead is
-- "only our own service-role-authenticated code can ever call this").
-- ---------------------------------------------------------------------------

create or replace function public.grant_automation_bonus(
  p_business_id uuid,
  p_customer_id uuid,
  p_loyalty_program_id uuid,
  p_points_delta numeric default 0,
  p_stamps_delta int default 0,
  p_description text default 'Automation bonus'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loyalty_account_id uuid;
  v_new_stamps int;
  v_new_points numeric;
begin
  if not exists (select 1 from customers where id = p_customer_id and business_id = p_business_id) then
    raise exception 'This customer does not belong to this business.';
  end if;
  if not exists (select 1 from loyalty_programs where id = p_loyalty_program_id and business_id = p_business_id) then
    raise exception 'This loyalty program does not belong to this business.';
  end if;

  insert into loyalty_accounts (business_id, customer_id, loyalty_program_id)
  values (p_business_id, p_customer_id, p_loyalty_program_id)
  on conflict (customer_id, loyalty_program_id) do nothing;

  select id into v_loyalty_account_id from loyalty_accounts
  where customer_id = p_customer_id and loyalty_program_id = p_loyalty_program_id;

  insert into loyalty_transactions (
    business_id, customer_id, loyalty_program_id, transaction_type, points_delta, stamps_delta, description
  ) values (
    p_business_id, p_customer_id, p_loyalty_program_id, 'BONUS', p_points_delta, p_stamps_delta, p_description
  );

  update loyalty_accounts
  set stamps_count = stamps_count + p_stamps_delta,
      points_balance = points_balance + p_points_delta,
      lifetime_points = lifetime_points + greatest(p_points_delta, 0)
  where id = v_loyalty_account_id
  returning stamps_count, points_balance into v_new_stamps, v_new_points;

  return jsonb_build_object('stamps_count', v_new_stamps, 'points_balance', v_new_points);
end;
$$;

revoke execute on function public.grant_automation_bonus(uuid, uuid, uuid, numeric, int, text) from public, authenticated, anon;

-- ---------------------------------------------------------------------------
-- ensure_system_tag: idempotently gets-or-creates the AT_RISK / VIP tag for
-- a business, so automations don't race-create duplicate tag rows.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_system_tag(p_business_id uuid, p_name text, p_color text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag_id uuid;
begin
  insert into tags (business_id, name, color)
  values (p_business_id, p_name, p_color)
  on conflict (business_id, name) do nothing;

  select id into v_tag_id from tags where business_id = p_business_id and name = p_name;
  return v_tag_id;
end;
$$;

revoke execute on function public.ensure_system_tag(uuid, text, text) from public, authenticated, anon;
