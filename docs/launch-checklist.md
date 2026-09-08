# Five-Day Launch Checklist

Working software beats feature count. If behind schedule, fall back to the priority order at
the bottom, in that exact sequence.

## Day 1 — Foundation + multi-tenancy

- [x] Inspect project, write architecture/database/integrations docs
- [x] Database schema + migrations (all 9 files) + RLS, pushed to linked Supabase project
- [x] Install design-system deps (zod, clsx, cva, tailwind-merge, lucide-react, server-only)
- [x] Supabase client helpers: browser client, server client (cookies), service-role client
- [x] `proxy.ts` (this Next.js version renamed `middleware.ts` → `proxy.ts`) for optimistic auth redirects
- [x] Auth: `/login`, `/signup` pages + server actions
- [x] Onboarding: create business → default branding row → first location → done (loyalty
      type selection deferred to Day 2, since a real config needs the full Day 2 schema
      fields — see `docs/progress.md`)
- [x] Dashboard shell (nav: Overview, Customers, Loyalty, Scanner, Rewards, Campaigns, Automations, Analytics, Locations, Team, Branding, Integrations, Billing, Settings) — Overview/Locations/Team are real, the rest are scoped placeholders
- [x] Marketing homepage rebranded to LoyalNest, CTAs point at real `/signup` flow

**Day 1 acceptance test**: ✅ **Verified in a real browser** (see `docs/progress.md`). Owner
registers → onboarding creates a business + location → dashboard shows it → log out and back
in (fresh session) lands on that business's dashboard directly. A second owner's second
business shows zero data from the first — RLS-enforced isolation confirmed, not just
inspected. One open item: the linked Supabase project requires email confirmation before a
brand-new signup can reach onboarding — see "External blockers" in `docs/progress.md` for the
decision needed before Day 2.

## Day 2 — Customers + loyalty engine ✅ complete, verified live

- [x] Customer signup QR target: `/join/[slug]` mobile-first, business-branded join page +
      `/join/[slug]/card` digital-progress success screen (server action, service-role
      write, phone normalization via `libphonenumber-js`, per-channel consent capture)
- [x] Signup QR generation + copy-link, shown on `/dashboard/customers`
- [x] CRM: customer list (`customer_summary` view), search (name/phone/email), 8 working
      filters (all/new/returning/reward available/whatsapp/sms/email/inactive), profile page
      (identity, loyalty progress, transactions, ledger, rewards, consent history)
- [x] Loyalty program configuration UI (STAMPS / POINTS) writing to `loyalty_programs`,
      OWNER/MANAGER only
- [x] Loyalty engine as SECURITY DEFINER RPCs (`record_transaction`, `redeem_reward`,
      `reverse_transaction`) that atomically: validate tenant/role → insert `transactions` →
      compute stamps/points delta from program config → insert `loyalty_transactions` →
      update `loyalty_accounts` → generate `rewards` when threshold crossed (overflow-
      preserving, not a hard reset)
- [x] Reward redemption: atomic conditional UPDATE makes double redemption structurally
      impossible — verified with two concurrent requests, only one succeeded
- [x] Transaction reversal (Part 20, OWNER/MANAGER only) — bonus, not required for Day 2 but
      implemented and tested

**Day 2 acceptance test**: ✅ **All verified live against the linked Supabase project** (see
`docs/progress.md` for exact results). Brew Café (STAMPS, 5→Free Regular Coffee), Smash Padel
(STAMPS, 10→1 Free Court Hour), and Example Salon (POINTS, AED1=1pt, 500→AED50 Voucher) all
ran their full lifecycle — join, duplicate-join dedup, transactions, automatic reward
generation exactly once, redemption, double-redemption rejection — through the *same* code
path, zero industry-specific branches. Cross-tenant RLS and RPC isolation independently
verified (a Brew Café session could not read Smash Padel's customers/rewards, and RPC calls
with a cross-tenant business/customer/program id were rejected server-side).

## Day 3 — QR scanner + wallet + staff mode ✅ complete, verified live

- [x] Staff Mode shell (`/dashboard/scanner`): large "Scan Customer" / "Search Customer"
      buttons, active location, recent transactions, staff identity
- [x] Browser camera QR scanner (`@zxing/browser`) reading `customers.wallet_token` via a
      `/q/<token>` URL — permission/denied/no-camera/error states, stops after a valid scan,
      restart button (remounts cleanly, no imperative state reset)
