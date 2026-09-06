-- Append-only audit trail. Written by server actions/RPCs whenever a
-- privileged or sensitive mutation happens (manual loyalty adjustments,
-- role changes, integration connects, billing changes, ...).

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_business_id_idx on public.audit_logs (business_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
