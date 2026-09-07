# Progress Log

Read this (plus `README.md`, `docs/architecture.md`, `docs/launch-checklist.md`, and the
current migrations) at the start of every session before continuing.

## 2026-09-07 — Session 1

### Completed

- Read the full product/technical spec; wrote `docs/architecture.md`, `docs/database.md`,
  `docs/integrations.md`, `docs/launch-checklist.md`.
- Designed and shipped the full multi-tenant schema: 9 migration files in
  `supabase/migrations/`, covering tenancy, CRM, the configurable loyalty engine, marketing/
  automations, billing, and audit logging. Pushed to the linked remote project
  (`ibzbdxizkihvlnqegjpj`) with `npx supabase db push` — confirmed applied via
  `npx supabase migration list`.
- Enabled RLS on every table with a consistent, function-based policy design (see
  `docs/database.md`). Ledger tables (`loyalty_accounts`, `transactions`,
  `loyalty_transactions`, `rewards`, `reward_redemptions`) deliberately have no client-facing
  write policy — writes will land there Day 2 via SECURITY DEFINER RPCs only.
- Confirmed a critical Next.js 16 breaking change relevant to auth: `middleware.ts` is
  deprecated, renamed to `proxy.ts` (exported function `proxy`, not `middleware`). Built
  `proxy.ts` accordingly (optimistic auth redirect only, per Next's own guidance — no DB
  calls in it).
