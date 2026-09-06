-- Closes a gap flagged (but deliberately deferred) in Day 1's
-- docs/database.md: RLS lets any OWNER/MANAGER insert/update business_members
-- freely, including setting someone's role to OWNER — a MANAGER could
-- promote themselves. Day 3 adds real staff invitation (an actual path that
-- writes business_members from application code for the first time since
-- onboarding), so this is now worth closing rather than leaving open.
--
-- Rule: a business_members row may only carry role = 'OWNER' if no OTHER
-- row for that business already has it. The bootstrap insert from
-- on_business_created (migration 0002) is the only legitimate OWNER-role
-- write in the system, and it always inserts the very first membership for
-- a new business, so it satisfies this rule trivially. Any later attempt —
-- through the app's own invite UI (which never offers OWNER as an option)
-- or a raw API call — is rejected.

create or replace function public.prevent_owner_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'OWNER' and exists (
    select 1 from business_members
    where business_id = new.business_id
      and role = 'OWNER'
      and id is distinct from new.id
  ) then
    raise exception 'A business already has an owner; ownership cannot be reassigned this way.';
  end if;
  return new;
end;
$$;

create trigger business_members_guard_owner_role
before insert or update on public.business_members
for each row execute function public.prevent_owner_role_escalation();
