# Architecture

## Product in one paragraph

**LoyalNest** — "Turn first-time customers into loyal regulars." A multi-tenant SaaS that
lets repeat-customer businesses (coffee shops first, then padel clubs, barbers, salons, gyms,
restaurants, ...) run a configurable loyalty program, keep a lightweight CRM on their
customers, and send consent-gated WhatsApp/SMS/Email campaigns and automations that bring
customers back. One codebase, one database, many independent businesses ("tenants"), dynamic
per-business branding.

**Brand boundary**: "LoyalNest" is the name of *our* company/SaaS and is used across
business-facing surfaces (marketing site, dashboard chrome, emails to business owners, these
docs). It must never be hardcoded into the *customer*-facing, white-labelable surfaces — the
digital loyalty card, the join page, wallet passes, and any customer-facing message — those
render the business's own name/logo/colors from `business_branding`, with at most a small
"Powered by LoyalNest" mark at the STANDARD tier (see §3 in the original spec / `businesses`
→ `business_branding.white_label_level`).

## Tech stack

- **Next.js 16** (App Router). Note: `middleware.ts` is deprecated in this version and
  renamed to `proxy.ts` (exported function `proxy`, not `middleware`) — see
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **React 19**, **TypeScript** (strict), **Tailwind v4**.
- **Supabase**: Postgres 17, Auth, Storage (logos), RLS for tenant isolation.
- **Zod** for all input validation at the server boundary (server actions, route handlers).
- Messaging/billing providers are integrated behind small service interfaces
  (`WhatsAppService`, `SMSService`, `EmailService`, `WalletService`, `BillingService`) so a
  provider can be swapped without touching call sites. See `docs/integrations.md`.

## Tenancy model

- Every business-owned row carries `business_id` (and `location_id` where relevant).
- A human (`profiles`, 1:1 with `auth.users`) can belong to multiple `businesses` through
  `business_members` with a `role` (`OWNER`, `MANAGER`, `STAFF`). There is no cross-business
  sharing of customer/loyalty/campaign data, ever.
- `PLATFORM_ADMIN` is a flag on `profiles` (`is_platform_admin`), not a business role — it's
  for us operating the platform, not a business-level permission.

## Two data paths (this is the core security decision)

1. **Dashboard path (authenticated staff/owners).** Browser holds a Supabase session (via
   `@supabase/ssr` cookies). All reads/writes for dashboard screens go straight through the
   Supabase client using the `authenticated` role, and **Postgres RLS is the only thing
   standing between one business's data and another's**. See `docs/database.md` for the RLS
   design. The Next.js app never re-implements tenant filtering in application code as the
   primary defense — RLS is.

2. **Public/customer path (unauthenticated).** Customer signup (`/join/[business-slug]`) and
   staff-initiated transaction/loyalty writes are the two places where an unauthenticated or
   semi-trusted actor triggers a privileged mutation (creating a customer row across the
   anon boundary; awarding points/stamps that must be computed server-side and never trusted
   from the client). These go through **Next.js Server Actions that use the Supabase
   **service role** key**, never the anon key with permissive RLS. All business rules
   (phone normalization, dedup on `(business_id, phone_normalized)`, loyalty math, reward
   generation, double-redemption prevention) are enforced in that server code, wrapped in a
   Postgres transaction. This is why `customers`, `transactions`, `loyalty_transactions`,
   `rewards` have **no permissive RLS policies for `anon`** — the only way in is the
   service-role server action, which is a deliberate, audited chokepoint.

   Consequence for future you: if you're tempted to call `supabase.from('customers').insert()`
   from client code on the public join page, stop — write a server action instead.

## QR / wallet identification

- `customers.wallet_token` is an opaque random UUID, not derived from phone/email/id.
- Scanning a QR **only ever resolves identity** (business + customer + loyalty state). It
  never by itself creates a transaction or changes points/stamps. Staff must confirm a
  transaction (or explicitly redeem a reward) as a separate, audited step. See
  `docs/database.md` → `loyalty_transactions` for the ledger that makes this auditable.
