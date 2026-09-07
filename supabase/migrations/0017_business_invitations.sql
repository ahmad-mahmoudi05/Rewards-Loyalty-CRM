-- Real staff-invitation acceptance flow (Day 3 shipped an MVP that created
-- the account + membership immediately and showed a temp password once;
-- Day 4 replaces that with a proper invite-then-accept flow now that real
-- email exists to deliver it). business_id and role are fixed at invite
-- time and never taken from the client at acceptance — that's what makes
-- "cannot escalate role through a modified URL" true by construction.

create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null,
  role text not null check (role in ('STAFF', 'MANAGER')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index business_invitations_business_id_idx on public.business_invitations (business_id);
create index business_invitations_email_idx on public.business_invitations (email);

alter table public.business_invitations enable row level security;

-- Owners/managers can see and create invitations for their own business.
-- Deliberately no client-facing UPDATE policy: acceptance is handled by a
-- SECURITY DEFINER RPC (0018) since it must validate the token and act
-- across a business boundary the accepting user isn't a member of yet.
create policy "business_invitations_select_owner_or_manager" on public.business_invitations
for select using (private.is_business_owner_or_manager(business_id));

create policy "business_invitations_insert_owner_or_manager" on public.business_invitations
for insert with check (private.is_business_owner_or_manager(business_id));
