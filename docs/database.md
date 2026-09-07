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
| `0010_customer_summary_view.sql` | `customer_summary` read-model view |
| `0011_loyalty_engine_functions.sql` | `record_transaction`, `redeem_reward`, `reverse_transaction` |
| `0012_reversal_reward_cancellation.sql` | `reverse_transaction` also cancels an unredeemed reward |
| `0013_wallet_token_rotation.sql` | `rotate_customer_wallet_token` |
| `0014_owner_role_guard.sql` | Blocks self-escalation to OWNER on `business_members` |
| `0015_campaign_status_expansion.sql` | Full campaign/recipient lifecycle statuses, retry bookkeeping |
| `0016_customer_unsubscribe_token.sql` | `customers.unsubscribe_token` |
| `0017_business_invitations.sql` | Real invite-then-accept staff flow |
| `0018_campaign_engine_functions.sql` | Campaign engine RPCs (snapshot/claim/finalize/invite/offer) |
| `0019_campaign_offers.sql` | Offer fields on `campaigns` + `customer_offers` generation |
| `0020_retention_automations.sql` | 5-type automation model, `grant_automation_bonus`, `ensure_system_tag` |
| `0021_customer_summary_unsubscribe_token.sql` | Adds `unsubscribe_token` to `customer_summary` |
| `0022_provider_webhooks.sql` | `inbound_messages`; template sync columns; removes `LOYALTY_EXPIRY_REMINDER` |
| `0023_message_templates_upsert_fix.sql` | Fixes a partial-index/`ON CONFLICT` bug found while building template sync |

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

## Day 3 additions

- `0012_reversal_reward_cancellation.sql` — replaces `reverse_transaction`'s body (same
  signature) to also cancel a reward if it was generated solely off the transaction being
  reversed and is still `AVAILABLE` (`rewards.status -> 'CANCELLED'`). If that reward was
  already `REDEEMED`, it is left untouched and the function's JSON result carries
  `reward_conflict: true` plus `conflicted_reward_ids` — verified live: reversing a
  transaction before its reward is redeemed correctly cancels it; reversing after redemption
  leaves the `REDEEMED` reward exactly as-is and reports the conflict instead of silently
  undoing history.
- `0013_wallet_token_rotation.sql` — `rotate_customer_wallet_token(business_id, customer_id)`,
  OWNER/MANAGER only. Replaces `customers.wallet_token` with a fresh `gen_random_uuid()`;
  any previously issued QR/Wallet pass encoding the old value simply stops matching any row.
- `0014_owner_role_guard.sql` — a `BEFORE INSERT OR UPDATE` trigger on `business_members`
  rejecting any write that would set `role = 'OWNER'` while a different OWNER row already
  exists for that business. Closes the escalation gap flagged (and deliberately deferred) in
  Day 1: a MANAGER could otherwise promote themselves to OWNER via the same RLS write policy
  that legitimately lets them manage staff. The bootstrap OWNER insert (from
  `on_business_created`, migration 0002) is unaffected since it's always the first membership
  for a new business. The Day 3 staff-invite feature also independently restricts its own
  role parameter to `STAFF`/`MANAGER` at the application layer — this trigger is the
  database-level backstop for any other write path.
- `customers.wallet_token` (already existed, Day 1) is now load-bearing for the QR/Wallet
  identity system: the customer-facing card's QR encodes `/q/<wallet_token>`, and the Staff
  Mode scanner's only trusted input is that same token. See `docs/architecture.md` for the
  full token-resolution security model.
- No new tables were needed for the wallet architecture — `wallet_passes` (Day 1) already has
  the columns a real integration would populate (`serial_number`, `auth_token`,
  `last_pushed_at`); nothing writes to it yet since signing isn't implemented (see
  `docs/integrations.md`).

## Day 4 additions

- `0015_campaign_status_expansion.sql` — full campaign/recipient lifecycle status sets (adds
  `SCHEDULED`/`PARTIALLY_FAILED` to campaigns; `PENDING`/`SKIPPED_NO_CONSENT`/
  `SKIPPED_INVALID_ADDRESS`/`UNSUBSCRIBED`/`CANCELLED` to recipients), plus
  `unique(campaign_id, customer_id)` and `attempt_count`/`next_attempt_at` for retry/backoff
  bookkeeping.