- The same `wallet_token` is scanned identically by a phone camera, tablet camera, or a
  USB/Bluetooth barcode scanner (those act as keyboard input of the encoded string), so no
  backend logic is tied to a specific scanning technology.

## Loyalty engine (industry-agnostic)

`loyalty_programs.type` is `STAMPS` or `POINTS`. A single generic engine
(`services/loyalty.ts`, added Day 2) evaluates:

- STAMPS: `stamps_count >= stamp_required_count` → generate a reward, then reset or
  accumulate per `progress_resets_on_redeem` / `allow_multiple_rewards`.
- POINTS: `points_balance` accrues via `points_per_currency_unit` on each qualifying
  transaction; crossing `points_reward_threshold` generates a reward.

Nothing in the engine, schema, or UI copy hardcodes "coffee" — business-facing wording
("purchases" vs "bookings" vs "visits") is a display-layer concern driven by
`businesses.business_type`, never a schema or engine concept. The Day 2 acceptance test is
literally: configure a padel business with 10 bookings → 1 reward, with zero backend code
changes.

## Background jobs (campaigns/automations, Day 4)

Bulk sends must not run synchronously inside a request. Chosen approach for the 5-day MVP:
**Postgres-native job table + Supabase Scheduled/Cron-triggered Edge Function polling loop**
(`campaign_recipients` rows start `QUEUED`; a cron-invoked worker claims a batch with
`FOR UPDATE SKIP LOCKED`, calls the provider, updates status). This is chosen over
Inngest/Trigger.dev for the MVP because it needs zero new infrastructure or accounts beyond
Supabase (which is already linked) and the volumes in week one are small; the
`campaign_recipients` / `message_events` schema is provider-agnostic so swapping in a real
queue later is additive, not a rewrite.

## Read-model views (added Day 2)

When a dashboard screen needs aggregates across one-to-many relations (e.g. "this customer's
transaction count and total spend"), prefer a Postgres view with `security_invoker = true`
over hand-rolled N+1 queries. `security_invoker` is not optional — a plain view runs with the
owner's (`postgres`) privileges and would silently bypass RLS, undoing the entire tenant-
isolation model. With it, the view re-checks RLS as the querying role, so it's exactly as
safe as querying the underlying tables directly. `customer_summary` (migration `0010`) is the
first instance of this pattern; reach for it again before hand-writing another aggregate
query in a Server Component.

## Public customer-facing writes (added Day 2)

The public join flow (`/join/[slug]`) confirms the "Two data paths" design above in
practice: the page read (business/branding/active program) and the write (customer signup +
consent capture) both run through trusted server code using the service-role client
(`lib/public-business.ts`, `app/join/[slug]/actions.ts`) — there is no anon-role RLS policy
for `customers` or `customer_consents`, and there doesn't need to be. Phone identity is
normalized via `libphonenumber-js` (`lib/phone.ts`) before the `(business_id,
phone_normalized)` uniqueness check, defaulting to `+971` for the UAE launch market.

## Repository layout

```
app/                          Next.js routes
  (marketing)/                 public marketing site (current homepage)
  join/[businessSlug]/         public customer signup + digital card
  login/, signup/              auth
  onboarding/                  business creation wizard (Day 1)
  dashboard/                   authenticated app shell + all business_owner/manager/staff screens
lib/
  supabase/                    browser/server/service-role client factories
  validation/                  zod schemas shared by forms + server actions
services/                      business logic (loyalty, campaigns, wallet, billing) — added as built
supabase/migrations/           schema, RLS, seed data (source of truth for the DB)
docs/                          this folder
```

## Non-negotiables (do not regress these)

- No manual dashboard-only schema changes — every change is a migration file.
- No loyalty math on the client — server (service role, transactional) only.
- No weakening RLS "to make a feature work faster."
- No secrets in client bundles or in RLS-bypassable tables readable by `anon`.
