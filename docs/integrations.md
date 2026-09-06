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

## Apple Wallet

- Status: **CODE COMPLETE (payload mapping) / EXTERNAL APPLE CERTIFICATE SETUP PENDING
  (signing)**. The digital web card (`/join/[slug]/card`) is the primary, fully-working
  loyalty identity regardless of wallet status — nothing here blocks it.
- What's implemented (`services/wallet/apple.ts`, `app/api/wallet/apple/[token]/route.ts`):
  `buildApplePassJson` produces a spec-correct Apple Wallet `pass.json` payload
  (storeCard fields, barcode, colors) from our own business/customer/loyalty data. This is
  real, correct code, verifiable independent of certificates.
  `isAppleWalletConfigured()` gates it — with no certs present (true in this environment),
  the route returns `501` with a clear "not set up yet" response, and the customer-facing
  button shows a graceful "check back soon" message rather than a dead link (verified live).
- What's NOT implemented: turning that JSON into a signed `.pkpass` — a ZIP of `pass.json` +
  a `manifest.json` of SHA-1 file hashes + a PKCS#7 detached signature over the manifest.
  That requires a real Apple-issued Pass Type ID certificate and the Apple WWDR intermediate
  certificate, neither of which exist in this environment. **No `.pkpass` has been
  generated or tested.**
- Exact external steps needed: (1) an active Apple Developer Program membership, (2) create
  a Pass Type ID at developer.apple.com, (3) generate and download its signing certificate
  (as a `.p12`, then export the cert and key as PEM), (4) download Apple's current WWDR
  intermediate certificate. Once obtained, set `APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`,
  `APPLE_WWDR_CERT`, `APPLE_SIGNER_CERT`, `APPLE_SIGNER_KEY`, `APPLE_SIGNER_KEY_PASSPHRASE`
  in `.env.local` (names already in `.env.example`) and implement the signing step in
  `services/wallet/apple.ts` — `passkit-generator` (npm) is the recommended library to do
  that with, but was deliberately not installed/wired up yet since it would be untestable
  dead code without real certificates.

## Google Wallet

- Status: **CODE COMPLETE (object payload mapping) / EXTERNAL GOOGLE WALLET API SETUP
  PENDING (issuer account + signing)**.
- What's implemented (`services/wallet/google.ts`, `app/api/wallet/google/[token]/route.ts`):
  `buildLoyaltyObject` produces a spec-correct Google Wallet Loyalty Object payload. Same
  `isGoogleWalletConfigured()` gating and graceful unavailable UI as Apple, verified live.
- What's NOT implemented: (1) creating a "Loyalty Class" (one-time per business, via the
  Google Wallet REST API), and (2) signing the JWT that the "Add to Google Wallet" link
  (`https://pay.google.com/gp/v/save/<jwt>`) actually requires. **No real Google Wallet
  object or save link has been generated or tested.**
- Exact external steps needed: (1) a Google Cloud project with the Google Wallet API
  enabled, (2) a Google Wallet **Issuer account** (requires Google's business approval —
  this is the slow external step), (3) a service account with a JSON key, granted access in
  the Wallet Business Console. Once obtained, set `GOOGLE_WALLET_ISSUER_ID`,
  `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY` (names already
  in `.env.example`). `google-auth-library` (npm) is the recommended tool for the JWT
  signing step — same reasoning as above for not installing it yet.

## Wallet button UX (both providers)

`app/join/[slug]/card/wallet-buttons.tsx` detects iOS vs Android (`navigator.userAgent`) to
order the two buttons, but never hides either — verified live at a 390px mobile viewport.
Neither button is ever a dead link: clicking one that isn't configured shows an inline
"isn't set up for this business yet" message instead of doing nothing.

## Rule for all of the above

Never block unrelated feature work on an external approval. Build the full integration
architecture (connect UI, config storage, status states, webhook receivers) so the moment an
account is approved, it works — and clearly mark in the business's Integrations screen
whether a given channel is `NOT_CONNECTED` / `PENDING` / `CONNECTED` / `ERROR`
(`business_integrations.status`).
