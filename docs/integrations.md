# Integrations

Provider-specific logic must stay behind a small service interface per capability so a
provider can be swapped without touching call sites (`services/whatsapp.ts`,
`services/sms.ts`, `services/email.ts`, `services/wallet.ts`, `services/billing.ts` — added
as each is implemented). None of these exist yet as of Day 1; this doc tracks what each will
need and its current status.

Status legend: **CODE COMPLETE** (implemented, works once external setup is done) /
**EXTERNAL SETUP PENDING** (needs an account/approval outside our control) / **NOT STARTED**.

## Day 5 launch status classification

Per-capability, not per-provider (a capability can be production-ready even if the provider
underneath it needs one more external step):

| Capability | Status |
|---|---|
| Multi-tenant SaaS foundation, auth, RLS | **PRODUCTION READY** |
| Customer CRM, loyalty engine (stamps/points), QR/scanner | **PRODUCTION READY** |
| Digital loyalty card | **PRODUCTION READY** |
| Email campaigns/automations | **PRODUCTION READY** after a verified Resend sending domain (currently sandbox-only, see below) |
| Stripe billing (Checkout, Portal, webhook, entitlements, trial) | **CODE READY — NO STRIPE ACCOUNT IN THIS ENVIRONMENT**, tested with synthetic signed events |
| WhatsApp campaigns/automations, opt-out, template sync | **CODE READY — META APP REVIEW + EMBEDDED SIGNUP REQUIRED** |
| SMS campaigns/automations, opt-out | **CODE READY — TWILIO ACCOUNT + UAE SENDER REGISTRATION REQUIRED** |
| Apple Wallet | **CODE READY — APPLE DEVELOPER CERTIFICATES REQUIRED** |
| Google Wallet | **CODE READY — GOOGLE WALLET ISSUER ACCOUNT REQUIRED** |
| Analytics (real data, date-range filters) | **PRODUCTION READY** |
| Password reset / auth production config | **CODE READY — REQUIRES A DELIBERATE HUMAN STEP** (site_url/redirect URLs + the `enable_confirmations` decision, see README.md "Deploying to production") |
| Production deployment (Vercel) | **CODE READY — NOT YET DEPLOYED** (this environment has no Vercel login; see README.md) |
| Background campaign/automation processing on Vercel Hobby | **BETA-ONLY LIMITATION**: `vercel.json`'s crons run once daily (03:00 UTC / 07:00 Asia/Dubai) since Hobby doesn't allow more frequent cron jobs. Immediate sends and webhooks are unaffected; only scheduled campaigns and time-based automations are throttled to once a day. Move back to frequent processing on Vercel Pro or another scheduler before a real commercial launch — see `docs/launch-checklist.md` "Cron cadence." |
| Loyalty points/stamps expiry | **POST-LAUNCH** (deferred at Day 4.5 — see `docs/database.md`) |
| Legal pages (Privacy/Terms) | **POST-LAUNCH** — placeholder content live at `/privacy`/`/terms`, explicitly marked as requiring real legal review before broad commercial launch |
| Custom domain | **POST-LAUNCH** — launch on the Vercel-provided URL first, see `docs/launch-checklist.md` "Domain readiness" |

## Supabase (Auth, Postgres, Storage)

- Status: **CODE COMPLETE** for Day 1 scope (auth, schema, RLS). Project already linked
  (`ibzbdxizkihvlnqegjpj`), `.env.local` populated.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key,
  safe for the browser), `SUPABASE_SERVICE_ROLE_KEY` (server-only, **never** imported by
  client code — see `docs/architecture.md` "Two data paths").
- Storage buckets for branding assets (logos) not yet created — add when the branding
  upload UI is built.

## Stripe (SaaS billing)

- Status: **CODE COMPLETE, TESTED with synthetic signed events / NO REAL STRIPE ACCOUNT IN
  THIS ENVIRONMENT.** No Stripe keys were provided this session (a deliberate choice — see
  `docs/progress.md` Session 6) — everything below is real, correct code exercised against
  this codebase's own webhook route, never against Stripe's live API.
