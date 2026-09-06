-- The loyalty engine. These are the ONLY way transactions/loyalty_transactions/
-- loyalty_accounts/rewards/reward_redemptions ever get written — migration
-- 0008 deliberately gave those tables no client-facing INSERT/UPDATE RLS
-- policy. Each function is SECURITY DEFINER (bypasses RLS as the table
-- owner) and therefore MUST do its own tenant/authorization checks — RLS is
-- not there to save us here, this function body is the whole security
-- boundary. See docs/architecture.md and docs/database.md.
--
-- Industry-agnostic by construction: everything below branches only on
-- `loyalty_programs.type` ('STAMPS' | 'POINTS'), never on business_type.

create or replace function public.record_transaction(
  p_business_id uuid,
  p_customer_id uuid,
  p_loyalty_program_id uuid,
  p_total numeric,
  p_location_id uuid default null,
  p_subtotal numeric default null,
  p_currency text default null,
  p_external_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_program record;
  v_location_business uuid;
  v_transaction_id uuid;
  v_loyalty_account_id uuid;
  v_earn_ledger_id uuid;
  v_stamps_delta int := 0;
  v_points_delta numeric := 0;
  v_qualifies boolean := false;
  v_new_stamps int;
  v_new_points numeric;
  v_metric numeric;
  v_threshold numeric;
  v_reward_id uuid := null;
  v_has_available_reward boolean;
begin
  select role into v_role from business_members
  where business_id = p_business_id and profile_id = auth.uid();
  if v_role is null then
    raise exception 'You do not have access to this business.' using errcode = '42501';
  end if;

  select * into v_program from loyalty_programs
  where id = p_loyalty_program_id and business_id = p_business_id;
  if not found then
    raise exception 'This loyalty program does not belong to this business.';
  end if;
  if not v_program.is_active then
    raise exception 'This loyalty program is not active.';
  end if;

  if not exists (select 1 from customers where id = p_customer_id and business_id = p_business_id) then
    raise exception 'This customer does not belong to this business.';
  end if;

  if p_location_id is not null then
    select business_id into v_location_business from locations where id = p_location_id;
    if v_location_business is null or v_location_business <> p_business_id then
      raise exception 'This location does not belong to this business.';
    end if;
  end if;

  if p_total is null or p_total <= 0 then
    raise exception 'Enter a transaction amount greater than 0.';
  end if;

  insert into transactions (
    business_id, location_id, customer_id, staff_user_id,
    subtotal, total, currency, external_reference, source, status
  ) values (
    p_business_id, p_location_id, p_customer_id, auth.uid(),
    coalesce(p_subtotal, p_total), p_total, coalesce(p_currency, 'AED'),
    p_external_reference, 'STAFF', 'COMPLETED'
  )
  returning id into v_transaction_id;

  insert into loyalty_accounts (business_id, customer_id, loyalty_program_id)
  values (p_business_id, p_customer_id, p_loyalty_program_id)
  on conflict (customer_id, loyalty_program_id) do nothing;

  select id into v_loyalty_account_id from loyalty_accounts
  where customer_id = p_customer_id and loyalty_program_id = p_loyalty_program_id;

  if v_program.type = 'STAMPS' then
    v_qualifies := (v_program.stamp_min_transaction_value is null or p_total >= v_program.stamp_min_transaction_value);
    if v_qualifies then
      v_stamps_delta := 1;
    end if;
  else
    v_qualifies := (v_program.points_min_transaction_value is null or p_total >= v_program.points_min_transaction_value);
    if v_qualifies then
      -- Fixed round-to-nearest-integer strategy for Day 2 (schema has no
      -- configurable rounding mode yet) — documented in docs/database.md.
      v_points_delta := round(p_total * v_program.points_per_currency_unit);
    end if;
  end if;

  if v_qualifies and (v_stamps_delta <> 0 or v_points_delta <> 0) then
    insert into loyalty_transactions (
      business_id, location_id, customer_id, loyalty_program_id, source_transaction_id,
      staff_user_id, transaction_type, points_delta, stamps_delta, description
    ) values (
      p_business_id, p_location_id, p_customer_id, p_loyalty_program_id, v_transaction_id,
      auth.uid(), 'EARN', v_points_delta, v_stamps_delta, 'Earned from transaction'
    )
    returning id into v_earn_ledger_id;

    update loyalty_accounts
    set stamps_count = stamps_count + v_stamps_delta,
        points_balance = points_balance + v_points_delta,
        lifetime_points = lifetime_points + greatest(v_points_delta, 0)
    where id = v_loyalty_account_id;
  end if;

  select stamps_count, points_balance into v_new_stamps, v_new_points
  from loyalty_accounts where id = v_loyalty_account_id;

  if v_program.type = 'STAMPS' then
    v_metric := v_new_stamps;
    v_threshold := v_program.stamp_required_count;
  else
    v_metric := v_new_points;
    v_threshold := v_program.points_reward_threshold;
  end if;

  if v_metric >= v_threshold then
    select exists(
      select 1 from rewards
      where loyalty_account_id = v_loyalty_account_id and status = 'AVAILABLE'
    ) into v_has_available_reward;

    -- Generate a reward if the program allows stacking multiple outstanding
    -- rewards, or if there isn't already one sitting unredeemed. This keeps
    -- a non-resetting program from spamming rewards on every later
    -- transaction once it first crosses the threshold. See docs/database.md.
    if v_program.allow_multiple_rewards or not v_has_available_reward then
      insert into rewards (
        business_id, customer_id, loyalty_program_id, loyalty_account_id,
        name, description, reward_type, value, expires_at, source_loyalty_transaction_id
      ) values (
        p_business_id, p_customer_id, p_loyalty_program_id, v_loyalty_account_id,
        v_program.reward_name, v_program.reward_description, v_program.reward_type, v_program.reward_value,
        case when v_program.reward_expiry_days is not null
          then now() + (v_program.reward_expiry_days || ' days')::interval
          else null end,
        v_earn_ledger_id
      )
      returning id into v_reward_id;

      if v_program.progress_resets_on_redeem then
        -- Subtract exactly the threshold (not a hard reset to 0) so any
        -- excess correctly carries into the next cycle instead of being
        -- silently lost — e.g. balance 550 at a 500 threshold leaves 50.
        if v_program.type = 'STAMPS' then
          update loyalty_accounts set stamps_count = stamps_count - v_threshold::int
          where id = v_loyalty_account_id
          returning stamps_count into v_new_stamps;
        else
          update loyalty_accounts set points_balance = points_balance - v_threshold
          where id = v_loyalty_account_id
          returning points_balance into v_new_points;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'qualified', v_qualifies,
    'stamps_count', v_new_stamps,
    'points_balance', v_new_points,
    'reward_id', v_reward_id
  );
