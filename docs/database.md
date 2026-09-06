# Database

Source of truth: `supabase/migrations/*.sql`, applied to the linked Supabase project
(`ibzbdxizkihvlnqegjpj`) via `npx supabase db push`. Never make a schema change through the
Supabase dashboard SQL editor — add a migration file and push it, so the history is
reproducible and reviewable.

## Migration order

| File | Contents |
|---|---|
| `0001_extensions_and_helpers.sql` | `pgcrypto`, `private` schema, generic `set_updated_at()` trigger |
| `0002_profiles_and_tenancy.sql` | `profiles`, `businesses`, `business_members`, `locations`, `business_branding`, RLS helper functions |
| `0003_customers.sql` | `customers`, `customer_consents`, `tags`, `customer_tags` |
| `0004_loyalty.sql` | `loyalty_programs`, `loyalty_accounts`, `transactions`, `loyalty_transactions`, `rewards`, `reward_redemptions`, `customer_offers`, `wallet_passes` |
| `0005_marketing.sql` | `business_integrations`, `message_templates`, `campaigns`, `campaign_recipients`, `message_events`, `automations`, `automation_runs` |
| `0006_billing.sql` | `plans`, `subscriptions`, `usage_records` |
| `0007_audit.sql` | `audit_logs` |
| `0008_rls.sql` | RLS enabled + policies on every table above |
| `0009_seed_plans.sql` | STARTER/GROWTH/PRO plan catalog |

## Design choices worth remembering

