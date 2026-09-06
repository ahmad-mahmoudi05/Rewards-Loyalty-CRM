-- Rotate a customer's wallet_token (Part 25: revocation/rotation
-- architecture). Any previously issued QR/Wallet pass encoding the old
-- token stops resolving immediately — customers.wallet_token is unique, so
-- the old value simply no longer matches any row once replaced.

create or replace function public.rotate_customer_wallet_token(
  p_business_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_new_token uuid := gen_random_uuid();
begin
  select role into v_role from business_members
  where business_id = p_business_id and profile_id = auth.uid();
  if v_role is null or v_role not in ('OWNER', 'MANAGER') then
    raise exception 'Only an owner or manager can reset a customer''s loyalty card.' using errcode = '42501';
  end if;

  update customers
  set wallet_token = v_new_token
  where id = p_customer_id and business_id = p_business_id;

  if not found then
    raise exception 'This customer does not belong to this business.';
  end if;

  return jsonb_build_object('customer_id', p_customer_id, 'wallet_token', v_new_token);
end;
$$;

revoke execute on function public.rotate_customer_wallet_token(uuid, uuid) from public;
grant execute on function public.rotate_customer_wallet_token(uuid, uuid) to authenticated;
