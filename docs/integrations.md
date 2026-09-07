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

## Email (Resend) — Day 4, REAL and verified live

- Status: **CODE COMPLETE, verified with real sends.** `services/messaging/email.ts` calls
  the real Resend API (`resend` npm package) with an `Idempotency-Key` per send
  (`campaign_recipients.id` / `automation_runs.id`), a `List-Unsubscribe` header, and
  provider-error classification (permanent vs transient) that feeds the queue's retry logic.
- **Sandbox reality, discovered live (not documented in advance, found by testing)**: this
  Resend account has no verified sending domain, so every send goes out as
  `onboarding@resend.dev`, and — this is the important part — **the Resend API itself
  rejects (403) any `to` address other than the account's own signup email**. This is not a
  bug in our code; it's Resend's anti-abuse sandbox restriction, confirmed directly against
  their live API. Verified during testing: a send to the account's own address succeeded
  (real `provider_message_id` returned, real webhook-equivalent event recorded); a send to
  any other address correctly failed with Resend's real error text, and our permanent-error
  classification correctly marked it `FAILED` (not endlessly retried).
- **Production requirement**: verify a real domain at resend.com/domains and change the
  hardcoded `onboarding@resend.dev` sender in `services/messaging/email.ts` to
  `notifications@<verified-domain>` (or a per-business subdomain) before real campaigns can
  reach real customers. This is the one external step standing between today's code and full
  production email.
- Webhooks (`app/api/webhooks/resend/route.ts`): signature-verified with the `svix` package
  against `RESEND_WEBHOOK_SECRET` (Resend signs webhooks in Svix's format). **Gotcha found
  while testing**: `svix`'s own `Webhook.verify()` only verifies and throws on failure — it
  does not parse/return the JSON body (that's `standardwebhooks`' `jsonParse` option, which
  `svix`'s wrapper explicitly disables). Fixed by calling `JSON.parse(rawBody)` ourselves
  immediately after a successful `verify()`. Verified live with a correctly-signed synthetic
  payload (a real webhook call from Resend to `localhost` isn't reachable, so this is the
  closest honest substitute — same code path, same signature check, same idempotency logic):
  valid signature → processed and recipient status updated; identical event replayed →
  detected as a duplicate via the `(provider_message_id, event_type)` unique index, not
  reprocessed; tampered signature → rejected with 401, never touches the database.
- Env vars: `RESEND_API_KEY` (set), `RESEND_WEBHOOK_SECRET` (set to a locally-generated test
  value for the signature-verification test above — **replace with the real secret from the
  Resend dashboard once a webhook endpoint is registered there**).

## WhatsApp (Meta WhatsApp Business Platform, Cloud API)

- Status: **CODE COMPLETE / META APP REVIEW + EMBEDDED SIGNUP PENDING.** No WABA credentials
  exist in this environment; nothing has been sent for real.
- What's implemented (`services/messaging/whatsapp.ts`): a correct Cloud API template-message
  POST (`messaging_product`, `type: "template"`, `language`, ordered body `parameters`),
  gated by `isWhatsAppConfigured()` (checks `business_integrations` for a connected
  `phoneNumberId`/`accessToken`), with Meta's documented permanent-vs-transient HTTP status
  classification (4xx except 429 = permanent) feeding the same retry logic email uses.
  `META_GRAPH_API_VERSION` is one named constant (default `v23.0`), not hard-coded per call
  site — **this default has not been checked against Meta's live changelog and should be
  verified before production use.**
- What's NOT implemented: Meta Embedded Signup itself (the OAuth-style flow a business owner
  completes to connect their own WhatsApp Business Account) — the dashboard's Integrations
  page still only has a placeholder for WhatsApp (see `docs/launch-checklist.md`); template
  sync from a connected WABA; and the incoming-webhook/opt-out-keyword handling described in
  the original spec (Parts 20, 23, 29, 30) were not built this session — flagged as remaining
  work, not silently dropped.
- Exact external steps needed: (1) a Meta Business/Developer account with a WhatsApp Business
  Platform app, (2) Meta App Review approval for the `whatsapp_business_messaging` +
  `whatsapp_business_management` permissions, (3) Embedded Signup configured in the Meta App
  Dashboard, (4) at least one approved message template per use case (marketing messages
  require Meta-approved templates outside the 24-hour customer service window).
- Env vars: `META_GRAPH_API_VERSION` (optional override), plus per-business
  `phoneNumberId`/`accessToken` stored in `business_integrations.config` — never a top-level
  column, since it's per-tenant, and never sent to the browser (RLS on
  `business_integrations` is OWNER/MANAGER-select-only, and even they only see it through the
  dashboard, never through client-side JS holding the raw token).

## SMS (Twilio)

- Status: **CODE COMPLETE / UAE SENDER REGISTRATION PENDING.** No Twilio credentials exist;
  nothing has been sent for real.
- What's implemented (`services/messaging/sms.ts`): uses the official `twilio` npm SDK,
  gated by `isSmsConfigured()`, with a `statusCallback` pointed at
  `/api/webhooks/twilio` (not yet implemented — the route doesn't exist; only the callback
  URL is wired). Twilio's own error `status` field drives the same permanent/transient
  retry classification as the other channels.
- **UAE-specific reality**: the UAE (our launch market) requires a registered Sender ID or an
  approved originator for commercial SMS under TDRA regulation — an unregistered generic
  Twilio long-code number is not guaranteed to deliver to UAE handsets and may be filtered by
  local carriers. This is a real, business-side regulatory approval, not something our code
  can route around. **Do not treat a successful Twilio API call as proof of delivery in the
  UAE without a registered sender.**
- Exact external steps needed: (1) a Twilio account with a funded balance, (2) UAE Sender ID
  registration (or an approved alphanumeric sender / registered local number) through
  Twilio's regulatory bundle process, which itself requires business verification documents.
- Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, plus a per-business
  `fromNumber` stored in `business_integrations.config`.

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

## Known gaps from Day 4 (not silently dropped — explicitly tracked)

- **Twilio status callback route doesn't exist yet** — `services/messaging/sms.ts` already
  points `statusCallback` at `/api/webhooks/twilio`, but that route hasn't been built. Low
  priority until a business actually has Twilio connected.
- **WhatsApp incoming messages / STOP keyword handling** (spec Parts 29–30) — not built. A
  real Meta webhook subscription would need `messages` field events parsed and, for opt-out
  keywords specifically, a consent-revocation write mirroring the email bounce/complaint
  handling already in `app/api/webhooks/resend/route.ts`.
- **WhatsApp template sync from a connected WABA** — not built; `message_templates` rows
  would need to be created by hand (or via a future sync job) until Embedded Signup exists.
- **`LOYALTY_EXPIRY_REMINDER` automation can never fire** — the loyalty engine (Day 2) has no
  points/stamps expiration concept at all; see `docs/database.md`. The automation's config UI
  exists and can be enabled, but its evaluator is a documented permanent no-op.

## Rule for all of the above

Never block unrelated feature work on an external approval. Build the full integration
architecture (connect UI, config storage, status states, webhook receivers) so the moment an
account is approved, it works — and clearly mark in the business's Integrations screen
whether a given channel is `NOT_CONNECTED` / `PENDING` / `CONNECTED` / `ERROR`
(`business_integrations.status`).
