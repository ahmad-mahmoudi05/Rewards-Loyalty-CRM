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
