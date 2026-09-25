# Inside Out Manager

Next.js application for the supplied Inside Out blueprints. Vietnamese interface, dark/light themes, mobile POS, Supabase API and PostgreSQL migrations.

## Run locally

Requires Node.js 24 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Choose **Trải nghiệm với dữ liệu mẫu**, select a profile, and enter any four digits to explore the explicitly isolated demo. Demo data persists in this browser's IndexedDB; it is not a secure substitute for production authentication.

Start a shift before checkout. The demo supports cash, transfer and mixed sales, cancellation, stock adjustments, product editing and archiving, employee editing, expense entry, closing and approving shifts, reports, settings, and browser receipt printing.

## Connect Supabase

1. Create a Supabase project and apply `supabase/migrations/202609160001_foundation.sql` using the SQL editor or Supabase CLI.
2. Copy `.env.example` to `.env.local` and set the project URL, anon key and server-only service role key. Never use a `NEXT_PUBLIC_` prefix on the service key.
3. Create an initial admin through Supabase Auth, then use `supabase/bootstrap.sql` to create the shop and membership with that user's UUID.
4. Restart Next.js. Sign in with the admin's email and password. This enrolls the counter device for 30 days.
5. Add staff from the staff screen. Each staff member gets a real Auth identity and a bcrypt PIN. Profile selection exchanges a verified PIN for that employee's Supabase session.

Every browser-accessible business table has RLS. Writes go through a transactional command function. Cost tables and financial data have separate admin policies. The server rejects cross-origin commands and keeps session tokens in HttpOnly cookies.

The service role is used only for device enrollment, profile discovery, staff provisioning and PIN session exchange. Ordinary business commands use the employee JWT.

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Tests execute the actual migration on PGlite, a PostgreSQL WASM build, with a minimal Supabase Auth test schema. They cover tenant boundaries, staff restrictions, atomic rollback, checkout replay, immutable cost capture, cancellation reversal, shift closing and PIN lockout. A live Supabase staging check is still required; the test harness does not emulate the hosted Auth service.

## Current limitations

This is a working first implementation, not a completed production rollout of every item in `IMPLEMENTATION_PLAN.md`.

- Live Supabase Auth, deployment, device revocation, admin PIN recovery and staff invitation recovery require further integration work and verification.
- Payroll is an estimate using the configured hourly rate and sales bonus. Effective-dated rules and approved payroll periods are not implemented.
- Reports currently show revenue, sales volume, expenses and top products. Full historical profit reporting and scheduled aggregates remain to be built.
- Product and avatar uploads, receipt hardware validation, employee attendance corrections and returns after a closed shift are not implemented.
- Offline orders persist and retry with stable IDs. Conflicts are retained for attention. Resolving rejected orders and orders associated with closed shifts needs an admin workflow.
- The service worker is a small native implementation, not Workbox; background retries run while the app is open. Installability on iOS and browser storage eviction recovery remain unverified.
- The current snapshot endpoint returns all RLS-visible records. Pagination, virtualization, route splitting, production performance budgets and full accessibility audit remain pending.
- The operational JSON export is not a database backup. Configure managed backups and rehearse restore before using real shop data.
- No production deployment or hosted database mutation has been performed.

## Sources

Implementation follows the supplied blueprints and the official [Next.js App Router documentation](https://nextjs.org/docs/app/getting-started/installation) and [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).