- [x] Hardware-scanner-compatible manual token input (types like a keyboard, per Day 1's
      documented USB-scanner compatibility promise) + manual search fallback (phone/name/
      email) — both converge on the exact same `CustomerOperationalPanel`, reusing the Day 2
      `RecordTransactionForm`/`RedeemRewardButton` components unmodified in substance (only
      an optional `onSuccess` callback added for the scanner's client-side refresh)
- [x] Secure token resolution (`resolveCustomerByToken`): validates format, scopes to the
      staff's own business twice over (explicit filter + RLS), identical generic error for
      malformed/nonexistent/cross-tenant tokens
- [x] Digital loyalty card (`/join/[slug]/card`) now has a real QR code, remaining-count
      copy, last-updated timestamp, and Apple/Google Wallet buttons with graceful
      unavailable states — ships regardless of wallet cert status
- [x] Apple/Google Wallet: payload-mapping architecture complete and route-wired; signing
      is EXTERNAL SETUP PENDING (no certificates/service account available) — see
      `docs/integrations.md` for exact next steps. No `.pkpass` or Google save-link has been
      generated; not claimed as working.
- [x] Transaction reversal, revisited: reversing a transaction now also cancels a reward it
      solely produced if still unredeemed (verified), and flags — without silently undoing —
      the case where that reward was already redeemed (verified)
- [x] Staff invitation (`/dashboard/team`): owner/manager can add a new or existing user as
      STAFF/MANAGER (never OWNER — enforced at both the app layer and a new DB trigger)
- [x] Role enforcement extended to direct URL access on billing/integrations/analytics/
      loyalty (redirect, not just hidden nav) — verified with a real STAFF account
- [x] Wallet token rotation RPC (`rotate_customer_wallet_token`), OWNER/MANAGER only
- [x] Fixed a real, pre-existing responsive bug found during testing: the Day 1 dashboard
      shell's fixed-width sidebar overflowed at phone width — now stacks/scrolls correctly

**Day 3 acceptance test**: ✅ **Verified live** for both Brew Café (STAMPS) and Smash Padel
(STAMPS, different threshold/reward, identical code) — customer opens the digital card
(shows a real QR), staff scans it (via the hardware-input path) or finds them by search,
sees their name + last-4 phone + exact progress, records a transaction, sees the Day 2
engine's real persisted result, reward unlocks automatically exactly once, redemption works
and a second attempt is rejected. Cross-tenant scanner attack rejected (a Brew Café session
scanning Smash Padel's customer token got the generic "couldn't be recognized" message, not
a leak). No loyalty is ever awarded by scanning alone — see `docs/progress.md` for full
results.

## Day 4 — Marketing + automations ✅ complete, verified live

- [x] Campaign creation flow: audience segment → channel → message → eligible-recipient
      preview (post consent-filtering, with an exclusion breakdown) → send now or schedule
      (single-page builder, not a multi-step wizard with per-step draft persistence — a
      documented scope simplification, see `docs/progress.md`)
- [x] Segmentation: 15 segments (all/new/returning/inactive 14·30·60/reward available/one
      stamp away/near points reward/high spender/frequent customer/consent-by-channel×3/
      birthday month), shared between the Day 2 CRM filters and the campaign builder
- [x] `campaign_recipients` population respecting `customer_consents` — real, frozen at send
      time, re-checked again immediately before each dispatch
- [x] Background worker: Next.js `after()` for immediate processing + `/api/campaigns/process`
      as the cron-driven durability net; `FOR UPDATE SKIP LOCKED` atomic claiming — verified
      concurrency-safe live (two simultaneous worker calls, zero double-processing)
- [x] Email (Resend) sends for real — verified with a real delivered message, a real
      permanent-failure classification, and a real (synthetically-signed, since Resend can't
      reach localhost) webhook round trip including idempotent replay handling
- [x] WhatsApp (Meta Cloud API) and SMS (Twilio) adapters are code-complete; no real send
      attempted (no credentials) — see `docs/integrations.md` for exact blockers
- [x] Automations: 5 fixed types per the detailed retention-automation spec (superseding this
      checklist's original WELCOME/INACTIVE/BIRTHDAY/REWARD_UNLOCKED/NEAR_REWARD/VIP list) —
      `INACTIVE_WINBACK`, `BIRTHDAY_REWARD`, `REWARD_READY_REMINDER`, `VIP_UPGRADE` fully
      functional and dedup-verified; `LOYALTY_EXPIRY_REMINDER` a documented no-op (see
      `docs/database.md`)
- [x] Campaign analytics use real recipient-status counts, never fabricated; attribution
      section explicitly labeled "temporal association, not causation"
- [x] Email unsubscribe: real page + action, verified a subsequent campaign correctly
      excludes an unsubscribed customer
- [x] Staff invitation rebuilt as a real invite-then-accept flow with a real emailed link —
      verified live end-to-end including reuse prevention

**Day 4 acceptance test**: ✅ **Verified live** with real data on the linked project. Created
Brew Café with Ahmad (real email, consent yes), Sarah (fake email, consent yes), Omar (no
consent). An "All customers" Email campaign correctly excluded Omar (2 eligible of 3
matched), sent for real to Ahmad (delivered, real provider id), and correctly classified
Sarah's send as a permanent failure (Resend sandbox restriction — real provider behavior, not
a bug) — campaign rolled up to `PARTIALLY_FAILED`, never falsely `COMPLETED`. Ahmad then
unsubscribed via the real link; a second campaign correctly excluded him. Inactive-customer
automation fired once for a backdated customer (tag + bonus + consent-gated message), and a
second scheduler run produced zero duplicates; the same real dedup behavior was independently
verified for birthday, reward-ready, and VIP automations. Cross-tenant campaign injection
(a forged customer id from a second business) was silently excluded, not leaked.

## Day 4.5 — Close Day 4 messaging/provider gaps ✅ complete, verified live

- [x] Meta WhatsApp webhook (`app/api/webhooks/meta/route.ts`): verification challenge,
      `X-Hub-Signature-256` HMAC validation, message status updates (sent/delivered/read/
      failed) mapped onto `campaign_recipients`/`automation_runs`, inbound message storage
      (`inbound_messages`), idempotent on both status events and inbound messages
- [x] WhatsApp opt-out: conservative exact-match STOP/UNSUBSCRIBE/CANCEL/END/QUIT detection on
      inbound messages, revokes `customer_consents` — verified NOT to trigger on ordinary text
      containing "stop"
- [x] Meta template synchronization: real Graph API request path (`fetchWhatsAppTemplates`),
      `[ SYNC TEMPLATES ]` button on `/dashboard/integrations`, mapping tested against a
      realistic fixture (including a template missing `components`)
- [x] Twilio SMS webhook (`app/api/webhooks/twilio/route.ts`): `X-Twilio-Signature` validation
      resolved per-business via the payload's own `AccountSid`, status callback mapping
      (queued/sent/delivered/undelivered/failed), inbound SMS storage + STOP opt-out
- [x] `/dashboard/integrations` built for real (was a Day 1 placeholder until now): WhatsApp
      connect (Embedded Signup — code ready, external approval required — falling back to a
      tested manual credential form) + SMS/Twilio connect, status badges, template list
- [x] Meta Embedded Signup architecture: real client JS-SDK flow + server-side token exchange,
      gated behind `NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_CONFIG_ID` — CODE PATH READY,
      EXTERNAL META APPROVAL REQUIRED, not exercised against a real Meta app
- [x] Loyalty expiry decision: **removed `LOYALTY_EXPIRY_REMINDER` from v1** (second path —
      four real automations, not five where one is fake) rather than retrofitting lot-based
      expiry into the already-tested Day 2 loyalty engine mid-session. Concrete post-launch
      design written up in `docs/database.md`.
- [x] `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass clean

**Day 4.5 acceptance test**: ✅ **Verified live** with a disposable test business/customer and
correctly-signed synthetic provider payloads (no real Meta app or Twilio account exists in
this environment — see `docs/integrations.md`). 35/35 checks passed, covering: Meta webhook
verification (correct token accepted, wrong token rejected); a correctly-signed status update
applied and an identical replay NOT double-recorded; a tampered signature rejected (401) and
never reaching the database; a status update for an automation-originated send resolved
correctly; a cross-tenant status update accepted by the endpoint but NOT applied to the real
recipient (business-id mismatch defense); WhatsApp STOP revoking consent while "please stop by
later" did not; the identical set of checks for Twilio (signature validation, duplicate-
callback idempotency, unknown-`AccountSid` rejection, failure-reason mapping, inbound SMS
STOP); and template-fixture mapping (correct field extraction, an empty-`components` template
handled without crashing, pagination cursor extraction). All test data cleaned up after.

## Day 5 — Billing + launch readiness ✅ code complete, tested locally / not yet deployed

- [x] Stripe Checkout + Customer Portal + webhook (signature-verified, idempotent) — 27/27
      synthetic live checks passed, see `docs/integrations.md` "Stripe"
- [x] Plan entitlements enforced server-side (max locations/staff, channel flags,
      automations, trial/billing gate on recording a transaction) — see `docs/database.md`
      "Entitlements layer"
- [x] 14-day free trial at onboarding, no card required; plan chooser added to the
      onboarding form
- [x] Locations: added the missing "create a second location" path (`max_locations` had
      nothing to gate before this)
- [x] Password reset (`/forgot-password` → `/auth/confirm` → `/reset-password`), Supabase's
      `token_hash`+`type` pattern, custom `recovery.html`/`confirmation.html` email templates
- [x] Auth production config reviewed and a deliberate decision recorded (confirmations stay
      off until real SMTP exists; `site_url`/redirect URLs flagged with a TODO for the real
      deployment URL) — see `docs/architecture.md` "Auth production configuration"
- [x] Landing page polished (more feature coverage, pricing teaser, footer with legal links);
      real `/pricing` page reading `plans` from the database, never hardcoded prices
- [x] Dashboard overview rebuilt with real data throughout (previously had one hardcoded
      "Active campaigns: 0"); Analytics rebuilt from a placeholder into a real page with
      7/30/90-day + custom date-range filters and a campaign-performance table
- [x] Error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`) — production never
      shows a raw stack trace