- `0016_customer_unsubscribe_token.sql` — `customers.unsubscribe_token`, deliberately
  separate from Day 3's `wallet_token` (different purpose, different exposure surface).
- `0017_business_invitations.sql` — replaces Day 3's MVP staff-invite (create account +
  show a password once) with a real invite-then-accept flow. `business_id`/`role` are fixed
  on the invitation row and never re-supplied by the client at acceptance — see
  `accept_business_invitation` below.
- `0018_campaign_engine_functions.sql` — the campaign engine's trusted surface:
  `snapshot_campaign_recipients` (defensively re-validates every candidate customer id
  against `p_business_id` — a forged/cross-tenant id is silently excluded, not an error — and
  is called with a candidate list computed via the caller's own RLS-scoped session, never a
  service-role bypass), `claim_queued_recipients` (atomic `FOR UPDATE SKIP LOCKED` claim,
  restricted to `service_role` since it operates across every business's due work and has no
  per-caller auth check of its own), `finalize_campaign_if_complete`, `accept_business_invitation`,
  `redeem_customer_offer`.
- `0019_campaign_offers.sql` — optional offer fields on `campaigns` (`offer_type`,
  `offer_value`, `offer_expiry_days`, `offer_description`); `snapshot_campaign_recipients`
  creates one real `customer_offers` row per eligible recipient at snapshot time.
- `0020_retention_automations.sql` — narrows `automations.trigger_type` to exactly five
  values (`INACTIVE_WINBACK`, `BIRTHDAY_REWARD`, `REWARD_READY_REMINDER`, `VIP_UPGRADE`,
  `LOYALTY_EXPIRY_REMINDER`), replacing Day 1's looser placeholder set (never used by any app
  code, so a clean swap). Adds `automation_runs.trigger_entity_id`. Adds
  `grant_automation_bonus` (the only way an automation may add loyalty value — restricted to
  `service_role`, since automations run as a trusted background job with no authenticated
  staff session to check `business_members` against) and `ensure_system_tag` (idempotent
  get-or-create for the `AT_RISK`/`VIP` system tags, reusing Day 1's `tags`/`customer_tags`
  rather than a new status column).
- `0021_customer_summary_unsubscribe_token.sql` — `customer_summary` (Day 2) predates
  `unsubscribe_token` (this session); added as a trailing column via `CREATE OR REPLACE VIEW`.

### Campaign engine design notes

- **Recipient snapshot is real and frozen**: `campaign_recipients` rows are created once, at
  send time, from the segment match at that instant — the segment is never recomputed mid-send.
  Consent is checked twice: once to decide who gets snapshotted, and again by the worker
  immediately before each dispatch (a revocation between snapshot and send produces
  `SKIPPED_NO_CONSENT` on that one row, not a failure of the whole campaign).
- **Retry/backoff**: `attempt_count` + `next_attempt_at`, capped at 5 attempts with
  `2^attempt` minutes backoff (capped at 60 min) — see `services/campaigns/process.ts`.
  Permanent vs transient is decided per-provider (Resend's `error.name`, Meta's HTTP status,
  Twilio's `status`) — verified live: a Resend `validation_error` (invalid recipient) was
  correctly classified permanent and never retried.
- **Idempotency**: `campaign_recipients.id` (or `automation_runs.id`) is passed as the
  provider's own idempotency key on every send call (Resend's `idempotencyKey` option,
  Twilio's `statusCallback`-linked message SID) — a worker retry of the same row can never
  cause two provider sends for the intended recipient. Verified live: two concurrent
  `claim_queued_recipients` calls against the same batch never both claimed the same row
  (`attempt_count` stayed exactly 1 per recipient across the whole run).
- **Background processing**: chosen path is Next.js's `after()` (fires the first processing
  pass immediately when a campaign is sent, without making the owner wait — see Part 35's
  "return to UI immediately") plus a `/api/campaigns/process` route meant to be hit by a
  platform cron (e.g. Vercel Cron, not yet configured in `vercel.json`) as the durability
  safety net for scheduled campaigns and anything left over from an interrupted run. This was
  chosen over Inngest/Trigger.dev/pgmq specifically because it needs zero new external
  service or account — consistent with the reasoning already in `docs/architecture.md`'s
  original queue-design note from Day 1.

