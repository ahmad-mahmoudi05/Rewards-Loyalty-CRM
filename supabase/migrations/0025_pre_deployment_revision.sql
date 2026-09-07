-- Final pre-deployment revision: fixes for real bugs found during a full
-- read-through of the codebase (see docs/progress.md "Session 7" for the
-- full audit). Every change below closes a verified, concrete defect —
-- nothing here is new product scope.

-- ---------------------------------------------------------------------------
-- 1. reverse_transaction: close a double-reversal race.
--
-- The original body (0012) read the transaction's status with a plain
-- SELECT, then later did an unconditional UPDATE. Two concurrent calls for
-- the same transaction could both pass the "not already VOID" check before
-- either committed, both insert a REVERSAL ledger row, and both decrement
-- loyalty_accounts — double-reversing a single transaction. redeem_reward
-- already avoided this class of bug with an atomic UPDATE ... WHERE guard;
-- this fixes reverse_transaction the same way, using `for update` to
-- serialize concurrent callers on the same transaction row so the second
-- caller's status check runs against the first caller's committed result,
-- not a stale snapshot.
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
  v_reward record;
  v_cancelled_reward_ids uuid[] := '{}';
  v_conflicted_reward_ids uuid[] := '{}';
begin
  select role into v_role from business_members
  where business_id = p_business_id and profile_id = auth.uid();
  if v_role is null or v_role not in ('OWNER', 'MANAGER') then
    raise exception 'Only an owner or manager can reverse a transaction.' using errcode = '42501';
  end if;

  -- FOR UPDATE: locks this row for the duration of the transaction, so a
  -- concurrent second call blocks here until the first commits, then reads
  -- the now-VOID status and correctly rejects instead of racing past it.
  select * into v_txn from transactions
  where id = p_transaction_id and business_id = p_business_id
  for update;
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

revoke execute on function public.reverse_transaction(uuid, uuid, text) from public;
grant execute on function public.reverse_transaction(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. accept_business_invitation: bind acceptance to the invited email.
--
-- The function validated the token (exists / not accepted / not expired)
-- but never checked that the authenticated caller IS the invited person —
-- that check only existed in the Next.js server action
-- (app/invite/[token]/actions.ts), which this RPC bypasses entirely if
-- called directly (it's `grant`ed to `authenticated`, callable via
-- PostgREST by any logged-in account). A leaked/forwarded invitation token
-- let any other authenticated user join the target business at the
-- invited role. Every SECURITY DEFINER function in this schema is
-- supposed to independently enforce its own authorization (see 0011's
-- header comment) — this one didn't, for identity. Fixed by checking the
-- caller's own profile email against the invitation's target email.
-- ---------------------------------------------------------------------------

create or replace function public.accept_business_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_caller_email text;
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

  select email into v_caller_email from profiles where id = auth.uid();
  if v_caller_email is null or lower(v_caller_email) <> lower(v_invite.email) then
    raise exception 'This invitation was sent to a different email address.' using errcode = '42501';
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
-- 3. business_members: close the demote-then-promote OWNER takeover.
--
-- Migration 0014's trigger only blocked a write that set role = 'OWNER'
-- while another OWNER row already existed — it did not fire on DELETE, and
-- did not stop an UPDATE that demoted or removed the CURRENT owner's row.
-- Since business_members_write_owner_or_manager (0008) lets any MANAGER
-- write any row for their business, a MANAGER could: (1) UPDATE the
-- OWNER's row to role='STAFF' (0014's trigger doesn't fire — new.role
-- isn't 'OWNER'), then (2) UPDATE their own row to role='OWNER' (0014's
-- "another owner already exists" check is now false). Two ordinary writes,
-- no exotic exploit, full business takeover. Fixed: block any UPDATE or
-- DELETE against a row currently holding OWNER unless the actor is that
-- same person or a platform admin.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_owner_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'OWNER' and not private.is_platform_admin() then
      raise exception 'The business owner cannot be removed this way.' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.role = 'OWNER' and exists (
    select 1 from business_members
    where business_id = new.business_id
      and role = 'OWNER'
      and id is distinct from new.id
  ) then
    raise exception 'A business already has an owner; ownership cannot be reassigned this way.';
  end if;

  if tg_op = 'UPDATE' and old.role = 'OWNER' and new.role <> 'OWNER'
     and auth.uid() is distinct from old.profile_id and not private.is_platform_admin() then
    raise exception 'The business owner''s role cannot be changed this way.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists business_members_guard_owner_role on public.business_members;
