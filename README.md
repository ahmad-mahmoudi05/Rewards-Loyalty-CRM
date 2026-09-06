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