### Retention automations: what's real vs. documented-limited

- Four of five automation types are fully functional and verified live end-to-end:
  `INACTIVE_WINBACK` (tag + bonus + message, dedup by last-visit-date "cycle", `AT_RISK` tag
  cleared on return), `BIRTHDAY_REWARD` (dedup by year), `REWARD_READY_REMINDER` (dedup by
  `<reward_id>:initial`/`:followup`, re-checks the reward is still `AVAILABLE` immediately
  before sending), `VIP_UPGRADE` (dedup by a constant key — fires at most once ever per
  customer per automation, since "trigger on threshold crossing" doesn't need to re-fire on
  every later transaction).
- **`LOYALTY_EXPIRY_REMINDER` was removed in Day 4.5** (migration `0022`), not shipped as a
  fifth automation that silently does nothing. See "Day 4.5 additions → Loyalty expiry —
  deferred, not faked" below for the full reasoning and the concrete post-launch design.
- **Automation-granted bonus points/stamps use the exact same ledger as staff-recorded
  transactions** (`loyalty_transactions` with `transaction_type = 'BONUS'`) — verified live:
  an inactive-winback bonus showed up in the customer's ledger with a human-readable
  description, auditable the same way any other loyalty change is.
- **Bonus/tag application happens even when the message is skipped for no consent** — a
  deliberate design choice, not an oversight: consent gates being *contacted*, not whether a
  customer *receives* loyalty value they'll see next time they check their own card
  regardless of marketing opt-in status.

## Day 4.5 additions