create trigger business_members_guard_owner_role
before insert or update or delete on public.business_members
for each row execute function public.prevent_owner_role_escalation();

-- ---------------------------------------------------------------------------
-- 4. business_invitations: allow revoking an unaccepted invitation.
--
-- There was no UPDATE/DELETE policy at all, so a leaked invite token
-- stayed valid for the full 7-day window with no way for the business to
-- cut it off — the only mitigation was #2 above (email binding), which is
-- necessary but shouldn't be the only lever. Owner/manager can now delete
-- an invitation that hasn't been accepted yet; an already-accepted one is
-- left alone (it's now a real business_members row, not a live token).
-- ---------------------------------------------------------------------------

create policy "business_invitations_delete_owner_or_manager" on public.business_invitations
for delete using (private.is_business_owner_or_manager(business_id) and accepted_at is null);

-- ---------------------------------------------------------------------------
-- 5. loyalty_programs: close a DB-level validation gap.
--
-- Only stamp_required_count had a CHECK constraint. points_per_currency_unit,
-- points_min_transaction_value, points_reward_threshold,
-- stamp_min_transaction_value, reward_value, and reward_expiry_days had
-- none. The zod schema (lib/validation/loyalty.ts) rejects zero/negative
-- values, but that only runs inside the one server action that uses it —
-- loyalty_programs has a normal owner/manager RLS write policy (0008), so
-- a direct PostgREST call bypasses the zod check entirely. A negative
-- points_reward_threshold, for example, would make every transaction
-- immediately "qualify" for a reward. Adding the same constraints at the
-- table level so validation can't be bypassed by skipping the server action.
-- ---------------------------------------------------------------------------

alter table public.loyalty_programs
  add constraint loyalty_programs_points_rate_positive
    check (points_per_currency_unit is null or points_per_currency_unit > 0),
  add constraint loyalty_programs_points_min_txn_nonnegative
    check (points_min_transaction_value is null or points_min_transaction_value >= 0),
  add constraint loyalty_programs_points_threshold_positive
    check (points_reward_threshold is null or points_reward_threshold > 0),
  add constraint loyalty_programs_stamp_min_txn_nonnegative
    check (stamp_min_transaction_value is null or stamp_min_transaction_value >= 0),
  add constraint loyalty_programs_reward_value_nonnegative
    check (reward_value is null or reward_value >= 0),
  add constraint loyalty_programs_reward_expiry_positive
    check (reward_expiry_days is null or reward_expiry_days > 0);

-- ---------------------------------------------------------------------------
-- 6. Shared reward-threshold evaluator, used by record_transaction AND
--    grant_automation_bonus.
--
-- Two real bugs, one shared cause: record_transaction's reward check ran
-- once per call (`if v_metric >= v_threshold`), not a loop — a single
-- transaction large enough to cross a resetting POINTS threshold more than
-- once (e.g. threshold 100, balance jumps 50 -> 350) only granted one
-- reward and left the account sitting above threshold until a later
-- transaction caught up. Separately, grant_automation_bonus (0020) updated
-- loyalty_accounts directly and never checked the threshold at all, so an
-- automation bonus that pushed a customer over it granted no reward —
-- silently different behavior from every other way loyalty value is
-- earned. Both are fixed by extracting the exact reward-generation logic
-- record_transaction already had (unchanged behavior for the common case)
-- into one function and calling it from both places.
-- ---------------------------------------------------------------------------

create or replace function private.evaluate_and_grant_rewards(
  p_loyalty_account_id uuid,
  p_source_ledger_id uuid default null
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_program record;
  v_stamps_count int;
  v_points_balance numeric;
  v_metric numeric;
  v_threshold numeric;
  v_has_available_reward boolean;
  v_reward_id uuid;
  v_reward_ids uuid[] := '{}';
begin
  select customer_id into v_customer_id from loyalty_accounts where id = p_loyalty_account_id;
  select * into v_program from loyalty_programs
  where id = (select loyalty_program_id from loyalty_accounts where id = p_loyalty_account_id);

  select exists(
    select 1 from rewards where loyalty_account_id = p_loyalty_account_id and status = 'AVAILABLE'
  ) into v_has_available_reward;

  loop
    select stamps_count, points_balance into v_stamps_count, v_points_balance
    from loyalty_accounts where id = p_loyalty_account_id;

    if v_program.type = 'STAMPS' then
      v_metric := v_stamps_count;
      v_threshold := v_program.stamp_required_count;
    else
      v_metric := v_points_balance;
      v_threshold := v_program.points_reward_threshold;
    end if;

    exit when v_threshold is null or v_threshold <= 0 or v_metric < v_threshold;
    exit when v_has_available_reward and not v_program.allow_multiple_rewards;

    insert into rewards (
      business_id, customer_id, loyalty_program_id, loyalty_account_id,
      name, description, reward_type, value, expires_at, source_loyalty_transaction_id
    ) values (
      v_program.business_id, v_customer_id, v_program.id, p_loyalty_account_id,
      v_program.reward_name, v_program.reward_description, v_program.reward_type, v_program.reward_value,
      case when v_program.reward_expiry_days is not null
        then now() + (v_program.reward_expiry_days || ' days')::interval
        else null end,
      p_source_ledger_id
    )
    returning id into v_reward_id;

    v_reward_ids := array_append(v_reward_ids, v_reward_id);
    v_has_available_reward := true;

    if v_program.progress_resets_on_redeem then
      -- Subtract exactly the threshold (not a hard reset) so excess
      -- carries into the next cycle; loop again in case the remainder is
      -- still over threshold (the multi-crossing fix).
      if v_program.type = 'STAMPS' then
        update loyalty_accounts set stamps_count = stamps_count - v_threshold::int
        where id = p_loyalty_account_id;
      else
        update loyalty_accounts set points_balance = points_balance - v_threshold
        where id = p_loyalty_account_id;
      end if;
    else
      -- Non-resetting programs: the metric never drops back below
      -- threshold on its own, so looping again here would grant forever.
      -- Matches the original single-grant-per-call behavior.
      exit;
    end if;
  end loop;

  return v_reward_ids;
end;
$$;

revoke execute on function private.evaluate_and_grant_rewards(uuid, uuid) from public, authenticated, anon;

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
  v_reward_ids uuid[];
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

  v_reward_ids := private.evaluate_and_grant_rewards(v_loyalty_account_id, v_earn_ledger_id);

  select stamps_count, points_balance into v_new_stamps, v_new_points
  from loyalty_accounts where id = v_loyalty_account_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'qualified', v_qualifies,
    'stamps_count', v_new_stamps,
    'points_balance', v_new_points,
    'reward_ids', to_jsonb(v_reward_ids),
    'reward_id', v_reward_ids[1]
  );
end;
$$;

revoke execute on function public.record_transaction(uuid, uuid, uuid, numeric, uuid, numeric, text, text) from public;
grant execute on function public.record_transaction(uuid, uuid, uuid, numeric, uuid, numeric, text, text) to authenticated;

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
  v_earn_ledger_id uuid;
  v_new_stamps int;
  v_new_points numeric;
  v_reward_ids uuid[];
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
  )
  returning id into v_earn_ledger_id;

  update loyalty_accounts
  set stamps_count = stamps_count + p_stamps_delta,
      points_balance = points_balance + p_points_delta,
      lifetime_points = lifetime_points + greatest(p_points_delta, 0)
  where id = v_loyalty_account_id;

  -- A bonus that pushes the customer over the reward threshold must
  -- generate a reward exactly like a staff-recorded transaction would —
  -- previously this function never checked, so automation bonuses could
  -- silently push a customer past threshold with no reward ever created.
  v_reward_ids := private.evaluate_and_grant_rewards(v_loyalty_account_id, v_earn_ledger_id);

  select stamps_count, points_balance into v_new_stamps, v_new_points
  from loyalty_accounts where id = v_loyalty_account_id;

  return jsonb_build_object(
    'stamps_count', v_new_stamps,
    'points_balance', v_new_points,
    'reward_ids', to_jsonb(v_reward_ids)
  );
end;
$$;

revoke execute on function public.grant_automation_bonus(uuid, uuid, uuid, numeric, int, text) from public, authenticated, anon;