- [x] SEO: `robots.ts`/`sitemap.ts`, Open Graph metadata, dashboard marked `noindex`
- [x] Legal placeholders (`/privacy`, `/terms`) — explicitly marked as requiring real legal
      review before broad commercial launch, not fabricated legal promises
- [x] Lightweight in-memory rate limiting on public write endpoints (signup, login,
      forgot-password, join, invite-signup, unsubscribe) — a deliberately simple fixed-window
      limiter, not a distributed one (see `lib/rate-limit.ts` for the accepted limitation)
- [x] `vercel.json` cron config for the two existing cron-facing routes
- [x] `npm run build`, `npm run lint`, `tsc --noEmit` all clean
- [x] Production env vars documented in `.env.example` and README.md "Deploying to
      production," including two real gaps found and fixed (`RESEND_WEBHOOK_SECRET` and
      `CRON_SECRET` were used by existing code but missing from `.env.example` since Day 4)
- [ ] **Not deployed to Vercel** — no Vercel login/token exists in this environment; the user
      explicitly chose to deploy via the Vercel dashboard themselves rather than have this
      session attempt it. README.md "Deploying to production" has the exact steps.
- [ ] **Not tested against a real production URL** — depends on the deployment above.
- [ ] **Stripe/WhatsApp/Twilio/Apple/Google Wallet still need real accounts** — unchanged
      external blockers, see `docs/integrations.md` "Day 5 launch status classification."

