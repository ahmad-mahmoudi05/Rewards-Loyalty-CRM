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

## Day 5 — Billing + analytics + polish + production

- [ ] Revisit `supabase/config.toml` `[auth]` section deliberately for production (re-enable
      `enable_confirmations`, tighten email `max_frequency`, set the real `site_url`/
      `additional_redirect_urls`) — Day 1 pushed the local-dev template defaults to the
      hosted project to unblock fast iteration; see `docs/progress.md`.
- [ ] Stripe Checkout + Customer Portal + webhook handler (verified signature, idempotent)
- [ ] Plan entitlements enforced (max locations/staff/customers, channel flags)
- [ ] Analytics dashboard (customers, repeat rate, transactions, tracked revenue, rewards
      redeemed, campaign performance) with 7/30/90-day + custom filters
- [ ] Loading/empty/error states across the dashboard
- [ ] `npm run build`, `npm run lint`, `tsc --noEmit` all clean
- [ ] Production env vars documented in `.env.example`
- [ ] Deploy to Vercel, smoke-test the full flow against production

**Day 5 acceptance test**: a real business can sign up, create a business, configure
branding/loyalty, generate a signup QR, register a customer, earn + redeem a reward, send a
working campaign, use an automation, and view analytics — in production.

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