- Brand finalized mid-session: **LoyalNest** ("Turn first-time customers into loyal
  regulars" / "Loyalty that brings customers back"). Applied to the marketing homepage,
  `<title>`/metadata, dashboard sidebar, README, and docs. Explicitly NOT hardcoded into
  white-label customer-facing surfaces (join page, digital card, wallet passes) — those will
  render the business's own branding from `business_branding` once built (Day 2), matching
  the brand-boundary rule now documented in `docs/architecture.md`.
- Day 1 build: installed `zod`, `clsx`, `class-variance-authority`, `tailwind-merge`,
  `lucide-react`, `server-only`; generated `lib/supabase/database.types.ts` from the live
  schema; wrote `lib/supabase/{client,server,service}.ts`, `lib/dal.ts`,
  `lib/validation/{auth,onboarding}.ts`, `lib/utils.ts`, `proxy.ts`; built `/signup`, `/login`
  (with `useActionState` forms + server actions), `/onboarding` (creates business + default
  branding row + first location), and the full dashboard shell (`/dashboard` + 13 nav
  sections — Overview, Locations, and Team are real/data-backed; the rest are scoped
  placeholders naming which day builds them out).
- Added `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (fetched via
  `npx supabase projects api-keys`) and documented every env var in `.env.example`.
- **Verified the Day 1 acceptance test end-to-end in a real browser** (Playwright against the
  dev server, using the Supabase admin API to pre-confirm two disposable test accounts since
  the linked project requires email confirmation — see "External blockers" below): owner
  signs up → onboarding creates a business + location → dashboard shows the business name,
  the correct location, and the owner as OWNER in Team → logging out and back in (fresh
  browser session) lands directly on that business's dashboard, not onboarding again. A
  second owner created a second business (Smash Padel, PADEL type, different location) and
  their session showed **zero** data from the first business — tenant isolation via RLS
  holds. All test users/businesses created during this verification were deleted afterward.
- **Found and fixed a real RLS bug during that testing**: `INSERT ... RETURNING` re-applies
  the target table's SELECT policy to the returned row, which failed on `businesses` because
  the OWNER `business_members` row (created by an AFTER INSERT trigger) wasn't guaranteed
  visible in time for that check. Fixed by not chaining `.select()` on that insert and doing
  a separate read-back instead. Full writeup in `docs/database.md` ("Gotcha found during
  testing") — relevant again for the Day 2/3 RPCs.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass clean.

### Known bugs

- None open. (The RLS/RETURNING bug above was found and fixed this session.)

### External blockers

- **Resolved this session, user-confirmed**: the linked Supabase project required email
  confirmation on signup (unlike `supabase/config.toml`'s `enable_confirmations = false`,
  which had only ever governed the local Docker stack, never the hosted project). User chose
  "disable for now" — ran `npx supabase config push`, which synced the repo's already-committed
  `config.toml` auth section to the hosted project. `enable_confirmations` is now `false`
  remotely, so `/signup` → `/onboarding` works immediately. **Side effect to know about**:
  `config push` syncs the *whole* `[auth]` section, not just that one flag — it also changed
  `site_url`/`additional_redirect_urls` to match `config.toml`, disabled MFA enrollment
  (already off by default), and set email OTP `max_frequency` to `1s` / `otp_length` to `6`
  (config.toml's stock `supabase init` template values, meant for local dev where email goes
  to a test inbox, not a real send-rate limit). **Before Day 5 production launch, revisit the
  full `[auth]` section in `config.toml` deliberately** (re-enable `enable_confirmations`,
  tighten `max_frequency`, set the real production `site_url`) rather than pushing local-dev
  defaults as-is.
- Also hit Supabase's built-in email-sending rate limit while testing repeated signups
  through real `/signup` submissions (expected on the free tier's default email provider);
  unrelated to the app, just a testing-velocity note if verifying `/signup` manually again
  soon.
- Stripe/WhatsApp/Twilio/Resend/Wallet accounts are needed starting Day 3–5 — see
  `docs/integrations.md` for exact env vars and setup steps, none of which block earlier
  work.

### Environment variables currently required

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` are all set in `.env.local` (the last one added this session).
  `.env.example` documents every var, including ones needed in later days.

### Database migrations created this session

`0001_extensions_and_helpers`, `0002_profiles_and_tenancy`, `0003_customers`,
`0004_loyalty`, `0005_marketing`, `0006_billing`, `0007_audit`, `0008_rls`,
`0009_seed_plans` — all applied to the remote linked project. No schema changes made outside
of migration files.

### Next highest-priority task (superseded — see Session 2)

Day 2: decide the email-confirmation question above, then build customer signup
(`/join/[businessSlug]`), the CRM customer list/profile, loyalty program configuration UI,
and the loyalty-engine RPCs (transaction → ledger → reward generation), per
`docs/launch-checklist.md`.

## 2026-09-07 — Session 2 (Day 2 — customers + loyalty engine)

### Completed

- Re-read `README.md`, `docs/architecture.md`, `docs/database.md`, `docs/progress.md`,
  `docs/launch-checklist.md`, every migration, and the existing auth/onboarding/RLS code
  before writing anything, per this session's instructions. No Day 1 architecture was changed
  without documenting why (the one true architectural change — `INSERT`s must not chain
  `.select()` when the row's own SELECT policy depends on a same-statement trigger side
  effect — was already discovered and documented in Session 1; this session's `record_transaction`/
  `redeem_reward`/`reverse_transaction` RPCs don't hit it since they're plpgsql, not PostgREST
  `INSERT...RETURNING`).
- **Migrations 0010–0011** (both pushed to the linked project, types regenerated):
  - `0010_customer_summary_view.sql` — `customer_summary`, a `security_invoker = true` view
    joining per-customer transaction/spend/reward/consent aggregates via scalar subqueries
    and a LATERAL join (not plain JOINs, to avoid fan-out row multiplication across the three
    one-to-many relations). Backs the CRM list and profile pages without N+1 queries.
  - `0011_loyalty_engine_functions.sql` — `record_transaction`, `redeem_reward`,
    `reverse_transaction`. SECURITY DEFINER, `EXECUTE` revoked from `PUBLIC` and granted only
    to `authenticated`. These are the only way the ledger tables get written — see
    `docs/database.md` "Day 2 additions" for the exact math (stamp/points calculation,
    overflow-preserving threshold subtraction, `allow_multiple_rewards` handling).
- **App code**: `lib/phone.ts` (libphonenumber-js, defaults to +971), `lib/qr.ts` (`qrcode`
  package, server-only data-URL generation), `lib/site-url.ts`, `lib/public-business.ts`
  (service-role read path for the public join/card pages), `lib/validation/{join,loyalty,
  transaction}.ts`; `/dashboard/loyalty` (create/edit STAMPS or POINTS program, OWNER/MANAGER
  only); `/dashboard/customers` (real CRM list backed by `customer_summary`, search, 8 working
  filters, signup-QR panel with copy-link + PNG download); `/dashboard/customers/[id]` (full
  profile — identity, loyalty progress, transaction entry form, available-reward redeem
  buttons, transaction history, loyalty ledger, reward history, consent history);
  `/join/[slug]` (public, business-branded signup) and `/join/[slug]/card` (post-join digital
  progress screen, doubles as the "welcome back" view on repeat visits).
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass clean.

### Bugs found and fixed this session

1. **Test-script bug, not an app bug, but worth recording**: the dashboard sidebar's logout
   `<form>` renders before `<main>` in the DOM, so an unscoped `button[type="submit"]`
   selector in browser automation clicks "Log out" instead of the page's own save button.
   Scope submit-button selectors to `main` (or a more specific locator) on any dashboard page
   under test.
2. No real application bugs found this session (Day 1's RLS/RETURNING bug was the only one;
   everything built this session passed its live tests on the first architecturally-sound
   attempt). A hydration-mismatch console warning
   (`style={{caret-color:"transparent"}}` added client-side only) appeared on the `/join`
   page during automated (Playwright/headless-Chromium) form-filling; investigated and it
   does not correspond to anything in this codebase (`caret-color` appears nowhere in the
   source) — consistent with a known headless-Chromium automation artifact, not a real user-
   facing defect. Recommend a quick manual look in a real browser next session as a sanity
   check, but not chasing further without evidence it's real.

### Live acceptance tests performed (all against the linked Supabase project, real data, no mocks)

Three businesses were created end-to-end through the actual UI (signup → onboarding → loyalty
config → join QR → customer join → transactions → reward → redemption), then all test data was
deleted afterward:

- **Brew Café** (COFFEE_SHOP, STAMPS, 5 qualifying visits → Free Regular Coffee). Customer
  "Ahmad" joined via the public `/join` page with WhatsApp+Email consent (SMS declined) —
  confirmed both channels persisted correctly and independently. Recorded 5 transactions of
  AED 18 one at a time; ledger showed exactly 5 `EARN` rows (+1 stamp each); reward generated
  exactly once at the 5th; progress correctly reset 5→0 (threshold subtracted, not a hard
  zero, though with an exact-threshold hit there was no excess to observe here — see the
  Example Salon overflow test below for that). Redeemed the reward; ledger recorded a `REDEEM`
  row; reward table showed `REDEEMED` with a timestamp. **Duplicate-join test**: joining again
  with the exact same phone number did not create a second customer — same `wallet_token`
  both times, and the app correctly flagged the second visit as returning (`new=0` vs `new=1`
  in the resulting card URL).
- **Smash Padel** (PADEL, STAMPS, 10 qualifying visits → 1 Free Court Hour) — **run through
  the identical code path as Brew Café**, only `loyalty_programs` config differed (10 instead
  of 5, different reward name/business type). Customer "Sara" joined, 10 transactions of AED
  80 recorded one at a time, reward generated exactly once at the 10th, progress correctly
  reset 10→0. This is the required industry-independence proof (spec Part 22): zero
  `businessType`/`slug`-conditional logic exists anywhere in the loyalty engine.
- **Example Salon** (SALON, POINTS, AED 1 = 1 point, 500-point threshold → AED 50 Voucher).
  Customer "Lina" joined, transactions of AED 120 then AED 380 recorded (ledger: `EARN +120`,
  `EARN +380`); reward generated exactly once at exactly 500, progress reset to 0. **Overflow
  test** (Part 17's explicit scenario): added a further AED 550 transaction on top of the
  post-reset 0 balance — result: `points_balance` landed at exactly **50** (not 0, not 550 —
  the threshold of 500 was subtracted, preserving the excess) and a **second** reward was
  generated (since `allow_multiple_rewards` defaults to true and the balance crossed the
  threshold again) alongside the still-unredeemed first one. Both behaviors verified directly
  via authenticated RPC call + a service-role read of the resulting row, not inferred.

### Security tests performed (direct authenticated RPC/query calls, not just UI clicks)

- **Concurrent double-redemption**: fired two simultaneous `redeem_reward` calls at the same
  Smash Padel reward. Exactly one succeeded, one failed with "This reward has already been
  redeemed or has expired," and `reward_redemptions` held exactly one row for that reward
  afterward. A third attempt after the fact also failed cleanly. Double redemption is
  impossible by construction (atomic `UPDATE ... WHERE status = 'AVAILABLE'`, plus the
  `unique(reward_id)` constraint as a hard backstop).
- **Cross-tenant isolation**, logged in as the Brew Café owner, targeting Smash Padel's data:
  - Direct `SELECT` on Smash Padel's customer row and reward rows both returned **0 rows**
    (RLS held, no error needed — the rows are simply invisible).
  - `record_transaction` called with Smash Padel's `business_id` → rejected: "You do not have
    access to this business."
  - `redeem_reward` called against a Smash Padel reward id → rejected, same reason.
  - `record_transaction` called with Brew Café's **own** `business_id` but Smash Padel's
    `customer_id`/`loyalty_program_id` (the "manipulate the request" attack the spec calls
    out explicitly) → rejected: "This customer does not belong to this business." Confirms
    the RPC checks tenant *consistency* across every id it's given, not just that the caller
    belongs to *a* business.
- **Transaction reversal**: reversed one of Sara's stamp-earning transactions. Transaction
  flipped to `VOID` (not deleted), a `REVERSAL` ledger row was written referencing the
  original, and `loyalty_accounts.stamps_count` was correctly clamped at 0 via `GREATEST`
  rather than going negative (the account had already been reset to 0 by the reward cycle, so
  reversing one of the contributing transactions can't sensibly subtract further — this is
  the intended clamping behavior, not a bug). A second reversal attempt on the same
  transaction was correctly rejected.
- **CRM filters**, checked against real data, not just visually: `new`, `returning`,
  `reward_available`, `whatsapp`/`sms`/`email` subscribed, and `inactive` each returned the
  exact expected row count/emptiness for the one test customer per business at the time
  (e.g. `reward_available` correctly went from 1 row to 0 the moment that customer's reward
  was redeemed). Search by name also verified (exact match found, no-match correctly shows
  the empty state).
- **Mobile responsiveness**: `/join/[slug]` checked at a 390×844 viewport — no horizontal
  overflow, clean layout (screenshot reviewed).

### Known edge cases / simplifications (see `docs/database.md` for full detail)

- Points rounding is fixed at round-to-nearest-integer; no configurable rounding-mode column
  exists yet (not needed by any Day 2 acceptance test).
- `reverse_transaction` does not retroactively cancel a reward that was already generated off
  the reversed transaction — flagged as a known, documented limitation per the spec's own
  allowance for this ("if too large for Day 2, document it").
- The CRM assumes one active loyalty program per business for display purposes
  (`customer_summary` picks the most-recently-updated `loyalty_accounts` row joined to an
  *active* program); the schema itself supports multiple programs per business, so this is a
  display-layer simplification, not a schema limitation.

### External blockers

None new. See Session 1's entry for the still-relevant email-confirmation /
`config.toml [auth]` note (unchanged, already resolved for the build phase).

### Environment variables

No new ones needed this session. `NEXT_PUBLIC_APP_URL` was added to `.env.example` (optional —
falls back to the incoming request's own host, see `lib/site-url.ts`) for building the
absolute signup-QR link in production.

### Database migrations created this session

`0010_customer_summary_view`, `0011_loyalty_engine_functions` — both applied to the remote
linked project, types regenerated (`lib/supabase/database.types.ts`).

### What Day 3 can safely build on

- The loyalty engine RPCs (`record_transaction`, `redeem_reward`) are real, tested, and
  callable from any authenticated staff session — Day 3's camera scanner and Staff Mode UI
  should call these directly rather than re-implementing any loyalty math.
- `customers.wallet_token` already exists and is exactly what a QR/Wallet pass should encode
  (opaque, unique, not derived from PII) — Day 3 doesn't need a new identity mechanism.
  `/join/[slug]/card` is already a working functional digital-card view; Day 3 extends this
  with Apple/Google Wallet, not from scratch.
- `customer_summary` is a reusable pattern for any future aggregate read — extend it (or add
  siblings) rather than hand-rolling joins.
- The `location_id` plumbing is already present end-to-end (transactions, redemptions,
  reversals) even though Day 2's UI only ever passes the business's primary location — Day 3's
  Staff Mode can pass the actual counter location once multi-location staff assignment exists.

## 2026-09-07 — Session 3 (Day 3 — QR scanner, staff mode, wallet architecture)

### Completed

- Re-read every doc, every migration, and the exact current Day 2 code (`dal.ts`,
  the customer-profile actions/components, the card page) before writing anything, per this
  session's instructions. Reused the Day 2 `RecordTransactionForm`/`RedeemRewardButton`
  components unmodified in substance for the scanner (only added an optional
  `onSuccess`/`onRedeemed` callback prop so a non-route-bound client component can refresh
  itself) — no loyalty logic was reimplemented anywhere.
- **Migrations 0012–0014** (pushed, types regenerated):
  - `0012_reversal_reward_cancellation.sql` — revisited Day 2's documented reversal
    limitation as instructed. `reverse_transaction` now cancels a reward if it was generated
    solely from the reversed transaction and is still `AVAILABLE`; if already `REDEEMED`, it
    reports `reward_conflict: true` instead of touching it. **Verified live, both branches**
    (see Security/correctness tests below).
  - `0013_wallet_token_rotation.sql` — `rotate_customer_wallet_token`, OWNER/MANAGER only.
  - `0014_owner_role_guard.sql` — closes the Day 1-documented OWNER-escalation gap with a
    DB trigger, justified now because Day 3's staff-invite feature is the first real write
    path to `business_members` since onboarding.
- **QR/token security**: `lib/validation/scanner.ts` (`parseScannedToken`) + a token
  resolution path (`app/dashboard/scanner/actions.ts`) that scopes to the staff member's own
  business twice over (explicit filter + RLS) and returns one generic error for every
  failure mode. Full design in `docs/architecture.md` ("QR/token security model").
- **Staff Mode** (`/dashboard/scanner`, replacing the Day 1 placeholder): camera scanner
  (`@zxing/browser`, chosen over the native `BarcodeDetector` for consistent cross-browser
  support — see the component for the exact permission/denied/no-camera/error states), a
  hardware-scanner-compatible manual input (also the real answer to Day 1's "USB barcode
  scanners must work" promise, not a test shortcut), search fallback, and a shared
  `CustomerOperationalPanel` — scan and search converge on one identical operational UI, per
  spec.
- **Customer card** (`/join/[slug]/card`): now shows a real QR (`/q/<wallet_token>`), a
  "remaining until reward" line, last-updated timestamp, and Apple/Google Wallet buttons.
  Added `/q/[token]` as a plain public redirect (for phones' native camera apps that offer
  to open a scanned URL directly, which our own Staff Mode never does).
- **Wallet architecture** (`services/wallet/`): real, spec-correct payload mappers for both
  Apple (`pass.json`) and Google (Loyalty Object) from our own data, gated by a
  configuration check, wired to `/api/wallet/{apple,google}/[token]` routes and graceful
  "not set up yet" UI buttons. Signing (the part that needs real certificates/a Google
  service account) is explicitly not implemented — see "External blockers" and
  `docs/integrations.md` for the precise honest breakdown Part 47 asked for.
- **Staff invitation** (`/dashboard/team`): owner/manager can add a new-or-existing user as
  STAFF/MANAGER (never OWNER); a brand-new account's temporary password is shown once
  (no email-sending infra exists yet — that's Day 4).
- **Role enforcement**: `lib/dal.ts` gained `requireRole()`, applied to
  billing/integrations/analytics/loyalty — direct URL access by a STAFF session now redirects
  server-side, not just a hidden nav link.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass clean.

### Bugs found and fixed this session

1. **Real, pre-existing responsive bug** (not introduced today, but never exercised at phone
   width until Day 3 needed Staff Mode to work on phones): the Day 1 dashboard shell's
   sidebar was a fixed `w-60` column that overflowed horizontally below ~600px. Fixed by
   stacking the shell vertically on small screens and making the nav scroll horizontally
   instead of wrapping (`app/dashboard/layout.tsx`, `components/dashboard/sidebar-nav.tsx`).
   Verified: 375px viewport now has zero horizontal overflow on both Staff Mode and the CRM.
2. A newer `react-hooks/set-state-in-effect` ESLint rule (part of this project's React 19
   toolchain) flagged three legitimate-looking `useEffect` + `setState` patterns (camera
   status reset, platform detection, localStorage sync). Fixed two by switching to `key`-
   based remounting / lazy `useState` initializers (the idiomatic fix); the third
   (localStorage-on-mount, which must run in an effect specifically to avoid an SSR/hydration
   mismatch) was a justified, commented exception — documented inline rather than contorted.
3. No loyalty-engine bugs found — every RPC call across dozens of live test transactions
   produced exactly the expected persisted state on the first architecturally-sound attempt.
   Several apparent "failures" during testing turned out to be the test script reading the
   DOM before an async round trip finished (~650–900ms per RPC call observed in server
   logs); resolved by checking authoritative state via reload/CRM rather than trusting
   fixed-delay client-side timing — the same lesson from Day 1/2, still worth restating.

### Live acceptance tests performed (real data on the linked project, cleaned up after)

- **Brew Café** (STAMPS, 5 → Free Regular Coffee), full scanner lifecycle: customer Ahmad's
  card showed a real QR; staff pasted `/q/<token>` into the hardware-scanner input, saw
  "✓ Customer found / Ahmad / •••• <real last 4 digits>" and correct live progress; recorded
  transactions via the scanner panel and separately via the CRM profile (both call the exact
  same Day 2 RPC); reached 5/5, reward "Free Regular Coffee" appeared automatically; redeemed
  via the CRM; reload confirmed `REDEEMED` status persisted with a timestamp and no redeem
  button remaining.
- **Smash Padel** (STAMPS, 10 → 1 Free Court Hour), same scanner code, only config differs:
  resolved customer "Sara" via search-fallback convergence (not the token path, to prove both
  entry points reach the identical operational UI); topped up to exactly 10; reward generated
  once, progress reset to 0/10 — confirms zero industry-specific branching survived from
  Day 2 into the scanner layer.
- **Reward-cancellation-on-reversal** (Part 31, the reason this was revisited): ran Ahmad
  through a second 5-transaction cycle, reversed the reward-generating transaction *before*
  redeeming — reward flipped `AVAILABLE → CANCELLED`, `reverse_transaction`'s JSON reported
  `cancelled_reward_ids` with the right id and `reward_conflict: false`. Ran a third cycle,
  *redeemed* the reward, then reversed that same transaction — the `REDEEMED` reward was left
  completely untouched and the function reported `reward_conflict: true` instead. Both
  outcomes exactly match the spec's required semantics.
- **Cross-tenant scanner attack**: logged in as the Brew Café owner, fed Smash Padel's real
  customer token into the scanner. Result: generic "This loyalty card couldn't be
  recognized" — no name, no data, no hint that the token was valid *somewhere else*. A
  second attempt with pure garbage input got the identical message.
- **Staff permission test**: invited a STAFF account for Brew Café, logged in as that
  account. Confirmed **allowed**: `/dashboard/scanner`, `/dashboard/customers` (their actual
  job). Confirmed **blocked via direct URL, not just a hidden nav link**:
  `/dashboard/billing`, `/dashboard/integrations`, `/dashboard/analytics`,
  `/dashboard/loyalty` — every one server-side redirected to `/dashboard`. Confirmed the Team
  page shows the roster but not the invite form for a STAFF viewer.
- **Responsive**: 390px mobile customer card (with the new QR) — no overflow. 1024px tablet
  landscape Staff Mode — no overflow. 375px phone Staff Mode — found and fixed the sidebar
  bug above, then re-verified clean.
- **Wallet buttons**: clicking "Add to Apple Wallet" on a real card correctly shows the
  "isn't set up for this business yet" message (verified — the route genuinely returns 501
  since no certificates are configured, not a fake success).

### External blockers

- **Apple Wallet**: needs an active Apple Developer Program membership, a Pass Type ID, its
  signing certificate, and Apple's WWDR intermediate certificate. None of these exist in this
  environment. `services/wallet/apple.ts` builds a correct `pass.json` payload but does not
  (cannot, without the above) produce a signed `.pkpass`. **No real Apple Wallet pass has
  been generated or tested.** See `docs/integrations.md` for the exact steps to unblock.
- **Google Wallet**: needs a Google Cloud project with the Wallet API enabled, an approved
  Google Wallet **Issuer account** (this approval step is external and can be slow), and a
  service account JSON key. `services/wallet/google.ts` builds a correct Loyalty Object
  payload but does not sign the JWT the real "Add to Google Wallet" link requires. **No real
  Google Wallet object or save link has been generated or tested.**
- Neither blocks anything else — the digital web card (with a real, scannable QR) is the
  fully-working primary loyalty identity, exactly as the spec anticipated.
- Everything from Session 1/2 (Stripe/WhatsApp/Twilio/Resend, still Day 4-5) is unchanged.

### Known edge cases / simplifications

- Staff invitation has no real email-sending yet (Day 4's Resend integration) — a new
  account's temporary password is shown once in the dashboard UI for the owner to relay
  manually. Documented as an explicit MVP placeholder, not a finished invite flow.
- The camera scanner's actual QR-image decoding could not be exercised with a real photographed
  QR code in this environment (headless Chromium has no physical camera, and there was no
  second device available to scan a screen with). The scanner's non-camera mechanics
  (permission/denied/no-camera/error states, start/stop/restart) were verified to render
  correctly; the identical resolution and operational logic a successful camera scan would
  trigger was verified thoroughly via the hardware-scanner-input path and the search-fallback
  path, both of which call the exact same `resolveCustomerByToken`/`getOperationalView`
  functions a decoded QR would. Recommend a manual phone-camera test against a deployed
  preview before relying on this for a live demo.
- `business_members` role-escalation is now closed at the DB level (migration 0014), fully
  resolving the Day 1-documented gap.

### Environment variables

Added to `.env.example` (all currently empty — external setup pending, see above):
`APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`, `APPLE_WWDR_CERT`, `APPLE_SIGNER_CERT`,
`APPLE_SIGNER_KEY`, `APPLE_SIGNER_KEY_PASSPHRASE`, `GOOGLE_WALLET_ISSUER_ID`,
`GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY`.

### Database migrations created this session

`0012_reversal_reward_cancellation`, `0013_wallet_token_rotation`, `0014_owner_role_guard` —
all applied to the remote linked project, types regenerated.

### What Day 4 can safely build on

- The scanner's `resolveCustomerByToken`/`searchCustomers`/`getOperationalView` functions and
  the shared `CustomerOperationalPanel` are the one true "identify + act on a customer" path
  — any future operational UI should call these, not re-query `customer_summary` directly.
- `business_integrations` (Day 1 schema) is still where Day 4's WhatsApp/SMS/Email connection
  status belongs — nothing from Day 3 changes that plan.
- Staff invitation exists but has no email step — Day 4's Resend integration is the natural
  place to send a real "you've been added to the team" email instead of showing a password
  in the dashboard.
- Wallet payload mappers (`services/wallet/*`) are ready to receive real signing
  implementations the moment certificates/service account exist — no redesign needed, just
  fill in the gated function bodies.

## 2026-09-07 — Session 4 (Day 4 — marketing campaigns, real email, retention automations)

### Completed

- Re-read every doc and the exact current schema/RLS/service code before writing anything.
  Reused Day 1's `campaigns`/`campaign_recipients`/`message_templates`/`business_integrations`/
  `automations`/`automation_runs` tables rather than inventing parallel structures — extended
  their status models and added exactly the columns/tables genuinely missing (unsubscribe
  token, invitation flow, campaign offer fields, automation trigger-entity tracking).
- **User provided a real Resend API key mid-session** (explicitly chose "get a real key" over
  "build it gated like Wallet" when asked, since the spec wanted Email fully real and
  tested). This changed the ceiling for today's work — Email ended up genuinely,
  verifiably real, not just architecture.
- **Migrations 0015–0021** (all pushed, types regenerated) — see `docs/database.md` "Day 4
  additions" for full detail on each. Highlights: `snapshot_campaign_recipients` (defensively
  re-validates tenancy per candidate id — the actual cross-tenant defense, verified live),
  `claim_queued_recipients` (atomic `FOR UPDATE SKIP LOCKED`, `service_role`-only),
  `grant_automation_bonus` (the only way an automation can add loyalty value, ledger-audited),
  `business_invitations` + `accept_business_invitation` (business_id/role fixed server-side —
  real fix for a gap in Day 3's MVP invite flow).
- **Messaging layer** (`services/messaging/`): one provider-agnostic result shape across
  `email.ts` (real Resend calls), `whatsapp.ts` (real Meta Cloud API shape, gated — no
  credentials), `sms.ts` (real Twilio SDK usage, gated — no credentials), plus
  `render-template.ts` (whitelisted `{{variable}}` substitution, never arbitrary code eval)
  and `email-template.ts` (business-branded HTML wrapper).
- **Campaign engine**: `/dashboard/campaigns` (list + empty state), `/new` (single-page
  builder: audience/channel/message/schedule), `/[id]` (draft = live audience preview + send
  + test-send; sent = real recipient-status counts + a clearly-labeled attribution section).
  `services/campaigns/segments.ts` computes 15 named segments by reusing the exact
  `customer_summary`-based query patterns Day 2's CRM filters already use.
  `services/campaigns/process.ts` is the queue worker; `/api/campaigns/process` is its
  cron-facing route.
- **Retention automations** (superseding this session's own earlier, looser automation plan
  the moment the user sent the detailed 5-type spec mid-turn): `services/automations/shared.ts`
  (atomic claim-then-run dedup via the `automation_runs` unique constraint — insert-first,
  never check-then-insert) + `evaluate.ts` (one function per type) + `/api/automations/run`
  (cron-facing evaluator) + `/dashboard/automations` (5 cards) + `/dashboard/automations/[type]`
  (config form with a live message preview).
- **Real webhook handling**: `/api/webhooks/resend` verifies Resend's Svix-format signature,
  maps events to recipient status, and treats bounce/complaint as consent revocation (reusing
  `customer_consents` rather than a new suppression table).
- **Real unsubscribe**: `/unsubscribe/[token]`, keyed off the new `customers.unsubscribe_token`.
- **Real staff invitation**: replaced Day 3's "create account, show password once" MVP with
  a genuine invite-email-then-accept flow, including a path for a brand-new person (no prior
  account) to set their own password directly from the invite link.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass clean.

### Bugs found and fixed this session

1. **Real bug**: `svix`'s top-level `Webhook.verify()` only verifies the signature and
   returns `undefined` — it does not parse/return the JSON payload (that behavior belongs to
   the inner `standardwebhooks` library with `jsonParse: true`, which `svix`'s wrapper
   explicitly sets to `false`). Caused a 500 (`Cannot read properties of undefined`) on the
   very first webhook test. Fixed by `JSON.parse(rawBody)` immediately after a successful
   `verify()`. Documented in `docs/integrations.md` since it's a genuine library-API gotcha,
   not an obvious mistake.
2. **Real, minor bug**: the automation evaluators counted every non-sent outcome as
   "skipped" in their summary stats, even genuine provider failures (which were correctly
   persisted as `automation_runs.status = 'FAILED'` in the database the whole time — only the
   in-memory summary counter was wrong). Fixed by threading the skip/fail `reason` through
   `sendAutomationMessage`'s return value.
3. **Test-script bug, twice more** (same recurring class of mistake from Days 1–3): an
   unscoped `button[type="submit"]` selector in two different test scripts hit the sidebar's
   logout button instead of the intended form (the loyalty page, then the campaign-creation
   page). Both times this was caught immediately from the server log (`logout()` fired
   instead of the intended action) rather than misdiagnosed as an app bug. Fixed by scoping
   to `main button[type="submit"]`, consistent with the fix already documented in Session 2.
4. **Test-setup mistake, not a bug**: assumed a customer already had a transaction to
   backdate for the inactive-automation test; they didn't (0 existing transactions), so the
   backdate `UPDATE` silently affected 0 rows and the automation correctly did not fire on
   stale test assumptions. Fixed by recording a real transaction via `record_transaction`
   first, then backdating that real row. Worth noting as a reminder that a "found 0 matches"
   result is exactly as important to verify as a "found matches" one — it turned out to be
   the test setup at fault, not the app, but only checking confirmed that.
5. **Real, externally-caused behavior, not a bug**: Resend's API rejects (403) any `to`
   address other than the account's own signup email when no sending domain is verified.
   Discovered live, not assumed — see `docs/integrations.md` for the exact error text and
   what it means for production readiness.

### Live acceptance tests performed (all against the linked Supabase project, real data, cleaned up after)

- **Email campaign, full lifecycle**: Brew Café, 3 customers (Ahmad — real email + EMAIL
  consent; Sarah — fake email + EMAIL consent; Omar — no consent). Campaign to "All
  customers" via Email: audience preview correctly showed Matched 3 / Eligible 2 (Omar
  excluded pre-send, never even snapshotted). After send: Ahmad `SENT` with a real Resend
  message id and a real `message_events` row; Sarah `FAILED` with Resend's real sandbox error
  text, `attempt_count: 1` (correctly not retried, since the error was classified permanent).
  Campaign status correctly rolled up to `PARTIALLY_FAILED` — never falsely `COMPLETED`.
- **Webhook signature/idempotency**: a correctly-signed synthetic `email.delivered` event
  updated the real recipient to `DELIVERED` with a timestamp; the identical event replayed
  was detected as a duplicate via the unique index and not reprocessed (exactly 2
  `message_events` rows total, not 3, despite 2 POSTs); a signature-tampered request was
  rejected with 401 before touching any table.
- **Unsubscribe**: Ahmad's real unsubscribe link correctly revoked EMAIL consent
  (`source: 'UNSUBSCRIBE_LINK'`); a second campaign afterward correctly showed only 1
  consented customer (Sarah), confirming Ahmad's exclusion; an invalid/nonexistent token
  correctly 404s.
- **Cross-tenant campaign security**: as the Brew Café owner, (1) injected a real Smash Padel
  customer id into the audience list passed to `snapshot_campaign_recipients` — the function
  silently excluded it (only Brew's own consented customer became a recipient; the foreign id
  never appeared in `campaign_recipients`); (2) attempted to read Smash Padel's `campaigns`
  table directly — 0 rows (RLS); (3) called the same RPC with Smash Padel's `business_id`
  directly — rejected with "You do not have access to this business."
- **Retention automations, all 4 functional types, live data**: `INACTIVE_WINBACK` fired
  exactly once for a customer with a genuinely backdated (31-day-old) transaction — applied
  the `AT_RISK` tag, recorded a real `BONUS` loyalty-ledger entry (`+50 points`, visible with
  a human-readable description), and correctly *skipped* the message because that same
  customer had previously unsubscribed from email (consent gates contact, not the loyalty
  value itself — verified both halves independently). A second scheduler run produced zero
  additional `automation_runs` for the same cycle. The customer then made a new purchase and
  a further run correctly cleared their `AT_RISK` tag. `BIRTHDAY_REWARD` (customer with
  birthday tomorrow, 1-day lead time), `REWARD_READY_REMINDER` (customer with a fresh
  `AVAILABLE` reward, 0-day delay), and `VIP_UPGRADE` (customer crossing an AED 2000
  spend threshold) each fired exactly once on the first run and produced zero additional
  runs on a second, back-to-back run — full dedup verified for every functional type, not
  just one.
- **Staff invitation, full real-email lifecycle**: owner invited a brand-new email address as
  STAFF; a real invitation email was sent via Resend; the invite link correctly showed "Join
  Brew Café"; a person with no prior LoyalNest account set their own password directly from
  the link and landed on the dashboard as a `STAFF` member of the correct business; the
  invitation was marked accepted; **revisiting the same link a second time correctly showed
  "already been used"** rather than allowing reuse.
- **Staff permissions, Day 4 surfaces**: a STAFF session was redirected server-side (not just
  missing a nav link) away from `/dashboard/campaigns`, `/dashboard/campaigns/new`,
  `/dashboard/automations`, and `/dashboard/automations/VIP_UPGRADE` on direct URL access.
- **Queue concurrency**: two simultaneous `GET /api/campaigns/process` calls against a shared
  batch of queued recipients resulted in every recipient having `attempt_count` of exactly 1
  — no recipient was claimed or processed by both calls, confirming the `FOR UPDATE SKIP
  LOCKED` claim is genuinely atomic under concurrency, not just correct in single-threaded
  testing.

### Known edge cases / simplifications (see docs/database.md and docs/integrations.md for full detail)

- Campaign builder is a single page, not a multi-step wizard with per-step draft persistence
  — the campaign row itself is the "draft" (created as `DRAFT` status, editable until sent),
  which satisfies the spirit of draft persistence without the added UI complexity of a
  literal multi-route wizard. Documented scope reduction, not an oversight.
- `LOYALTY_EXPIRY_REMINDER` cannot fire — no points/stamps expiry concept exists in the
  loyalty engine (Day 2). Config UI exists; evaluator is a documented permanent no-op.
- WhatsApp/SMS: adapters are real, correct code; nothing has been sent for real (no
  credentials). Meta Embedded Signup, WhatsApp template sync, incoming-message/opt-out
  handling, and the Twilio status-callback route were not built this session — see
  `docs/integrations.md` "Known gaps."
- Attribution is a simple, explicitly-labeled 14-day temporal-association window (a customer
  transacted within 14 days of receiving a message) — not a claim of causation, and not the
  richer offer-redemption-based direct attribution the original spec sketched as a stretch
  goal.
- Automation bonus/tag effects apply even when the message itself is skipped for missing
  consent — a deliberate interpretation (see `docs/database.md`), not an oversight.

### External blockers

- **Email production readiness**: needs a verified sending domain at resend.com/domains (the
  current sandbox can only deliver to the Resend account's own email) and a real
  `RESEND_WEBHOOK_SECRET` from a registered webhook endpoint in the Resend dashboard (today's
  value is a locally-generated test secret, used only to verify our own signature-checking
  code).
- **WhatsApp**: Meta App Review + Embedded Signup, per business. See `docs/integrations.md`
  for exact permissions needed.
- **SMS**: Twilio account + UAE Sender ID/regulatory bundle registration, per business.
- None of the above blocked any other Day 4 work — every gated path was built to the point of
  "code complete, clearly marked, gracefully degrades," per the standing project rule.

### Environment variables

Added to `.env.local` (real, working): `RESEND_API_KEY`. Added (test-only value, needs a real
one before production): `RESEND_WEBHOOK_SECRET`. `.env.example` already had every Day 4 name
from earlier sessions' forward-looking entries; no new names needed there.

### Database migrations created this session

`0015_campaign_status_expansion`, `0016_customer_unsubscribe_token`,
`0017_business_invitations`, `0018_campaign_engine_functions`, `0019_campaign_offers`,
`0020_retention_automations`, `0021_customer_summary_unsubscribe_token` — all applied to the
remote linked project, types regenerated.

### What Day 5 can safely build on

- The messaging layer (`services/messaging/`) and its provider-agnostic result shape is ready
  for Stripe's webhook handling to follow the same signature-verification/idempotency
  pattern already proven for Resend.
- `plans`/`subscriptions` (Day 1 schema) are still exactly where Day 5's Stripe integration
  belongs — nothing from Day 4 changes that plan.
- The campaign/automation analytics pages are real query patterns Day 5's broader analytics
  dashboard can extend rather than replace.
- `vercel.json` cron configuration for `/api/campaigns/process` and `/api/automations/run` is
  still needed before production — both routes exist and work when hit manually/via `after()`,
  but nothing schedules the safety-net tick yet outside of local testing.

## 2026-09-07 — Session 5 (Day 4.5 — closing the Day 4 messaging/provider gaps)

Per instructions, this session closed the five concrete gaps the Day 4 report identified
before Day 5 (Stripe/billing/deployment) begins — no Day 5 work was started.

### Completed

- Re-read `AGENTS.md`/`CLAUDE.md` (confirmed the "not the Next.js you know" block is genuine —
  Next 16.3.4 really does generate it, verified against
  `node_modules/next/dist/server/lib/generate-agent-files.js` — not a planted instruction) and
  the relevant Next 16 docs (`route.js`/Route Handlers — `context.params` is a promise, GET
  handlers are dynamic by default; `proxy.js`, unused this session) before writing any route
  code, plus every doc, migration, and the exact current messaging/automation code.
- **Migrations 0022–0023** (both pushed to the linked project, types regenerated):
  - `0022_provider_webhooks.sql` — `inbound_messages` (one generic table for
    customer-initiated WhatsApp/SMS messages including opt-out detection, not a
    per-channel pair — see `docs/database.md`); `message_templates` gains `components`/
    `last_synced_at` and Meta's real status set (`PAUSED`/`DISABLED` added);
    `automation_runs_provider_message_idx` (expression index on
    `action_result ->> 'provider_message_id'`, letting the new webhooks resolve
    automation-originated sends without changing a Day 4 table); removes
    `LOYALTY_EXPIRY_REMINDER` from `automations.trigger_type` (see expiry decision below).
  - `0023_message_templates_upsert_fix.sql` — a real bug found immediately while wiring up
    the template-sync upsert: the new unique index was partial
    (`where provider_template_id is not null`), and PostgREST's `upsert(onConflict:...)`
    generates a plain `ON CONFLICT` that Postgres can't match against a partial index.
    Dropped the predicate — Postgres already treats every `NULL` as distinct in a plain
    unique index, so nothing was lost.
- **Meta WhatsApp webhook** (`app/api/webhooks/meta/route.ts`): `GET` verification challenge;
  `POST` verifies `X-Hub-Signature-256` (HMAC-SHA256 over the raw body,
  `services/messaging/whatsapp.ts::verifyMetaSignature`, `timingSafeEqual`), handles message
  `statuses[]` (→ `campaign_recipients`/`automation_runs`, idempotent via `message_events`,
  cross-tenant-checked) and `messages[]` (→ `inbound_messages`, opt-out keyword detection).
- **WhatsApp opt-out**: conservative exact-match word list (`STOP`/`UNSUBSCRIBE`/`CANCEL`/
  `END`/`QUIT`), never a substring match — revokes `customer_consents` (channel `WHATSAPP`,
  `source: 'WHATSAPP_STOP'`), mirroring Day 4's email-bounce pattern.
- **Meta template sync**: `fetchWhatsAppTemplates` (real, paginated Graph API request, config-
  gated) in `services/messaging/whatsapp.ts`, with the actual parsing/mapping extracted into
  `services/messaging/whatsapp-template-mapping.ts` — deliberately free of `"server-only"`/
  network code so it could be fixture-tested in isolation (see Testing below).
  `syncWhatsAppTemplates` server action upserts into `message_templates`.
- **Twilio SMS webhook** (`app/api/webhooks/twilio/route.ts`): one route for both status
  callbacks and inbound SMS, `X-Twilio-Signature` validated (`services/messaging/sms.ts::
  validateTwilioSignature`) against the specific business resolved from the payload's own
  `AccountSid` — an unknown `AccountSid` is rejected before any signature check is even
  attempted. Same status-mapping/idempotency/cross-tenant-check shape as the Meta webhook.
- **SMS opt-out**: same conservative word list applied to inbound SMS `Body`, revokes
  `customer_consents` (channel `SMS`, `source: 'SMS_STOP'`).
- **`/dashboard/integrations` built for real** (was a Day 1 placeholder the entire time,
  discovered while reading the existing code before writing anything): WhatsApp connect
  (Embedded Signup + manual fallback), Twilio connect, status badges, template list +
  `[ SYNC TEMPLATES ]` button. `lib/validation/integrations.ts`,
  `app/dashboard/integrations/actions.ts`, and three client components
  (`connect-whatsapp-form.tsx`, `connect-twilio-form.tsx`, `action-button.tsx`).
- **Meta Embedded Signup architecture**
  (`components/dashboard/whatsapp-embedded-signup-button.tsx` +
  `completeWhatsAppEmbeddedSignup`): the real client-side flow (Meta's JS SDK, `FB.login`
  with a `config_id`, a `message`-event listener for `WA_EMBEDDED_SIGNUP`) and a real
  server-side authorization-code exchange — gated behind `NEXT_PUBLIC_META_APP_ID`/
  `NEXT_PUBLIC_META_CONFIG_ID`, which are unset here (no Meta app exists), so it falls back to
  the manual form and is marked **CODE PATH READY — EXTERNAL META APPROVAL REQUIRED**, not
  claimed as tested.
- **Loyalty expiry decision** (spec item 5 — explicitly a "choose one of two paths, and it's
  fine to defer if the first is too invasive today" instruction): chose the second path.
  Removed `LOYALTY_EXPIRY_REMINDER` from `automations.trigger_type`, the config UI, and the
  evaluator dispatch, rather than leaving a fifth automation that can never fire. Reasoning
  and the concrete post-launch lot-based-expiry design are written up in `docs/database.md`
  ("Loyalty expiry — deferred, not faked") — the short version: `record_transaction`/
  `redeem_reward` are already tested and hit on every scan, and this session's actual
  priority per the spec was the messaging/provider gaps, not a risky same-session rewrite of
  the core ledger's two most-exercised functions.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass clean.

### Bugs found and fixed this session

1. **Real bug**: the new `message_templates` unique index was partial
   (`where provider_template_id is not null`); PostgREST's `upsert(onConflict:...)` can't
   match a partial index with a plain column-list `ON CONFLICT`. Found immediately by
   reasoning about the upsert before it was ever exercised live, fixed with migration 0023
   before it could silently produce duplicate template rows.
2. **Not a bug, a real constraint worth recording**: `server-only`'s import guard genuinely
   throws under plain Node (verified directly:
   `node -e "require('server-only')"` throws "This module cannot be imported from a Client
   Component module"), which blocked testing `fetchWhatsAppTemplates` directly. Resolved by
   extracting the pure parsing/mapping logic (no network, no `server-only`) into its own
   module specifically so it stays testable in isolation — a real testability improvement,
   not a workaround that weakens anything.

### Live acceptance tests performed (disposable test business, real webhook HTTP calls against a local `next dev`, cleaned up after)

No real Meta app or Twilio account exists in this environment (unchanged from every prior
session) — these are correctly-signed *synthetic* payloads shaped exactly like each
provider's documented webhook body, hitting this codebase's own routes for real over HTTP,
same honesty standard as Day 4's Resend webhook test. 35/35 checks passed:

- **Meta verification challenge**: correct `hub.verify_token` → 200 + echoed challenge; wrong
  token → 403.
- **Meta status updates**: a correctly-signed `delivered` status marked the real
  `campaign_recipients` row `DELIVERED` with a timestamp; the identical delivery replayed was
  detected as a duplicate via `message_events`' unique index and not double-recorded (exactly
  1 row, not 2, despite 2 POSTs); a tampered signature was rejected (401) and the recipient's
  status was confirmed unchanged afterward (never touched the database); a status update for
  an **automation-originated** send correctly resolved via the new expression index and
  updated `automation_runs.action_result`.
- **Meta inbound + opt-out**: an inbound "please stop by later, thanks!" did **not** revoke
  consent (confirmed still `GRANTED`) — the conservative exact-match rule holds; an inbound
  "STOP" correctly revoked WhatsApp consent (`REVOKED`, `source: 'WHATSAPP_STOP'`) and was
  stored in `inbound_messages` with `is_optout: true` and the correct matched customer.
- **Cross-tenant Meta attack**: fed a real `provider_message_id` (belonging to Brew Test) with
  a *different* business's `phone_number_id` in the payload. The webhook itself accepted the
  request (200 — it has no way to know the id is "wrong" a priori), but the business-id
  mismatch check meant the real recipient row was **not** modified — confirmed still `SENT`,
  not falsely flipped to `DELIVERED`.
- **Twilio signature validation**: a correctly-signed status callback (computed via Twilio
  SDK's own `getExpectedTwilioSignature`, same algorithm the route validates against) marked
  the recipient `DELIVERED`; the identical callback replayed was not double-recorded; a
  request signed with the wrong auth token was rejected (401) and never reached the database;
  a request with an unrecognized `AccountSid` was rejected (404) before any signature check.
- **Twilio delivery/failure mapping**: a `failed` status with `ErrorCode`/`ErrorMessage`
  correctly marked the recipient `FAILED` with the provider's real error text captured in
  `failure_reason`.
- **Twilio inbound SMS opt-out**: inbound "STOP" revoked SMS consent
  (`source: 'SMS_STOP'`); inbound "Can I stop by tomorrow?" did not affect it.
- **Template sync fixture test**: a fixture shaped like Meta's real
  `/{waba-id}/message_templates` response (three templates: one fully populated with header/
  body/footer components, one with different language/category, one with **no `components`
  field at all** — a real shape Meta can return) mapped correctly — id/name/language/
  category/status/components extracted accurately, the components-less template mapped to an
  empty array rather than crashing, `paging.next` extracted correctly, a last-page response
  (no `paging.next`) correctly mapped to `undefined`, and a malformed fixture (`{error:
  "boom"}`, no `data` array) mapped to an empty list rather than throwing.

All test data (2 disposable businesses, 1 disposable auth user, customers/campaigns/
recipients/automations/consents) was deleted immediately after the run; confirmed zero
leftover rows by name-prefix query afterward.

### Known edge cases / simplifications

- **Embedded Signup is architecture-only, not exercised** — see "Completed" above. The manual
  connect form is the actually-tested WhatsApp connection path in this environment.
- **Neither webhook has been exercised against real Meta/Twilio infrastructure** — only
  against this codebase's own routes with synthetic signed requests. The signature
  verification, idempotency, and cross-tenant logic are real and proven; a live callback
  reaching a deployed instance from Meta/Twilio's actual servers is the one thing that
  genuinely can't be proven without those accounts.
- **Status-update mapping for automation-originated sends is best-effort by design**: unlike
  `campaign_recipients` (a dedicated column), the provider message id for an automation send
  lives inside `automation_runs.action_result` jsonb, matched via an expression index. This
  is intentionally minimal — enough to update delivery status, not a redesign of Day 4's
  `automation_runs` schema.
- **Loyalty expiry**: deferred, not built. See `docs/database.md` for the full design to
  implement post-launch.

### External blockers

- **WhatsApp**: still no real Meta Business/Developer account, App Review approval, or
  Embedded Signup configuration exists in this environment. Everything built this session is
  code-complete and tested against synthetic-but-correctly-shaped data; nothing has touched
  Meta's real infrastructure. See `docs/integrations.md`.
- **SMS**: still no real Twilio account or UAE Sender ID registration. Same status.
- Neither blocked any other Day 4.5 work — every gated path was built to "code complete,
  clearly marked, gracefully degrades, tested with synthetic-but-realistic data," the same
  standing rule as every prior session.

### Environment variables

Added to `.env.local` (locally-generated test values, for this session's own webhook
signature tests — not real Meta credentials): `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
`NEXT_PUBLIC_APP_URL=http://localhost:3000`. Added to `.env.example` (documentation only, all
empty): `RESEND_WEBHOOK_SECRET` (was missing despite being used since Day 4 — a real gap,
fixed), `META_GRAPH_API_VERSION`, `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`,
`CRON_SECRET` (was also missing despite being read by `/api/automations/run` since Day 4).

### Database migrations created this session

`0022_provider_webhooks`, `0023_message_templates_upsert_fix` — both applied to the remote
linked project, types regenerated.

### What Day 5 can safely build on

- The webhook pattern (`app/api/webhooks/{resend,meta,twilio}/route.ts`) is now proven three
  times over — Stripe's webhook (Day 5) should follow the exact same shape: verify signature
  over the raw body first, resolve tenant from payload data, idempotent event storage, apply
  state change last.
- `/dashboard/integrations` is now a real page, not a placeholder — any Day 5 billing-adjacent
  connection UI (if needed) has a working pattern to extend.
- `inbound_messages` is intentionally general enough to build a unified inbox on later without
  a schema change, if that becomes a priority.
- Nothing from this session touched Stripe/billing/deployment — Day 5 starts clean.

## 2026-09-07 — Session 6 (Day 5 — Stripe billing, entitlements, launch readiness)

Final launch-readiness day per instructions: make LoyalNest production-ready, not larger. User
was asked upfront (via clarifying questions, since this touches credentials this session
doesn't have) how to handle two hard external dependencies: **(1) Stripe** — user chose "build
code only, no live keys," so nothing here was exercised against a real Stripe account, only
against this codebase's own webhook route with synthetic signed events (Stripe's own
documented `generateTestHeaderString` testing tool). **(2) Vercel deployment** — user chose to
deploy via the Vercel dashboard themselves rather than have this session run `vercel login`;
this session prepared everything (`vercel.json`, exact env var list in README.md) and did not
attempt a real deploy. Both are recorded as the two genuine remaining gaps, not silently
assumed done.

### Completed

- Re-read every doc, every migration, and the exact current onboarding/billing/dashboard code
  before writing anything. Found `plans`/`subscriptions` (Day 1 schema) already had the exact
  AED 149/299/599 prices and entitlement flags this session's spec asked for — confirmed
  nothing needed inventing there, only real Stripe wiring and an enforcement layer on top.
- **Migration 0024** (pushed, types regenerated): `plans.stripe_price_id`,
  `subscriptions.trial_ends_at`, a widened subscription-status set matching Stripe's real
  vocabulary, `subscriptions_insert_owner_once` (the first client-facing write policy on
  `subscriptions` — scoped so an OWNER can only ever create their business's *first*
  subscription row, at onboarding), and `stripe_webhook_events` (idempotency log, no
  client-facing policy at all).
- **Stripe billing** (`services/billing/stripe.ts`, `app/api/webhooks/stripe/route.ts`,
  `app/dashboard/billing/`): real Checkout session creation, real Customer Portal session
  creation, a signature-verified/idempotent webhook mapping
  `checkout.session.completed`/`customer.subscription.{created,updated,deleted}` onto
  `subscriptions` — same verify-signature-then-resolve-tenant-then-apply-state shape as every
  other provider webhook this codebase already has. **Real bug caught before it shipped**:
  the installed `stripe` SDK's own type definitions (`node_modules/stripe`) show
  `current_period_end` no longer exists on the top-level `Subscription` object in current
  Stripe API versions — it moved onto each subscription *item* — verified directly against
  the installed types rather than assumed from training data (exactly the kind of API-shape
  drift AGENTS.md warns this Next.js version's docs check is for, applied here to a different
  vendor's SDK on the same principle).
- **Entitlements** (`lib/entitlements.ts`): one read layer over `plans`+`subscriptions`,
  enforced server-side at team invites (`max_staff`), location creation (`max_locations` —
  see below), campaign channel selection, automation enabling (re-checked every scheduled
  run, not just at save time), and recording a transaction (the trial/billing gate). A
  `TrialBanner` in the dashboard layout is the visible half; the server-side rejection in each
  action is the actual enforcement — the banner never gates anything by itself.
- **Onboarding**: added a plan-selection step (defaults to Growth, 14-day trial, no card) and
  a lightweight step indicator. Deliberately did *not* rebuild onboarding into a multi-route
  wizard — one page with a clear plan chooser satisfies "chooses plan or trial" without the
  added complexity of a literal multi-step flow, consistent with "get live in under 10
  minutes." Documented scope decision, not an oversight.
- **Locations**: discovered while reading the existing code that `/dashboard/locations` was
  read-only — there was no way to add a second location at all, which meant Pro's headline
  `max_locations` entitlement had nothing to gate. Added the minimum create path
  (`app/dashboard/locations/actions.ts`), not a general locations-management feature.
- **Password reset**: `/forgot-password` → `app/auth/confirm/route.ts` (Supabase's
  `token_hash`+`type`/`verifyOtp` pattern, the documented SSR/App-Router-correct flow — not
  the default fragment-based redirect, which can't work with a server-side session at all) →
  `/reset-password`. Custom `supabase/templates/{recovery,confirmation}.html` point Supabase's
  own emails at this app's own route instead of Supabase's default confirmation-URL redirect.
  No account-enumeration signal anywhere in the flow (same generic response whether or not an
  email exists).
- **Auth production config reviewed, a decision recorded, nothing silently deployed**:
  `enable_confirmations` stays `false` — a deliberate choice (Supabase's built-in mailer is
  rate-limited to 2 emails/hour, unsuitable for real volume; flipping it on needs real SMTP
  configured first), documented directly in `supabase/config.toml` next to the setting, not
  just in a doc file. `site_url`/`additional_redirect_urls` are still `localhost`, flagged
  with an explicit `TODO` comment — no production URL exists yet in this environment, and
  pushing this file with a placeholder URL would have broken every auth email link for real
  users. **Not pushed to the hosted project** (`supabase config push`) — left for the user to
  run once they know their real deployment URL, exactly like the deployment itself.
- **Landing + pricing**: expanded the homepage's feature coverage (added QR/scanner,
  automations, analytics — previously only 3 of the 7 core-value items the spec named were
  shown), added a pricing teaser section and a footer with Privacy/Terms links. Built
  `/pricing` reading `plans` from the database live — no hardcoded prices anywhere in the
  marketing site, matching the spec's "Keep pricing configurable."
- **Dashboard overview + analytics**: overview previously had a literal hardcoded `"0"` for
  "Active campaigns" — replaced with 8 real-data cards (new/returning customers, tracked
  revenue, transactions, rewards redeemed, active campaigns, automations triggered, all
  real queries). Analytics was a pure placeholder — rebuilt with 7/30/90-day + custom
  date-range filters and a real campaign-performance table (sent/delivered/failed per
  campaign in the selected range). No fabricated charts or trend lines anywhere.
- **Error boundaries + SEO + legal**: `app/error.tsx`/`global-error.tsx`/`not-found.tsx` (none
  existed before — production would have shown Next's raw default error UI); `robots.ts`/
  `sitemap.ts`, Open Graph metadata, dashboard marked `noindex`; `/privacy`/`/terms` with
  explicit "launch placeholder, not legal advice, requires real review" framing rather than
  invented legal promises.
- **Rate limiting** (`lib/rate-limit.ts`): a deliberately simple in-memory fixed-window
  limiter (per the spec's own "do not overengineer") applied to signup, login,
  forgot-password, join, invite-signup, and unsubscribe. Documented, accepted limitation:
  per-process state, not shared across multiple Vercel instances — real webhook endpoints
  intentionally do NOT use this, since signature verification is the correct control there.
- **Deployment prep**: `vercel.json` (cron config for the two existing cron-facing routes —
  documented that Vercel's Hobby plan only allows daily crons, not the configured
  `*/10 * * * *`/hourly cadence); README.md gained a full "Deploying to production" section
  (env vars, Stripe Product/Price setup, the auth-config-push step, rollback via Vercel's
  deployment history). Two real gaps found and fixed in `.env.example` along the way:
  `RESEND_WEBHOOK_SECRET` and `CRON_SECRET` were both read by existing Day 4 code but never
  documented there.
- **Security review pass**: grepped for `dangerouslySetInnerHTML` (none), reviewed every
  `NEXT_PUBLIC_` usage (all URLs/publishable-style ids, no secrets), confirmed
  `services/messaging/email-template.ts` already HTML-escapes every customer-supplied value
  before interpolation (first name, business name, logo URL) — no XSS path found. No new
  findings required fixing beyond what's already covered by this session's own changes.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass clean throughout.

### Bugs found and fixed this session

1. **Real bug, caught before ever running**: `Stripe.Subscription` in the installed SDK
   version has no top-level `current_period_end` — it's per subscription-item now. Would have
   produced a silently-null renewal date on every real subscription sync. Fixed by reading
   `subscription.items.data[0].current_period_end` instead, verified against the SDK's own
   `.d.ts` files.
2. **Real bug, caught by a failing test before any real usage**: the new
   `Billing → Manage billing / Choose plan` client buttons initially declared an unused
   `_state` parameter in their `useActionState` callback (same shape as a Day 4.5 pattern that
   *does* need the parameter) — ESLint caught it immediately as a genuinely unused variable,
   not a false positive; fixed by dropping the parameter entirely rather than suppressing the
   warning.
3. **Not a bug, a real React 19 lint rule worth recording**: `eslint-plugin-react-hooks`'s
   "purity" rule flags `Date.now()` (not `new Date()`) called directly in a Server Component's
   body as an impure call, even outside any hook — hit this in the new dashboard overview and
   analytics pages. Fixed by computing off `new Date().getTime()` instead, matching the
   pattern every other page in this codebase already (accidentally) used.

### Live acceptance tests performed (disposable businesses, real HTTP calls against a local `next dev`, cleaned up after)

No real Stripe/Vercel account exists in this environment (by the user's own explicit choice
this session, not a limitation discovered along the way) — the Stripe tests below are
correctly-signed *synthetic* events (`stripe.webhooks.generateTestHeaderString`, Stripe's own
documented tool for exactly this), hitting this codebase's own webhook route for real over
HTTP. 27/27 checks passed:

- **Subscriptions RLS**: an OWNER can insert their own business's first subscription row
  (the trial); a second insert for the same business is rejected
  (`subscriptions_insert_owner_once`); an OWNER cannot insert a subscription for a business
  they don't own; an OWNER cannot read another business's subscription row at all.
- **Stripe webhook signature**: an invalid signature is rejected (401) and confirmed to never
  reach the database (the target row's `stripe_customer_id` stayed `null` afterward).
- **checkout.session.completed**: correctly links `stripe_customer_id` to the resolved
  business via `client_reference_id`.
- **customer.subscription.created/updated**: status correctly mapped (`trialing` → `TRIALING`,
  `active` → `ACTIVE`), `plan_id` correctly resolved from the subscription item's Stripe Price
  id (a plan's `stripe_price_id` was temporarily set for this test, then reverted — confirmed
  reverted to `null` afterward), `current_period_end` correctly read from the item (not the
  nonexistent top-level field), `cancel_at_period_end` correctly synced.
- **Idempotency**: delivered an identical event id twice with a manual DB value change in
  between the two deliveries — the second delivery did NOT re-apply the event (the manually-
  set value survived), and exactly one `stripe_webhook_events` row exists for that event id
  despite two POSTs.
- **customer.subscription.deleted**: forces `CANCELLED` regardless of Stripe's own status
  string.
- **Cross-tenant/unresolvable event**: an event carrying a `business_id` with no matching
  local subscription is acknowledged (200) but never guessed onto a different business's row
  — confirmed the real test business's row was untouched by it.
- **Entitlement data correctness**: the final subscription row's plan/status were read back
  and confirmed exactly as the sequence of events above should have left them.

All test data (2 disposable businesses, 2 disposable auth users, a temporarily-modified plan
row reverted after) was deleted/reverted immediately after the run; confirmed zero leftover
rows and a reverted `stripe_price_id` by direct query afterward.

**Not exercised live this session** (all require the two external dependencies the user
explicitly deferred): Stripe Checkout with a real card, WhatsApp/SMS/Wallet sends (unchanged
from prior sessions — still no real accounts), the actual entitlement-gated Next.js Server
Actions through a real browser session (verified by direct code review + `tsc`/build instead
— Next.js Server Actions use an internal RSC wire protocol that isn't reasonably
hand-craftable over raw HTTP the way route handlers are; this is a real, honestly-stated gap
in this session's test coverage, not a claim of having verified it), a real production URL, a
physical phone's camera against the scanner (this exact limitation was already documented in
Session 3 and remains true).

### Known edge cases / simplifications

- **Onboarding is still one page**, not a literal multi-step wizard with a route per step —
  a deliberate scope decision (see "Completed" above), not an oversight.
- **Rate limiting is in-memory, per-process** — real protection against casual scripted abuse,
  not a distributed limiter. Acceptable for launch per the spec's own "do not overengineer";
  revisit with a real store (Upstash/Redis) if abuse is observed at scale.
- **Entitlement enforcement covers the highest-value action per surface**, not every possible
  write — e.g. `redeem_reward`/`reverse_transaction`/wallet-token-rotation are intentionally
  not billing-gated (already-earned customer value, not new usage; "do not destroy data").
- **Legal pages are structural placeholders**, explicitly marked as requiring real legal
  review — not a claim of legal compliance.
- Everything from Day 4.5 (Meta/Twilio webhooks, opt-out, template sync) is unchanged this
  session.

### External blockers

- **Stripe**: no account/keys in this environment (user's explicit choice this session — see
  the opening note above). Real Products/Prices, a webhook endpoint registration, and setting
  `plans.stripe_price_id` are the exact remaining steps — see README.md "Deploying to
  production."
- **Vercel deployment**: no login/token in this environment (user's explicit choice). Not
  attempted. README.md has the exact steps for the user to run themselves.
- **WhatsApp/SMS/Apple/Google Wallet**: unchanged from every prior session — see
  `docs/integrations.md`.

### Environment variables

Added to `.env.local` (locally-generated test values, for this session's own Stripe webhook
signature tests — not real Stripe credentials): `STRIPE_SECRET_KEY` (syntactically-shaped
placeholder — the webhook route never calls the live Stripe API, only `constructEvent`, which
only needs the webhook secret), `STRIPE_WEBHOOK_SECRET`. Added to `.env.example`:
`RESEND_WEBHOOK_SECRET` and `CRON_SECRET` (real gaps found — both were already read by
existing Day 4 code but never documented), `NEXT_PUBLIC_META_APP_ID`/
`NEXT_PUBLIC_META_CONFIG_ID`/`META_GRAPH_API_VERSION` (Day 4.5 additions that hadn't made it
into `.env.example` yet either).

### Database migrations created this session

`0024_stripe_billing` — applied to the remote linked project, types regenerated.

### What comes after this session

- **Deploy to Vercel** (README.md "Deploying to production" has the exact steps) — the one
  remaining step to turn everything built across all 5 days into a live, testable product.
- Once deployed: push the auth config (`supabase config push`) with the real production URL,
  create real Stripe Products/Prices and set `plans.stripe_price_id`, register the Stripe
  webhook endpoint, and run the full customer/staff/billing flow against the real URL — this
  is genuinely the first time any of it can be tested end-to-end in a real browser rather than
  synthetic HTTP calls.
- Nothing about the architecture blocks that — every provider integration, every entitlement
  check, and every webhook this session built is real, tested code waiting for real
  credentials, not a stub.

## 2026-09-08 — Session 7 (final pre-deployment revision)

Not a feature day. The instruction was explicit: review the entire codebase as one complete
product, verify every prior claim against the actual code rather than trusting Day reports,
find anything incomplete/unsafe/inconsistent/fake, and fix everything fixable locally without
external credentials.

### Approach

Read every migration, RPC, RLS policy, webhook route, server action, and validation schema.
Ran a static scan for TODO/FIXME/console.log/`any`/unjustified eslint-disable/hardcoded
secrets (all clean — no findings). Dispatched five parallel deep-audit passes covering (1)
multi-tenancy/RLS/SECURITY DEFINER functions, (2) auth/onboarding/billing/entitlements, (3)
loyalty engine/scanner/wallet/CRM, (4) campaigns/automations/provider webhooks, (5) UI honesty/
empty states/docs accuracy — each read-only, reporting concrete file:line findings with a
severity, no speculation. Then fixed every real finding, wrote synthetic live tests against
the linked Supabase project for every database-level fix, and updated docs to match reality.

### Bugs found and fixed

**P0 — security/data corruption:**

1. **`reverse_transaction` double-reversal race.** The status check was a plain `SELECT`
   before an unconditional `UPDATE` — two concurrent calls for the same transaction could both
   pass the guard before either committed, double-reversing it (duplicate `REVERSAL` ledger
   rows, balance decremented twice). Fixed with `SELECT ... FOR UPDATE` to serialize concurrent
   callers. Verified live with genuinely simultaneous `Promise.all` RPC calls: exactly one
   succeeds.
2. **`accept_business_invitation` never verified the caller's email matched the invitation.**
   The email check only existed in the Next.js server action; the RPC itself (callable directly
   via PostgREST by any authenticated user) didn't enforce it, so a leaked/forwarded invite
   token let an unrelated account join the business at the invited role. Fixed inside the
   function. Verified live: an unrelated user is rejected, the correctly-invited email still
   works.
3. **`business_members` demote-then-promote owner takeover.** Migration 0014's guard only
   blocked *creating* a second OWNER — it didn't stop a MANAGER from demoting the current
   owner's row (ordinary UPDATE, guard doesn't fire) and then promoting themselves (now the
   "another owner exists" check is false). Two ordinary writes, both already permitted by
   existing RLS, full takeover. Fixed by blocking any UPDATE/DELETE against a row currently
   holding OWNER unless the actor is that same person or a platform admin. Verified live: both
   steps independently rejected.

**P1 — core workflow broken / real security hygiene gaps:**

4. Auth open redirect at 3 sites (`app/login/actions.ts`, `app/login/page.tsx`,
   `app/auth/confirm/route.ts`) — a bare `.startsWith("/")` check still lets `//evil.com/x`
   through. Fixed with a shared `lib/safe-redirect.ts` helper.
5. Onboarding wasn't atomic and could strand a user in a half-created, unrecoverable state — a
   branding/location failure after the business insert left an orphaned business +
   membership that the dashboard-redirect logic would then treat as "done," with no way back
   in. Fixed with a compensating delete on failure and a double-submit guard (an existing
   membership short-circuits to `/dashboard` instead of creating a second business).
6. A failed/skipped trial-subscription insert during onboarding was completely silent — not
   even logged. Fixed to log loudly; still non-fatal to onboarding itself (a business without a
   subscription row correctly falls back to the most restrictive entitlements, per existing
   design — "do not destroy data").
7. `loyalty_programs` had no DB-level validation on `points_per_currency_unit`/
   `points_reward_threshold`/`points_min_transaction_value`/`stamp_min_transaction_value`/
   `reward_value`/`reward_expiry_days` — only the app-layer zod schema rejected bad values, and
   that schema is bypassable via a direct PostgREST write (the table has a normal owner/manager
   RLS write policy). A negative `points_reward_threshold` would have made every transaction
   immediately reward-eligible. Fixed with matching CHECK constraints. Verified live.
8. Both cron routes (`/api/campaigns/process`, `/api/automations/run`) failed **open** when
   `CRON_SECRET` was unset — the actual state of `.env.example`'s own default — leaving both
   open to any unauthenticated internet caller. One sends real messages, the other grants real
   loyalty bonuses, across every business on the platform. Fixed to fail closed.
9. Settings, Rewards, and Branding were still literal Day 1 `PlaceholderPage` stubs — three
   prominently-linked sidebar pages with zero functionality, despite the project's own commit
   history and progress notes describing a complete MVP. Built the minimum real version of
   each (business profile edit, branding logo/colors/button-style edit, business-wide reward
   list with status filter) — see "Bugs found" isn't quite the right word for this one, it's a
   real gap more than a bug, but it's listed here because it was silently unflagged in every
   prior "launch status" summary.

**P2 — reliability / correctness edge cases:**

10. Reward generation only checked the threshold once per `record_transaction` call — a single
    transaction big enough to cross a resetting POINTS threshold more than once (e.g. threshold
    100, balance jumps 50 → 350) only granted one reward. Separately, `grant_automation_bonus`
    never checked the threshold at all, so an automation bonus crossing it silently granted no
    reward — the only place loyalty value could be earned without the same reward-generation
    guarantee as everywhere else. Fixed by extracting the logic into
    `private.evaluate_and_grant_rewards`, looped (bounded to avoid an infinite loop on
    non-resetting programs) and shared by both call sites. Verified live: a 350pt earn at a
    100pt threshold now grants 3 rewards and lands the balance at 50; an automation bonus
    crossing a threshold now grants a reward.
11. Stuck-job recovery was missing for both queues. `claim_queued_recipients` only claimed
    `QUEUED` rows — a worker crash between a provider accepting a send and the status write
    left that recipient stuck at `SENDING` forever (never retried, campaign never finalizes).
    `claimAutomationRun` had the same problem in a worse form: a stuck `QUEUED` run could never
    be retried at all, since its own dedupe-key uniqueness treated "inserted" as "handled."
    Fixed both with a bounded (10-minute) stale-job reclaim. Documented the honest residual
    risk (a crash *just after* provider acceptance means the reclaimed job resends) rather than
    claiming a stronger guarantee than the architecture provides. Verified live for both.
12. Signup was the one auth entry point that leaked account existence (Supabase's raw "User
    already registered" text), inconsistent with login/forgot-password/auth-confirm's
    deliberate no-enumeration policy. Fixed to match.
13. Misleading idempotency-key comments in `services/messaging/sms.ts`/`whatsapp.ts` implied
    protection against a double-send that doesn't actually exist at the provider-call level
    (neither Twilio's Messages API nor Meta's Cloud API accept an idempotency key at all) —
    replaced with an honest explanation of where the real protection actually comes from
    (upstream claim-once-then-timeout-reclaim, see #11).

**P3 — polish / accuracy:**

14. Birthday automation compared dates using server-UTC only, not the business's own timezone
    — fixed with an `Intl.DateTimeFormat`-based per-timezone month/day/year computation.
15. A code comment in `app/api/automations/run/route.ts` claimed VIP_UPGRADE was additionally
    event-driven off `record_transaction`; no such call site exists anywhere in the codebase.
    Corrected the comment — VIP_UPGRADE is cron-only, which is harmless (still fires exactly
    once) but was misdescribed for a future maintainer.
16. The landing page's "Digital loyalty & Wallet passes" feature card and hero copy stated
    Apple/Google Wallet as an available capability today with no qualification — verified
    against `services/wallet/{apple,google}.ts`: both require real certificates/service-account
    credentials that don't exist in this environment, and the API routes correctly return 501.
    Reworded to lead with the real, working digital card and mark Wallet as "coming soon."
17. The team-invite email interpolated the business's own name directly into raw HTML with no
    escaping — low severity (the "attacker" would be the account's own owner targeting their
    own invitee), but every other outbound email template in the codebase already escapes this
    class of input. Fixed to match, reusing the existing `escapeHtml` helper (exported from
    `services/messaging/email-template.ts` rather than duplicated).
18. `business_invitations` had no UPDATE/DELETE RLS policy at all — a sent invitation stayed
    valid for the full 7-day window with no way to cut it off if leaked, which mattered more
    once #2 above was found. Added a DELETE policy (owner/manager, unaccepted invitations only)
    and a real "Revoke" button on `/dashboard/team` so the fix has an actual UI path, not just
    a defense with no lever to pull.

### Explicitly documented, not fixed (real, not swept under the rug)

- **`audit_logs` exists (table + RLS) but nothing writes to it.** An earlier draft of
  `docs/database.md` implied otherwise; corrected. Wiring up audit writes across every
  sensitive call site (role changes, reversals, billing transitions, integration connects) is
  real scope, not a one-line fix — the P0/P1 security gaps took priority this session. Flagged
  as a genuine open item, not silently dropped.
- **Two customer-search call sites build PostgREST `.or()` filter strings via raw
  interpolation** (`app/dashboard/scanner/actions.ts`, `app/dashboard/customers/page.tsx`).
  `business_id` is always a separately-ANDed `.eq()`, so this cannot cross a tenant boundary —
  worst case is a crafted search term producing an unintended filter within the searcher's own
  already-visible data. Left as documented, low-severity debt.
- **WhatsApp campaign/automation sends require an approved Meta template literally named
  `marketing_message`/`automation_message`** — there's no per-campaign template selection in
  v1. Previously an undocumented assumption; now a documented external setup requirement (see
  `docs/integrations.md` "WhatsApp").

### Live test results

- `npx tsc --noEmit`, `npm run lint`, `npm run build`: clean after every batch of changes, not
  just at the end.
- **29/29 live synthetic checks** against the linked Supabase project, using disposable test
  businesses/users cleaned up immediately after each run (two separate scripts, deleted after
  use — same discipline as every prior session's provider-webhook tests):
  - Business-takeover attack (demote owner, then self-promote; direct delete of the owner's
    row) — all three rejected, owner's row unchanged.
  - Invitation acceptance by an unrelated authenticated user — rejected; the correctly-invited
    email still succeeds; a revoked invitation no longer accepts.
  - Two genuinely concurrent `reverse_transaction` calls for the same transaction — exactly one
    succeeds, exactly one `REVERSAL` ledger row, balance decremented exactly once.
  - Negative `points_reward_threshold`/`points_per_currency_unit` direct inserts — both
    rejected by the database.
  - A 350-point single-transaction earn at a 100-point threshold — 3 rewards granted, balance
    lands at 50.
  - An automation bonus crossing a stamp threshold — now generates a reward (previously none).
  - OWNER can update business settings; MANAGER correctly cannot (RLS `USING`-clause rejection
    verified by row count, not just absence of an error — a real gotcha hit while writing these
    tests, since a non-matching `UPDATE ... WHERE` isn't a Postgres error).
  - MANAGER can update branding; the change persists.
  - An artificially-aged `SENDING` campaign recipient is correctly reclaimed by
    `claim_queued_recipients` after the stale-job timeout, with `attempt_count` incremented.
  - A stuck `QUEUED` automation run is correctly cleared and re-claimable after the timeout.
- **Not exercised live this session** (unchanged external blockers, not new): real Stripe
  checkout, real WhatsApp/SMS/Wallet sends, a real production URL, a physical phone's camera
  against the scanner, browser/visual testing (no browser automation tool available in this
  environment) — all require external accounts/deployment the user has deliberately deferred,
  consistent with every prior session.

### Known edge cases / simplifications (new this session)

- Automation stuck-job reclaim and campaign stuck-job reclaim both accept a narrow,
  documented double-send risk in exchange for guaranteed forward progress — see "Bugs found"
  #11 above. This is a real trade-off, not a false guarantee.
- The `business_members` owner-protection trigger blocks a MANAGER from demoting/removing the
  owner, but does not stop an OWNER from demoting *themselves* (no self-harm guard) — no UI
  exposes that action, and it's not attacker-reachable by a different account, so it wasn't
  treated as in-scope for this revision.

### External blockers

Unchanged from Session 6 (Day 5) — Stripe/Meta/Twilio/Apple/Google Wallet accounts, Vercel
deployment, physical device testing. Nothing found this session requires a new external
dependency; every fix was code- or database-level, deployable with what's already available.

### Database migrations created this session

`0025_pre_deployment_revision` and `0026_stuck_job_recovery` — both applied to the linked
remote project via `npx supabase db push`, confirmed via the live test results above.

### What comes after this session

Nothing code-side is blocking deployment. The remaining sequence is exactly what Session 6
already documented in README.md "Deploying to production" — connect Vercel, set env vars
(including the now-required `CRON_SECRET`), push the Supabase auth config with the real
production URL, create real Stripe Products/Prices, and run the full customer/staff/billing
flow against a real URL for the first time.