**Day 5 acceptance test**: everything gated on real external accounts (Stripe checkout with
real money, WhatsApp/SMS sends, a live Vercel URL, a physical phone's camera against the
scanner) could not be exercised in this environment — see `docs/progress.md` Session 6 for
exactly what *was* verified live (billing webhook/RLS: 27/27 synthetic checks) versus what
remains for the user to verify after deployment (README.md "Deploying to production" step 6
is the exact checklist).

## Session 7 — Final pre-deployment revision ✅ complete, verified live

Not a feature day — a full read-through of the entire codebase (every migration, RPC, RLS
policy, webhook, server action) looking specifically for bugs, security gaps, and
misrepresented functionality, per "verify, don't trust prior Day reports." Full detail in
`docs/database.md` "Session 7" and `docs/progress.md` Session 7.

- [x] Fixed 3 P0 issues: `reverse_transaction` double-reversal race,
      `accept_business_invitation` missing invitee-email check, `business_members`
      demote-then-promote owner takeover
- [x] Fixed 5 P1 issues: auth open redirect (3 sites), non-atomic/silently-failing onboarding,
      cron routes failing open without `CRON_SECRET`, missing DB-level validation on
      `loyalty_programs`, Settings/Rewards/Branding still being Day 1 placeholder stubs
- [x] Fixed 5 P2 issues: reward generation not looping for multi-threshold crossings,
      automation bonuses never generating rewards, stuck-job recovery for the campaign/
      automation queues, signup account-enumeration inconsistency, misleading
      idempotency-key comments in the messaging adapters
- [x] Fixed 3 P3 issues: birthday automation was server-UTC-only (now per-business timezone),
      a misleading code comment about VIP being event-driven, landing page overclaiming Apple/
      Google Wallet as available today
- [x] Built real Settings (business profile), Branding (logo/colors/button style — validated
      strictly as hex, closing a latent email-HTML-injection path in the same change), and
      Rewards (business-wide reward list with status filter) pages, replacing three
      prominently-linked sidebar pages that were still empty stubs
