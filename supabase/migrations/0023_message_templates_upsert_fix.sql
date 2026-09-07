-- Fix for a real bug found while wiring up the template-sync upsert in
-- app/dashboard/integrations/actions.ts: PostgREST's upsert(onConflict:...)
-- generates a plain `ON CONFLICT (business_id, provider_template_id)`, which
-- Postgres can only satisfy by inferring a *non-partial* unique index — it
-- will not match a partial index (`where provider_template_id is not null`)
-- even for rows that satisfy the predicate. Dropping the predicate is safe
-- and loses nothing: Postgres unique indexes already treat every NULL as
-- distinct from every other NULL by default, which is exactly the same
-- "many draft templates with no provider id" behavior the partial predicate
-- was trying to express.

drop index public.message_templates_provider_template_idx;

create unique index message_templates_provider_template_idx
  on public.message_templates (business_id, provider_template_id);
