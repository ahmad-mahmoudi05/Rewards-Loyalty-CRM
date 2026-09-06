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

## Day 3 — QR scanner + wallet + staff mode

- [ ] Staff Mode shell: large "Scan Customer" / "Search Customer" buttons, minimal nav
- [ ] Browser camera QR scanner reading `customers.wallet_token`
- [ ] Manual search fallback (phone/name/email)
- [ ] Transaction confirmation screen → calls the Day 2 RPC
- [ ] Digital loyalty card (web page, no wallet dependency) — ships regardless of wallet cert status
- [ ] Apple/Google Wallet integration if credentials become available in time (see `docs/integrations.md`); otherwise architecture done, clearly marked EXTERNAL SETUP PENDING
- [ ] Transaction history + reversal (writes a `REVERSAL` `loyalty_transactions` row, never deletes)

**Day 3 acceptance test**: customer opens digital card, staff scans, customer profile loads,
staff confirms a transaction, points/stamps update correctly, no points awarded by scanning
alone.

## Day 4 — Marketing + automations

- [ ] Campaign creation flow: audience segment → channel → message → eligible-recipient
      preview (post consent-filtering) → send
- [ ] Segmentation queries (new/returning/VIP/inactive N days/birthday month/reward available/
      one-away/high spenders/consent-by-channel)
- [ ] `campaign_recipients` population respecting `customer_consents`
- [ ] Background worker (see `docs/architecture.md` — Postgres job table + scheduled function,
      `FOR UPDATE SKIP LOCKED`) driving sends through Email first (Resend is fastest to wire
      up without external approval), WhatsApp/SMS architecture code-complete even if the
      provider account isn't approved yet
- [ ] Automations: WELCOME, INACTIVE(14/21/30/45/60), BIRTHDAY, REWARD_UNLOCKED, NEAR_REWARD, VIP
      — using `automation_runs.dedupe_key` to guarantee at-most-once per window
- [ ] Basic campaign analytics (sent/delivered/read/failed counts)

**Day 4 acceptance test**: create an "Inactive 30 Days" email campaign; opted-out customers
excluded from the eligible count; campaign sends; statuses update; re-running the INACTIVE
automation the same day does not re-message anyone it already messaged.

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
