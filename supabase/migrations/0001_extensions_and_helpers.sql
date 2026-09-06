-- Extensions and small shared helpers used by every later migration.

create extension if not exists pgcrypto;

-- Private schema for SECURITY DEFINER helper functions used by RLS policies.
-- Kept out of `public` so it is never exposed via PostgREST.
create schema if not exists private;

-- Generic updated_at trigger, attached to every table that has the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
