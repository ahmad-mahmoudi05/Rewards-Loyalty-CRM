# Integrations

Provider-specific logic must stay behind a small service interface per capability so a
provider can be swapped without touching call sites (`services/whatsapp.ts`,
`services/sms.ts`, `services/email.ts`, `services/wallet.ts`, `services/billing.ts` — added
as each is implemented). None of these exist yet as of Day 1; this doc tracks what each will
need and its current status.

Status legend: **CODE COMPLETE** (implemented, works once external setup is done) /
**EXTERNAL SETUP PENDING** (needs an account/approval outside our control) / **NOT STARTED**.

## Supabase (Auth, Postgres, Storage)

- Status: **CODE COMPLETE** for Day 1 scope (auth, schema, RLS). Project already linked
  (`ibzbdxizkihvlnqegjpj`), `.env.local` populated.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key,
  safe for the browser), `SUPABASE_SERVICE_ROLE_KEY` (server-only, **never** imported by
  client code — see `docs/architecture.md` "Two data paths").
- Storage buckets for branding assets (logos) not yet created — add when the branding
  upload UI is built.

## Stripe (SaaS billing)

- Status: **NOT STARTED**. Planned for Day 5.
- Env vars needed: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- External setup: a Stripe account with Checkout + Customer Portal enabled, and Products/
  Prices matching `public.plans` (`STARTER`/`GROWTH`/`PRO`) created in Stripe with their IDs
  stored back onto the `plans` rows.

## WhatsApp (Meta WhatsApp Business Platform)

- Status: **NOT STARTED**. Planned for Day 4 (architecture only — approval is external).
- Env vars needed: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, plus a
  per-business WhatsApp Business Account ID / phone number ID stored in
  `business_integrations.config` (not as a top-level column, since it's per-tenant).
- External setup: Meta Embedded Signup flow, template approval per business. Cannot be
  completed by us alone — each business owner must complete Meta's onboarding. Build the
  connect/status UI and template management regardless; mark actual sends as blocked until a
  business completes theirs.

## SMS (Twilio, initial choice)

- Status: **NOT STARTED**. Planned for Day 4.
- Env vars needed: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and a sender number/Messaging
  Service SID (per business or shared, TBD when built — likely shared sender with business
  name in the message body for MVP, since per-business sender registration is slow).

## Email (Resend, initial choice)

- Status: **NOT STARTED**. Planned for Day 4.
- Env vars needed: `RESEND_API_KEY`. Sender domain verification is external setup per
  business only if we later offer custom-domain sending (Enterprise tier); MVP sends from a
  shared platform domain with the business name in the "from" display name.

## Apple Wallet / Google Wallet

- Status: **NOT STARTED**. Planned for Day 3; digital web card (no wallet dependency) ships
  regardless as the fallback, per AGENTS spec §3 (Day 3 acceptance test note).
- Apple Wallet needs a Pass Type ID + signing certificate from an Apple Developer account
  (external, per-platform-tenant — one cert can likely serve all businesses if passes are
  templated, needs confirming against Apple's terms).
- Google Wallet needs a Google Wallet API issuer account + service account credentials.
- Env vars: `APPLE_WALLET_*`, `GOOGLE_WALLET_*` — exact names finalized when built.

## Rule for all of the above

Never block unrelated feature work on an external approval. Build the full integration
architecture (connect UI, config storage, status states, webhook receivers) so the moment an
account is approved, it works — and clearly mark in the business's Integrations screen
whether a given channel is `NOT_CONNECTED` / `PENDING` / `CONNECTED` / `ERROR`
(`business_integrations.status`).