end;
$$;

revoke execute on function public.record_transaction(uuid, uuid, uuid, numeric, uuid, numeric, text, text) from public;
grant execute on function public.record_transaction(uuid, uuid, uuid, numeric, uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- redeem_reward: atomically claims a reward. Double redemption is impossible
-- by construction — the UPDATE ... WHERE status = 'AVAILABLE' only ever
-- affects a row once (a concurrent second call sees the row already
-- REDEEMED and updates 0 rows), and reward_redemptions.reward_id is UNIQUE
-- as a hard backstop.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_reward(
  p_business_id uuid,
  p_reward_id uuid,
  p_location_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_reward record;
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

  update rewards
  set status = 'REDEEMED', redeemed_at = now()
  where id = p_reward_id
    and business_id = p_business_id
    and status = 'AVAILABLE'
    and (expires_at is null or expires_at > now());
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    if exists (select 1 from rewards where id = p_reward_id and business_id = p_business_id) then
      raise exception 'This reward has already been redeemed or has expired.';
    else
      raise exception 'This reward does not belong to this business.';
    end if;
  end if;

  select * into v_reward from rewards where id = p_reward_id;

  insert into reward_redemptions (business_id, reward_id, customer_id, location_id, staff_user_id, notes)
  values (p_business_id, p_reward_id, v_reward.customer_id, p_location_id, auth.uid(), p_notes);

  insert into loyalty_transactions (
    business_id, location_id, customer_id, loyalty_program_id,
    staff_user_id, transaction_type, description
  ) values (
    p_business_id, p_location_id, v_reward.customer_id, v_reward.loyalty_program_id,
    auth.uid(), 'REDEEM', 'Redeemed: ' || v_reward.name
  );

  return jsonb_build_object('reward_id', p_reward_id, 'status', 'REDEEMED');
end;
$$;

revoke execute on function public.redeem_reward(uuid, uuid, uuid, text) from public;
grant execute on function public.redeem_reward(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- reverse_transaction: OWNER/MANAGER-only error correction. Never deletes
-- history — voids the transaction and writes offsetting REVERSAL ledger
-- rows. Known, documented limitation: does not retroactively cancel a
-- reward that was already generated off the reversed transaction (that
-- would require unwinding potentially-already-redeemed rewards, which is a
-- much bigger problem deferred past Day 2 — see docs/database.md).
-- ---------------------------------------------------------------------------

create or replace function public.reverse_transaction(
  p_business_id uuid,
  p_transaction_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_txn record;
  v_ledger record;
begin
  select role into v_role from business_members
  where business_id = p_business_id and profile_id = auth.uid();
  if v_role is null or v_role not in ('OWNER', 'MANAGER') then
    raise exception 'Only an owner or manager can reverse a transaction.' using errcode = '42501';
  end if;

  select * into v_txn from transactions where id = p_transaction_id and business_id = p_business_id;
  if not found then
    raise exception 'This transaction does not belong to this business.';
  end if;
  if v_txn.status = 'VOID' then
    raise exception 'This transaction has already been reversed.';
  end if;

  update transactions set status = 'VOID' where id = p_transaction_id;

  for v_ledger in
    select * from loyalty_transactions
    where source_transaction_id = p_transaction_id and reversed_at is null
  loop
    insert into loyalty_transactions (
      business_id, location_id, customer_id, loyalty_program_id, source_transaction_id,
      staff_user_id, transaction_type, points_delta, stamps_delta, description
    ) values (
      v_ledger.business_id, v_ledger.location_id, v_ledger.customer_id, v_ledger.loyalty_program_id,
      p_transaction_id, auth.uid(), 'REVERSAL', -v_ledger.points_delta, -v_ledger.stamps_delta,
      'Reversal: ' || coalesce(p_reason, 'no reason given')
    );

    update loyalty_accounts
    set stamps_count = greatest(stamps_count - v_ledger.stamps_delta, 0),
        points_balance = greatest(points_balance - v_ledger.points_delta, 0)
    where customer_id = v_ledger.customer_id and loyalty_program_id = v_ledger.loyalty_program_id;

    update loyalty_transactions set reversed_at = now(), reversal_reason = p_reason where id = v_ledger.id;
  end loop;

  return jsonb_build_object('transaction_id', p_transaction_id, 'status', 'VOID');
end;
$$;

revoke execute on function public.reverse_transaction(uuid, uuid, text) from public;
grant execute on function public.reverse_transaction(uuid, uuid, text) to authenticated;
