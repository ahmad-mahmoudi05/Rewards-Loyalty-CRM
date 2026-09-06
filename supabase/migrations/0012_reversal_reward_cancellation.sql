-- Day 3 revisits Day 2's documented reversal limitation now that the
-- scanner makes staff-side reversals a realistic, frequent operation.
--
-- New behavior: if a transaction being reversed produced a reward that is
-- still AVAILABLE (never redeemed), cancel that reward too (status ->
-- CANCELLED, never deleted) since it would otherwise sit there unearned.
-- If the reward was already REDEEMED, we do NOT silently unwind history —
-- the function instead returns `reward_conflict: true` in its result so
-- the UI can flag it for manager attention. This matches the spec's
-- explicit instruction: "If reward already redeemed: do not silently undo
-- history. Flag exceptional state or require manager action."

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
  v_reward record;
  v_cancelled_reward_ids uuid[] := '{}';
  v_conflicted_reward_ids uuid[] := '{}';
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

    -- A reward generated off this specific EARN ledger row: cancel it if
    -- still available, flag a conflict if it was already redeemed.
    for v_reward in
      select * from rewards where source_loyalty_transaction_id = v_ledger.id
    loop
      if v_reward.status = 'AVAILABLE' then
        update rewards set status = 'CANCELLED' where id = v_reward.id;
        v_cancelled_reward_ids := array_append(v_cancelled_reward_ids, v_reward.id);
      elsif v_reward.status = 'REDEEMED' then
        v_conflicted_reward_ids := array_append(v_conflicted_reward_ids, v_reward.id);
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'transaction_id', p_transaction_id,
    'status', 'VOID',
    'cancelled_reward_ids', to_jsonb(v_cancelled_reward_ids),
    'reward_conflict', array_length(v_conflicted_reward_ids, 1) is not null,
    'conflicted_reward_ids', to_jsonb(v_conflicted_reward_ids)
  );
end;
$$;

-- Signature is unchanged from 0011, so the existing grants still apply, but
-- restate them for clarity/idempotency since this migration replaces the body.
revoke execute on function public.reverse_transaction(uuid, uuid, text) from public;
grant execute on function public.reverse_transaction(uuid, uuid, text) to authenticated;