- **Checkout** (`services/billing/stripe.ts::createCheckoutSession`,
  `app/dashboard/billing/actions.ts::startCheckout`): real `stripe.checkout.sessions.create`
  call in subscription mode, reusing an existing `stripe_customer_id` if the business has
  one. Gated by `plans.stripe_price_id` being set — with no Stripe price mapped, the plan
  shows "Unavailable" on the Billing page rather than a dead/broken button.
- **Customer Portal** (`createPortalSession`, `openBillingPortal`): real
  `stripe.billingPortal.sessions.create` call, redirects the owner to Stripe's own hosted
  portal (payment method, invoices, cancel — all Stripe's own UI, not rebuilt here).
- **Webhook** (`app/api/webhooks/stripe/route.ts`): signature-verified
  (`stripe.webhooks.constructEvent`), idempotent (`stripe_webhook_events`, Stripe's own event
  id as the dedupe key), handles `checkout.session.completed` (links `stripe_customer_id`),
  `customer.subscription.created`/`.updated` (syncs status via
  `services/billing/stripe.ts::mapStripeStatus`, resolves `plan_id` from the subscription
  item's Stripe Price id, sets `current_period_end` — **note**: as of the installed `stripe`
  SDK (22.6.1)'s own type definitions, `current_period_end` lives on each subscription
  *item*, not on the top-level `Subscription` object anymore; verified directly against
  `node_modules/stripe`'s `.d.ts` files rather than assumed from training data, since this is
  exactly the kind of API-shape drift AGENTS.md warns about), and
  `customer.subscription.deleted` (forces `CANCELLED`). `invoice.paid`/`invoice.payment_failed`
  are recorded for observability only — the authoritative state change for both always
  arrives as its own `customer.subscription.updated` event, so applying it twice was judged a
  correctness risk (two events racing on the same fields) rather than a redundancy worth
  having. **Verified live** (27/27 checks, synthetic events signed with
  `stripe.webhooks.generateTestHeaderString` — Stripe's own documented tool for testing
  signature verification without a live account): invalid signature rejected (401) before
  touching the database; checkout completion links the Stripe customer id; subscription
  created/updated correctly maps status, resolves plan from price id, and reads
  `current_period_end` from the item; a duplicate event id is a no-op (proven by manually
  flipping the DB value between two identical deliveries and confirming the second delivery
  did not re-apply the event); subscription deletion forces `CANCELLED`; an event for an
  unresolvable business is acknowledged but never guessed onto another business's row.
- **Trial**: every business starts on a 14-day trial at onboarding
  (`app/onboarding/actions.ts`), no card required — a plain `subscriptions` insert relying on
  the new `subscriptions_insert_owner_once` RLS policy (migration `0024`), not a service-role
  bypass. **Verified live**: an OWNER can insert their own business's first subscription row;
  a second insert for the same business is rejected by RLS; an OWNER cannot insert or read a
  subscription for a business they don't own.
- **Entitlements** (`lib/entitlements.ts`): the single read layer every plan/feature check
  goes through — `maxLocations`/`maxStaff`/`maxCustomers`/channel flags come straight from
  `plans` (unchanged since Day 1 — the seed data already had the exact entitlement flags and
  AED 149/299/599 prices this session's spec asked for). Enforced server-side (never just a
  hidden UI button) at: team invites (`max_staff`, counting pending invitations too),
  location creation (`max_locations` — see "Locations" below, a genuine Day 5 gap this
  closed), campaign channel selection (`email_enabled`/`whatsapp_enabled`/`sms_enabled`),
  automation enabling (`automation_enabled`, re-checked on every scheduled run — not just at
  save time, so a downgrade stops a previously-enabled automation), and recording a
  transaction (the core "business action" billing gate — `billingGateMessage`, blocked once a
  trial expires or a subscription falls out of `TRIALING`/`ACTIVE`).
- **Locations**: there was previously no way to add a second location at all — `Locations`
  was a read-only list. Without that, the Pro plan's headline "multi-location" entitlement had
  nothing to gate. Added `app/dashboard/locations/actions.ts::createLocation` (max_locations
  enforced), the minimum needed to make that entitlement meaningful — not a general
  locations-management feature build-out.
- External setup needed for a real launch: (1) a Stripe account, (2) Products/Prices created
  matching `plans` (STARTER/GROWTH/PRO — `supabase/migrations/0009_seed_plans.sql` has the
  current AED 149/299/599 prices, configurable there, not hardcoded in the app), their ids
  written to `plans.stripe_price_id` (one-time manual SQL, not a migration — see README.md
  "Deploying to production"), (3) a webhook endpoint registered in the Stripe dashboard
  pointing at `<deployment>/api/webhooks/stripe` for the six events listed above.
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (currently unused — Checkout/Portal are both
  server-redirect flows).

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

- Status: **CODE COMPLETE (send + webhook + opt-out + template sync + dashboard connect UI),
  TESTED with synthetic signed payloads / EMBEDDED SIGNUP CODE READY — EXTERNAL META APPROVAL
  REQUIRED.** No real Meta app or WABA credentials exist in this environment (still true as of
  Day 4.5); nothing has been sent for real, and none of the below has been exercised against
  Meta's actual live servers — only against this codebase's own webhook routes with
  correctly-signed synthetic requests, the same honesty standard already applied to Resend.
- **Send** (`services/messaging/whatsapp.ts`, unchanged from Day 4): a correct Cloud API
  template-message POST, gated by `isWhatsAppConfigured()`, with Meta's documented
  permanent-vs-transient HTTP status classification. `META_GRAPH_API_VERSION` default `v23.0`
  — still not verified against Meta's live changelog.
- **Webhook** (`app/api/webhooks/meta/route.ts`, Day 4.5): both halves Meta requires.
  - `GET` — the verification challenge (`hub.mode`/`hub.verify_token`/`hub.challenge`),
    checked against `META_WEBHOOK_VERIFY_TOKEN`.
  - `POST` — signature-verified (`X-Hub-Signature-256`, HMAC-SHA256 over the *raw* body keyed
    by `META_APP_SECRET`, `services/messaging/whatsapp.ts::verifyMetaSignature`,
    `timingSafeEqual` comparison). Handles `statuses[]` (sent/delivered/read/failed → updates
    `campaign_recipients` or, for automation-sent messages, `automation_runs` — resolved via
    `provider_message_id`, with the payload's own `phone_number_id`-resolved business checked
    against the found row's `business_id` before any write, so a status update can never cross
    tenants even if a `provider_message_id` were somehow guessed) and `messages[]` (inbound
    customer messages, stored in `inbound_messages`, with opt-out keyword detection — see
    below). Idempotent via `message_events`/`inbound_messages`' unique indexes. **Verified
    live** (synthetic signed payloads against the local dev server, `next dev`): correct
    verification challenge accepted / wrong token rejected (403); correctly-signed status
    update applied; identical delivery replayed and NOT double-recorded; tampered-signature
    request rejected (401) and never touched the database; a status update for an
    automation-originated send correctly resolved via the `action_result` expression index; a
    cross-tenant status update (real `provider_message_id`, wrong business's
    `phone_number_id`) was accepted by the endpoint but did **not** modify the real recipient.
- **WhatsApp opt-out** (Day 4.5): conservative, exact-match only — `STOP`/`UNSUBSCRIBE`/
  `CANCEL`/`END`/`QUIT` (trimmed, case-insensitive, minor trailing punctuation tolerated),
  never a substring match. A matching inbound message revokes `customer_consents` (channel
  `WHATSAPP`, `source: 'WHATSAPP_STOP'`), mirroring the Day 4 email-bounce pattern. **Verified
  live**: an inbound "STOP" correctly revoked consent and future campaigns would exclude that
  customer; an inbound "please stop by later, thanks!" correctly did **not** revoke anything —
  the substring "stop" alone is never enough.
- **Template sync** (Day 4.5, `services/messaging/whatsapp.ts::fetchWhatsAppTemplates` +
  `services/messaging/whatsapp-template-mapping.ts` for the pure parsing/mapping +
  `app/dashboard/integrations/actions.ts::syncWhatsAppTemplates`): a real, config-gated Graph
  API `GET /{waba-id}/message_templates` request with pagination via `paging.next`, upserted
  into `message_templates` (`id`/`name`/`language`/`category`/`status`/`components`,
  `business_id` + `provider_template_id` unique). With no WABA connected this returns an
  error, never fake rows. The mapping module has no network/`server-only` code specifically so
  it can be fixture-tested in isolation; **verified** against a fixture shaped like Meta's
  real response (including a template missing `components` entirely, and pagination cursor
  extraction) — not verified against Meta's real API, since no real WABA exists here.
- **Dashboard** (`/dashboard/integrations`, Day 4.5 — previously a placeholder since Day 1):
  connect status badge (`NOT_CONNECTED`/`PENDING`/`CONNECTED`/`ERROR`), a manual WABA-credential
  connect form (the actually-tested path in this environment), a `[ SYNC TEMPLATES ]` button
  + synced-template table once connected, and disconnect.
- **Embedded Signup** (`components/dashboard/whatsapp-embedded-signup-button.tsx` +
  `app/dashboard/integrations/actions.ts::completeWhatsAppEmbeddedSignup`): **CODE PATH READY
  — EXTERNAL META APPROVAL REQUIRED.** Real client-side flow (Meta's JS SDK, `FB.login` with a
  `config_id`, a `message` listener for the `WA_EMBEDDED_SIGNUP` postMessage event carrying
  `waba_id`/`phone_number_id`) and a real server-side authorization-code exchange
  (`GET /oauth/access_token` with `client_id`/`client_secret`/`code` — the access token is
  never sent to or held by the browser). Disabled — falls back to the manual form — unless
  `NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_CONFIG_ID` are set, which they aren't here: no
  Meta Business/Developer account with WhatsApp Embedded Signup configured exists in this
  environment, so this specific flow has **not** been exercised end-to-end, only built to spec
  from Meta's documented Embedded Signup shape.
- **Template naming requirement, found during the Session 7 revision**: campaign sends
  (`services/campaigns/process.ts`) and automation sends (`services/automations/shared.ts`)
  use a fixed template name — `marketing_message` and `automation_message` respectively — not
  whichever template a business actually synced/had approved (`fetchWhatsAppTemplates`).
  Per-campaign template selection doesn't exist in v1. **A real WABA must have an approved
  template named exactly `marketing_message` (for campaigns) and `automation_message` (for
  automations)**, or those sends will fail with a template-not-found error from Meta. This is
  now a documented setup requirement, not a silent assumption.
- Exact external steps needed: (1) a Meta Business/Developer account with a WhatsApp Business
  Platform app, (2) Meta App Review approval for the `whatsapp_business_messaging` +
  `whatsapp_business_management` permissions, (3) Embedded Signup configured in the Meta App
  Dashboard (yields `NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_CONFIG_ID`/`META_APP_SECRET`),
  (4) the webhook subscribed in the Meta App Dashboard pointing at
  `<deployment>/api/webhooks/meta` with `META_WEBHOOK_VERIFY_TOKEN`, (5) two approved message
  templates named exactly `marketing_message` and `automation_message` (see above).
- Env vars: `META_GRAPH_API_VERSION`, `META_APP_ID`, `META_APP_SECRET`,
  `META_WEBHOOK_VERIFY_TOKEN`, `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID` (see
  `.env.example`); per-business `phoneNumberId`/`wabaId`/`accessToken` stored in
  `business_integrations.config` — never a top-level column, never sent to the browser.

## SMS (Twilio)

- Status: **CODE COMPLETE (send + webhook + opt-out + dashboard connect UI), TESTED with
  synthetic signed payloads / UAE SENDER REGISTRATION PENDING.** No real Twilio account
  exists in this environment; nothing has been sent for real.
- **Send** (`services/messaging/sms.ts`, unchanged from Day 4): uses the official `twilio`
  npm SDK, gated by `isSmsConfigured()`, `statusCallback` pointed at `/api/webhooks/twilio`.
- **Webhook** (`app/api/webhooks/twilio/route.ts`, Day 4.5): one route handling both status
  callbacks and inbound SMS. Signature-verified via `twilio.validateRequest`
  (`services/messaging/sms.ts::validateTwilioSignature`) against the request's own
  `AccountSid` field, resolved to a specific business's `authToken` via
  `business_integrations` **before** validation — an unrecognized `AccountSid` is rejected
  (404) before any signature check, and a request signed with the wrong token is rejected
  (401) even with a real, known `AccountSid`. Maps `queued`/`sent`/`delivered`/`undelivered`/
  `failed` onto `campaign_recipients`/`automation_runs`, same cross-tenant business-match
  defense and `message_events` idempotency as the Meta webhook. **Verified live**: correctly-
  signed status callback applied; duplicate callback not double-recorded; wrong-signature
  request rejected and never touched the database; unknown `AccountSid` rejected; a `failed`
  status correctly mapped with the provider's error code/message in `failure_reason`.
- **SMS opt-out** (Day 4.5): same conservative exact-match word list as WhatsApp, applied to
  inbound SMS `Body`. A match revokes `customer_consents` (channel `SMS`, `source:
  'SMS_STOP'`). **Verified live**: inbound "STOP" revoked SMS consent; inbound "Can I stop by
  tomorrow?" did not.
- **Dashboard** (`/dashboard/integrations`, Day 4.5): connect form (Account SID/Auth
  Token/sender number), status badge, disconnect. This is the real, tested connection path —
  Twilio doesn't require an App-Review-style approval to connect an account, only to reliably
  deliver into the UAE (see below).
- **UAE-specific reality** (unchanged from Day 4): the UAE requires a registered Sender ID or
  an approved originator for commercial SMS under TDRA regulation — an unregistered generic
  Twilio long-code number is not guaranteed to deliver to UAE handsets and may be filtered by
  local carriers. **Do not treat a successful Twilio API call, or even a successfully
  connected integration, as proof of delivery in the UAE without a registered sender.**
- Exact external steps needed: (1) a Twilio account with a funded balance, (2) UAE Sender ID
  registration (or an approved alphanumeric sender / registered local number) through
  Twilio's regulatory bundle process, (3) that number's webhook configured in the Twilio
  Console to point at `<deployment>/api/webhooks/twilio` for inbound SMS (status callbacks are
  wired automatically per-send, no separate console config needed for those).
- Env vars: per-business `accountSid`/`authToken`/`fromNumber` stored in
  `business_integrations.config`, set via `/dashboard/integrations`. The top-level
  `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` in `.env.example` are unused by any code path today
  (kept as a placeholder for a possible future platform-level fallback).

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

## Day 4.5 closeout — gaps from Day 4 resolved

All four gaps flagged at the end of Day 4 were closed this session:

- ~~Twilio status callback route doesn't exist~~ → `app/api/webhooks/twilio/route.ts`, signed,
  idempotent, tested (see "SMS (Twilio)" above).
- ~~WhatsApp incoming messages / STOP keyword handling not built~~ →
  `app/api/webhooks/meta/route.ts` + `inbound_messages`, tested (see "WhatsApp" above).
- ~~WhatsApp template sync not built~~ → `fetchWhatsAppTemplates` +
  `/dashboard/integrations`'s `[ SYNC TEMPLATES ]`, tested against a fixture (see "WhatsApp"
  above).