- [x] Added a revoke-invitation control (`/dashboard/team`) using the new
      `business_invitations` DELETE policy, so the invite-email-binding fix has a real UI path
      to actually cut off a leaked token, not just a defense with no lever
- [x] Documented, not fixed (explicitly flagged, not swept under the rug — see "Known
      simplifications" in `docs/database.md`): `audit_logs` exists but nothing writes to it;
      two customer-search call sites build PostgREST filter strings without escaping (tenant-
      bounded, low severity); WhatsApp campaign/automation sends require an approved template
      literally named `marketing_message`/`automation_message`
- [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` all clean after every change
- [x] 29/29 live synthetic checks against the linked Supabase project (disposable test
      businesses, cleaned up after) covering every P0/P1/P2 database-level fix — see
      `docs/progress.md` Session 7 for the exact list

**Session 7 verdict**: CODE READY FOR DEPLOYMENT. See `docs/progress.md` Session 7 for the
full pre-deployment report — external blockers (Stripe/Meta/Twilio/Apple/Google Wallet
accounts, Vercel deployment, physical device testing) are unchanged from Day 5, not new.

### Cron cadence — reduced to once daily for the Vercel Hobby plan (beta only)

`vercel.json` originally configured `/api/campaigns/process` every 10 minutes and
`/api/automations/run` hourly. Vercel's Hobby plan only allows a cron job to run **once per
day**, so both would have blocked deployment — not just the campaigns one. Both are now:

```
{ "path": "/api/campaigns/process", "schedule": "0 3 * * *" },
{ "path": "/api/automations/run", "schedule": "0 3 * * *" }
```

`0 3 * * *` = once daily at **03:00 UTC / 07:00 Asia/Dubai** — a sensible early-morning slot
for a UAE-first launch market, before a café's opening hours.

**This is a beta/initial-deployment-only tradeoff, not a target architecture:**

- Scheduled campaigns and time-based automations (inactive win-back, birthday, reward-ready
  reminder, VIP) only actually process **once a day**, at that fixed time. A campaign
  scheduled for 2pm won't send until the next 03:00 UTC run; an automation condition crossed
  in the morning won't be evaluated until the next day.
- Immediate sends are unaffected — Next.js `after()` still fires processing right when a
  campaign is sent from the dashboard, and Stripe/Meta/Twilio/Resend webhooks are all
  request-driven, not cron-driven. Only the *durability-net* and *time-based-evaluation*
  paths are throttled to once daily.
- **Once on Vercel Pro (or another scheduler is wired in), move both crons back to a frequent
  cadence** — `*/10 * * * *` for `/api/campaigns/process`, hourly (`0 * * * *`) for
  `/api/automations/run` was the pre-Hobby-constraint configuration and remains the intended
  production target. No code changes are needed for that — only `vercel.json`.
- No application logic changed to make this fit — `CRON_SECRET` protection, the campaign
  processor, and the automation evaluators are all exactly as documented in `docs/progress.md`
  Session 7.

## Priority order if behind schedule

1. Authentication
2. Multi-tenancy/security (RLS)
3. Business setup
4. Customer signup
5. CRM
6. Configurable loyalty
7. Transactions
8. Rewards
9. QR scanning
10. Staff mode
11. Marketing consent
12. Email campaigns
13. Campaign engine
14. Automations
15. WhatsApp integration
16. Stripe
17. Analytics
18. Wallet improvements
19. Extra polish

Never trade correctness on 1–10 for progress on 11+.

## Biggest technical risks

- **RLS correctness** — a single wrong policy leaks cross-tenant data. Mitigation: policies
  are centralized through a small set of `private.*` helper functions (see
  `docs/database.md`), not ad-hoc per-table logic, so there's one place to get it right.
- **Loyalty math trustworthiness** — mitigated by never exposing a client-writable path to
  the ledger tables at all (RPC/service-role only, see `docs/database.md`).
- **Bulk messaging performance/cost** — mitigated by queuing through `campaign_recipients`
  rather than looping in a request; real load testing deferred past the 5-day MVP.
- **External approvals (Meta/Apple/Stripe activation)** — cannot be accelerated; mitigated by
  building all surrounding architecture so nothing else is blocked on them (see
  `docs/integrations.md`).
- **Five days is aggressive for this scope** — mitigated by the strict priority order above;
  Days 4–5 features are explicitly allowed to ship "code complete, external setup pending."
