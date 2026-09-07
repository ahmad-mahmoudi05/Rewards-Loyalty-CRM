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

## QR/token security model (added Day 3)

The Staff Mode scanner's only trusted input is `customers.wallet_token` — an opaque
`gen_random_uuid()`, never derived from phone/email/id, unrelated to `customers.id` (Day 1
already established this; Day 3 is the first thing that actually *scans* it). The customer
card's QR encodes `${siteUrl}/q/<wallet_token>` — a URL, not a bare token, for interoperability
with phones' native camera apps (see `app/q/[token]/page.tsx`, a convenience redirect to the
card for anyone who scans it outside our own Staff Mode).

Resolution (`app/dashboard/scanner/actions.ts` → `resolveCustomerByToken`) runs as the
**authenticated staff member**, not a privileged bypass:

1. `lib/validation/scanner.ts`'s `parseScannedToken` strips a URL down to its last path
   segment and validates it as a UUID — anything else (garbage, an arbitrary URL, oversized
   input) is rejected before it ever reaches a query. The scanner never navigates to scanned
   text; it only ever extracts a token.
2. The lookup is `customers` filtered by **both** `wallet_token` and the staff's own
   `business_id` (from their session, never from client input) — belt-and-suspenders with
   the `customers` RLS policy, which independently would hide a cross-tenant row anyway.
3. Every failure mode — malformed input, a token that doesn't exist, a token that belongs to
   a different business — returns the exact same generic message ("This loyalty card
   couldn't be recognized."). Never confirm that a token belongs to *some other* tenant.

The identical function backs a manual "paste/scan a code" input (`HardwareScannerInput` in
`staff-mode-client.tsx`) as the camera path — this is not a test shortcut, it's the real
mechanism a USB/Bluetooth barcode scanner needs, since those devices just type their payload
into whatever's focused and send Enter (Day 1 already documented this compatibility
requirement; Day 3 is what actually delivers it).

**Non-negotiable, enforced structurally, not just by convention**: scanning only ever
resolves identity. The only functions that touch `loyalty_accounts`/`rewards`/
`transactions` are the Day 2 RPCs (`record_transaction`, `redeem_reward`), called from a
*separate* explicit staff action after the scan — there is no code path from "token
resolved" to "loyalty awarded" without that.

## Marketing/messaging engine (added Day 4)

One generic campaign model (`campaigns`/`campaign_recipients`, channel = `EMAIL` |
`WHATSAPP` | `SMS`) backed by one provider-abstraction layer (`services/messaging/`), not
three parallel channel-specific systems — a `MessagingService`-shaped adapter per provider
(`email.ts`, `whatsapp.ts`, `sms.ts`), each exposing the same `{success, providerMessageId}`
/ `{success: false, error, permanent}` result shape so the queue worker
(`services/campaigns/process.ts`) never branches on provider, only on channel to pick which
adapter to call. Retention automations (`services/automations/`) share this same messaging
layer rather than re-implementing sends — see `docs/database.md` for the full design.

Background processing deliberately uses no new external service: Next.js `after()` for
immediate post-send processing, a `/api/campaigns/process` route as the cron-driven
durability net, and Postgres `FOR UPDATE SKIP LOCKED` for atomic work-claiming. This is the
same reasoning as Day 1's original queue note, now actually implemented.

## Provider webhooks / tenant resolution (added Day 4.5)

`app/api/webhooks/{resend,meta,twilio}/route.ts` share one shape, deliberately: verify the
provider's signature over the *raw* body before parsing anything, resolve which business a
given event belongs to from data *inside the payload itself* (never a URL parameter, which
would let anyone probe by guessing business ids), record the event idempotently
(`message_events`/`inbound_messages`, unique on the provider's own event/message id), and only
then apply any state change — with a second business-id check between the payload's resolved
tenant and the row actually found, so a status update can never cross tenants even if a
provider-issued message id were somehow known to an attacker. See `docs/database.md` "Meta +
Twilio webhooks: design" for the exact per-provider mechanics (Meta: `phone_number_id` →
business; Twilio: signature can only be validated *after* resolving the business from the
payload's own `AccountSid`, since each business has its own `authToken`).

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