- `0022_provider_webhooks.sql`:
  - `inbound_messages` — one generic table for any inbound provider event that isn't a status
    update on a message this system sent: customer-initiated WhatsApp messages and inbound
    SMS, including opt-out keyword detection (`is_optout`). Deliberately not split into
    `whatsapp_events`/`sms_events` — same "one system per capability, not one per channel"
    rule the campaign engine already follows (`docs/architecture.md`). `business_id`/
    `customer_id` are nullable (a message can arrive for a `phone_number_id`/`AccountSid` this
    system doesn't recognize, or from a number with no matching customer) — never dropped
    silently, always stored, resolved as far as possible. Enough to build a future unified
    inbox on without building the inbox itself this session. Idempotent on
    `(channel, provider_message_id)`.
  - `message_templates` gained `components` (jsonb — the actual template content: header/
    body/footer/buttons, exactly as Meta returns it) and `last_synced_at`; `status` widened to
    include `PAUSED`/`DISABLED` (Meta's real template states, not just the four this project
    invented in Day 1 before real sync existed).
  - `automation_runs_provider_message_idx` — an expression index on
    `action_result ->> 'provider_message_id'`. Automation-sent messages don't have a
    dedicated `provider_message_id` column (it lives inside `action_result`, set by
    `services/automations/shared.ts::sendAutomationMessage`); this index lets the Meta/Twilio
    webhooks resolve a status update for an automation-originated send the same way they
    already do for `campaign_recipients`, without changing a table Day 4 already shipped and
    tested.
  - Also removes `LOYALTY_EXPIRY_REMINDER` from `automations.trigger_type` (see below).
- `0023_message_templates_upsert_fix.sql` — a real bug found immediately while wiring up the
  template-sync upsert: `message_templates_provider_template_idx` was originally a *partial*
  unique index (`where provider_template_id is not null`). PostgREST's
  `upsert(..., { onConflict: "business_id,provider_template_id" })` generates a plain
  `ON CONFLICT (business_id, provider_template_id)`, and Postgres will only infer a partial
  index for that if the `ON CONFLICT` clause repeats the exact same predicate — a plain
  column-list `ON CONFLICT` never matches a partial index, even for rows that satisfy its
  predicate. Fixed by dropping the predicate entirely: Postgres unique indexes already treat
  every `NULL` as distinct from every other `NULL` by default, which is the exact same
  "many un-synced templates, no collision" behavior the partial predicate was trying to
  express — so nothing was lost by removing it, only a real upsert bug.

### Meta + Twilio webhooks: design

- **Tenant resolution happens from the payload itself, not a URL parameter**: Meta's webhook
  payload carries `phone_number_id`; Twilio's carries `AccountSid`. Both are looked up against
  `business_integrations.config` (`.contains()` on the jsonb column) to find the owning
  business *before* anything else happens. Twilio's signature can only be validated once that
  business's `authToken` is known — an unrecognized `AccountSid` is rejected outright (404)
  before any signature check is even attempted, since there's nothing to validate against.
- **Defense in depth on status updates**: even after a `campaign_recipients`/`automation_runs`
  row is found by `provider_message_id` (already an unguessable, provider-issued id — a real
  security boundary on its own), the resolved business from the payload is compared against
  the found row's own `business_id` before applying any update. A mismatch is silently
  ignored, never applied across tenants — verified live (see `docs/progress.md`).
- **Idempotency reuses `message_events`** (Day 4's Resend pattern) for every status update
  from either provider — `(provider_message_id, event_type)` unique index, `event_type`
  prefixed per provider (`whatsapp.delivered`, `sms.failed`, ...) so the same message id from
  two different channels can never collide.
- **Opt-out is a fixed, conservative word list** (`STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`,
  `QUIT` — Twilio's own default stop-word list, reused for WhatsApp too for consistency),
  matched as the *entire* trimmed/uppercased message body (minor trailing punctuation
  tolerated), never a substring match — "please stop by later" must never opt someone out.
  Verified live both ways (see `docs/progress.md`).

### Loyalty expiry — deferred, not faked (spec item 5, second path chosen)

`LOYALTY_EXPIRY_REMINDER` is removed from `automations.trigger_type` (migration `0022`) rather
than shipped as a fifth automation that can never actually fire. Real reasoning, not just "ran
out of time":

- The Day 2 loyalty engine's `record_transaction`/`redeem_reward` RPCs are already tested,
  live, and hit on every single scan/redemption — real lot-based expiry (tracking *which*
  earned amount expires *when*, decrementing lots FIFO on redemption, leaving already-used
  value alone) means changing the body of both of those functions. That's meaningfully
  riskier than adding a new, independent webhook route, and this session's actual priority
  (per the spec) was closing the messaging/provider gaps, not touching the core ledger.
- `loyalty_transactions.transaction_type` already includes `'EXPIRATION'` (added Day 2,
  unused until now) — the ledger was designed with this in mind, so the future work below is
  additive, not a redesign.

**Concrete post-launch design**, so this isn't a vague "someday":

1. Add `loyalty_programs.points_expiry_days` / `stamps_expiry_days` (nullable — `null` means
   "never expires", preserving today's behavior for every existing program with zero
   migration risk).
2. Add a `loyalty_lots` table: one row per `EARN`/`BONUS` `loyalty_transactions` row, with
   `amount`, `remaining_amount`, `expires_at`. `record_transaction`/`grant_automation_bonus`
   insert one lot alongside the ledger row they already write.
3. `redeem_reward` (and the reward-threshold reset inside `record_transaction`) decrement
   `loyalty_lots.remaining_amount` **FIFO** (oldest `expires_at` first) instead of only
   touching the aggregate `loyalty_accounts` balance — this is the part that touches
   already-tested code and needs its own careful test pass.
4. A new scheduled evaluator (same shape as `/api/automations/run`) finds lots where
   `expires_at <= now()` and `remaining_amount > 0`, inserts an `EXPIRATION`
   `loyalty_transactions` row for exactly `remaining_amount`, zeroes the lot, and decrements
   `loyalty_accounts` by that amount — auditable, never an invisible balance mutation, exactly
   like every other ledger-driven balance change in this schema.
5. `LOYALTY_EXPIRY_REMINDER` comes back as a sixth automation type, reading real upcoming-
   expiry lots (3/7/14/30-day configurable lead time), re-checking `remaining_amount > 0`
   immediately before sending (same re-check-at-send-time pattern every other automation
   already uses), deduplicated per lot per lead-time window.

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
