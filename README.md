# LoyalNest

Loyalty that brings customers back.

LoyalNest is a multi-tenant customer retention platform — digital loyalty (stamps or
points), a lightweight CRM, Apple/Google Wallet passes, and consent-gated WhatsApp/SMS/email
marketing automation — for repeat-visit businesses. Launching first with cafés, architected
from day one to also serve padel courts, barbers, salons, gyms, restaurants, and similar
businesses without any backend changes.

See `docs/architecture.md` for the system design, `docs/database.md` for the schema and RLS
model, `docs/integrations.md` for external providers, and `docs/launch-checklist.md` +
`docs/progress.md` for where the build currently stands.

## Getting started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Database schema changes go through `supabase/migrations/` and `npx supabase db push` —
never through the Supabase dashboard SQL editor (see `docs/database.md`).

## Deploying to production (Day 5)

This app is ready to deploy; nothing about it requires localhost. Full status of every
provider (what's tested, what's blocked on an external account) is in
`docs/integrations.md`; the classification of what's production-ready vs. code-ready is in
`docs/launch-checklist.md` "Day 5". Short version:

1. **Connect the repo to Vercel** (vercel.com → New Project → import this GitHub repo).
   Framework preset: Next.js. No build command changes needed.
2. **Set every production environment variable** listed in `.env.example` on the Vercel
   project (Project Settings → Environment Variables, scoped to Production). At minimum for
   a working launch: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (the real `https://your-app.vercel.app`
   URL, or your custom domain once purchased — see "Domain readiness" in
   `docs/launch-checklist.md`), `RESEND_API_KEY` + `RESEND_WEBHOOK_SECRET`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and
   **`CRON_SECRET`** (set this to any random value — required as of the Session 7 revision:
   `/api/campaigns/process` and `/api/automations/run` fail closed with no secret configured,
   since an open, unauthenticated version of either route can trigger real message sends /
   loyalty bonuses across every business on the platform; Vercel Cron sends this automatically
   as a bearer token once the env var is set on the project, no extra config needed).
   WhatsApp/SMS/Wallet vars are optional — those channels degrade gracefully (clear "not
   connected" states, never a broken button) with no credentials at all.
3. **Before the first deploy touches real traffic**, review and push
   `supabase/config.toml`'s `[auth]` section deliberately: update `site_url` and
   `additional_redirect_urls` to the real production URL (currently `localhost` — see the
   TODO comment directly above `site_url` in that file), decide on `enable_confirmations`
   (currently off — see the comment on that line for why, and what's already built and
   waiting for the moment it's turned on), then `npx supabase config push`. This step was
   deliberately left for a human to do with the real production URL in hand, not
   auto-pushed this session.
4. **Create the real Stripe Products/Prices** (Dashboard → Product catalog) matching
   `plans` (STARTER/GROWTH/PRO — see `supabase/migrations/0009_seed_plans.sql` for current
   prices), then set each plan's `stripe_price_id` column (`update public.plans set
   stripe_price_id = 'price_...' where code = 'STARTER'`, etc. — a one-time manual step, not
   a migration, since the ids only exist once a real Stripe account creates them). Register
   a webhook endpoint at `<your-domain>/api/webhooks/stripe` for `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, and put its
   signing secret in `STRIPE_WEBHOOK_SECRET`.
5. **Deploy.** Vercel Cron (`vercel.json`, already committed) schedules
   `/api/campaigns/process` and `/api/automations/run` — note the free/Hobby Vercel plan
   only allows daily cron jobs, not the `*/10 * * * *`/hourly cadence configured; either
   upgrade to Pro or manually trigger those routes yourself (an
   `Authorization: Bearer <CRON_SECRET value>` request — required, both routes reject any
   request without it) until then.
6. **Test on the real production URL** — signup → onboarding → loyalty setup → join QR →
   customer join → scanner (a real phone camera, not localhost/headless — see
   `docs/progress.md` Session 3's documented limitation) → campaign send → billing checkout
   (Stripe test mode) — before telling a real business it's ready.

### Rollback

Vercel keeps every previous deployment; "Promote to Production" on an earlier deployment in
the Vercel dashboard is an immediate rollback with no code changes needed. Database
migrations are forward-only (no down-migrations exist in this codebase, matching Supabase
CLI's own migration model) — a schema rollback means writing and pushing a new migration
that reverses the specific change, not reverting the deployment.