- **Enums are `text` + `check` constraints, not Postgres `ENUM` types.** Adding a value to a
  check constraint is a plain `ALTER TABLE ... DROP/ADD CONSTRAINT` migration; widening a
  Postgres enum type has sharper edges (can't run in the same transaction as its use, etc).
  Given how much this schema will evolve over 5 days, `check` constraints were judged the
  lower-friction choice.
- **`(business_id, phone_normalized)` is the customer identity key, not phone alone** — the
  same person can be a customer of unrelated businesses.
- **`customers.wallet_token`** is a random UUID (`gen_random_uuid()`), never derived from PII.
  It's what gets encoded in the QR/wallet pass and is the only thing a scanner reads.
- **Ledger integrity**: `loyalty_accounts.stamps_count` / `points_balance` must never be
  updated except alongside a new `loyalty_transactions` row recording the delta and reason.
  `rewards` must never flip to `REDEEMED` except alongside a `reward_redemptions` row (which
  has a `unique (reward_id)` constraint — the database itself refuses a second redemption,
  not just application logic).
- **RLS intentionally has no client-facing write policy** on `loyalty_accounts`,
  `transactions`, `loyalty_transactions`, `rewards`, `reward_redemptions`,
  `campaign_recipients`, `message_events`, `automation_runs`. These are written exclusively
  by SECURITY DEFINER Postgres functions (the loyalty engine RPCs, added Day 2/3) or the
  service-role key (public customer-signup path, Day 2). This is deliberate per AGENTS spec
  §44/§9: "Never trust frontend-supplied ... points, stamps, reward status" — so the tables
  are simply not writable from the frontend at all, by construction, regardless of what a
  compromised browser client sends.
- **Staff visibility restrictions** (spec §5: staff must not see billing, API credentials,
  customer exports, platform config) are enforced at the RLS layer for the clearly
  sensitive tables (`subscriptions`, `usage_records`, `business_integrations`, `audit_logs`,
  `campaigns`/`campaign_recipients`/`message_events` — all OWNER/MANAGER only). Finer-grained
  staff permission toggles (the `business_members.permissions` jsonb column) are an
  application-layer concern for the Staff Mode UI (Day 3), not yet enforced by RLS — RLS
  gives us the coarse, unbypassable boundary; the UI gives the fine-grained one.
- **`business_members` role-escalation guard is app-layer only for now**: RLS lets any
  OWNER/MANAGER insert/update/delete `business_members` rows, including setting someone to
  OWNER. A MANAGER promoting themselves to OWNER is a real gap — flagged here so Day 1/2 adds
  a trigger or check constraint (e.g. "at most the business creator can ever hold OWNER, or
  only an existing OWNER can grant OWNER") before this matters in practice (no multi-staff
  business exists yet in the MVP flow).
- **Row-owner RLS bypass mechanism**: `private.is_business_member()` and friends are
  `SECURITY DEFINER` functions. In Postgres, a table's owner (here, `postgres`, since
  migrations run as `postgres`) is exempt from that table's own RLS unless
  `FORCE ROW LEVEL SECURITY` is set (it isn't). So these helper functions — and any future
  RPC used for the loyalty engine — transparently bypass RLS on the tables they touch, which
  is what makes "helper function reads `business_members` to decide whether the *caller* can
  read `business_members`" not recurse infinitely.

## Day 2 additions

- `0010_customer_summary_view.sql` — `customer_summary`, a `security_invoker = true`
  read-model view joining per-customer aggregates (transaction count/spend, available
  rewards, consent flags, current loyalty progress) via scalar subqueries/LATERAL joins
  (not plain JOINs) to avoid fan-out row multiplication. Drives the CRM list and profile
  pages without N+1 queries. `security_invoker` is what makes it safe — see the comment in
  the migration file for why a plain view here would silently bypass RLS.
- `0011_loyalty_engine_functions.sql` — the loyalty engine itself, as three SECURITY DEFINER
  RPCs: `record_transaction`, `redeem_reward`, `reverse_transaction`. These are the *only*
  way `transactions`, `loyalty_transactions`, `loyalty_accounts`, `rewards`, and
  `reward_redemptions` ever get written (0008's RLS deliberately left those tables with no
  client-facing write policy). Each function re-implements its own tenant/role check via
  `business_members` — RLS does not help here since SECURITY DEFINER bypasses it by table
  ownership, so the function body *is* the security boundary. `EXECUTE` is revoked from
  `PUBLIC` and granted only to `authenticated`.

### Loyalty math, precisely

- **Stamps**: each qualifying transaction (gated by `stamp_min_transaction_value` if set)
  adds exactly 1 stamp. Reward fires when `stamps_count >= stamp_required_count`.
- **Points**: `round(transaction_total * points_per_currency_unit)` — fixed
  round-to-nearest-integer strategy. The schema has no configurable rounding-mode column
  yet; not needed by any Day 2 acceptance test, deferred until a real business asks for it.
  Reward fires when `points_balance >= points_reward_threshold`.
- **Overflow-preserving reset**: when `progress_resets_on_redeem` is true (the default),
  the reward-generating transaction subtracts exactly the threshold from the balance — not
  a hard reset to 0 — so excess correctly carries into the next cycle. **Verified live**:
  a customer at 0 points who earns 550 in one transaction gets a reward AND lands at 50, not
  0 and not 550.
- **`allow_multiple_rewards`**: if true (default), crossing the threshold again while a
  previous reward from the same program is still `AVAILABLE` generates another one — **verified
  live**: the 550-point transaction above also produced a *second* `AVAILABLE` reward
  alongside the first, unredeemed one. If false, a new reward is withheld while one is
  already outstanding, so a non-resetting program can't spam rewards on every later
  transaction once it first crosses the threshold.
- **Reward count is authoritative from the ledger**, never from a mutable "current reward"
  pointer — `rewards.source_loyalty_transaction_id` traces every reward back to the exact
  `EARN` ledger row that produced it.

### `reverse_transaction` (Part 20 — implemented, with a documented limit)

OWNER/MANAGER only. Voids the transaction (`status = 'VOID'`, never deleted) and, for every
non-reversed `loyalty_transactions` row it produced, inserts an offsetting `REVERSAL` row and
decrements `loyalty_accounts` by that same amount (clamped at 0 via `GREATEST` — verified:
reversing a stamp on an account already at 0 post-reset correctly stays at 0 rather than
going negative). **Known limitation, intentionally out of Day 2 scope**: does not
retroactively cancel a reward that was already generated off the reversed transaction —
unwinding a reward that might already be redeemed is a materially bigger problem, deferred.

## Gotcha found during testing: INSERT ... RETURNING re-checks the SELECT policy

Postgres applies a table's SELECT-policy `USING` clause to the row returned by
`INSERT ... RETURNING`/`UPDATE ... RETURNING`, in addition to the INSERT/UPDATE policy's own
`WITH CHECK`. This bit us for real in `app/onboarding/actions.ts`: inserting a `businesses`
row while chaining Supabase's `.select()` (which compiles to `INSERT ... RETURNING`) failed
with `42501 new row violates row-level security policy for table "businesses"` — even though
the INSERT policy's own check (`owner_profile_id = auth.uid()`) was trivially satisfied.

The cause: `businesses_select_members` requires `private.is_business_member(id)`, which is
only true once the `on_business_created` AFTER INSERT trigger has created the OWNER
`business_members` row — and that trigger's effect is not guaranteed visible in time for the
same statement's `RETURNING` policy check.

**Fix/pattern**: when inserting a row whose own SELECT policy depends on a side effect (a
trigger, or a row inserted earlier in the same request) that hasn't necessarily committed
yet, don't chain `.select()` on that insert. Do a plain insert, then a separate `.select()`
call (a new statement) to read it back. Keep this in mind when writing the Day 2/3 loyalty
RPCs — anywhere a trigger grants the access a subsequent read depends on, split the write
and the read-back into two statements.

## Known simplifications (documented on purpose, revisit if wrong)

- One reward tier per `loyalty_programs` row (no tiers/bronze-silver-gold yet — spec explicitly
  defers this, §10).
- `customer_consents` stores current status per channel, not a full history ledger. If we
  need "show me every consent change over time," add a `customer_consent_events` append-only
  table later; the `audit_logs` table already captures who/when for anything routed through
  it.
- No soft-delete columns yet (`deleted_at`) — nothing deletes real business data yet in the
  MVP flows, so this is deferred until the "cancel subscription" / "customer data deletion
  request" work in a later pass (spec §45).