- ~~`LOYALTY_EXPIRY_REMINDER` can never fire~~ → removed from v1 rather than shipped as a fake
  automation (spec item 5, second path). See `docs/database.md` "Loyalty expiry — deferred,
  not faked" for the reasoning and the concrete post-launch design.

## Known gaps remaining after Day 4.5 (not silently dropped — explicitly tracked)

- **Meta Embedded Signup has not been exercised against a real Meta app** — code path ready
  (client JS SDK flow + server-side token exchange), gated behind
  `NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_CONFIG_ID`, falls back to a tested manual
  connect form. See "WhatsApp" above.
- **None of the Meta/Twilio webhook code has been exercised against real Meta/Twilio
  infrastructure** — only against this codebase's own routes with correctly-signed synthetic
  requests (no real Meta app or Twilio account exists in this environment). The signature
  verification, idempotency, and cross-tenant logic are real and tested; a live provider
  callback reaching a deployed instance is the one thing that can't be proven without those
  accounts.
- **Loyalty expiry**: intentionally deferred, not built — see `docs/database.md`.

## Rule for all of the above

Never block unrelated feature work on an external approval. Build the full integration
architecture (connect UI, config storage, status states, webhook receivers) so the moment an
account is approved, it works — and clearly mark in the business's Integrations screen
whether a given channel is `NOT_CONNECTED` / `PENDING` / `CONNECTED` / `ERROR`
(`business_integrations.status`).
