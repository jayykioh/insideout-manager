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

## Deploy to Cloudflare Workers

This project uses the official `@opennextjs/cloudflare` adapter. The adapter requires Next.js `16.3.8` or newer in the supported 16.3 line; this project pins `16.3.8`. Wrangler builds and serves `.open-next/worker.js` with static files from `.open-next/assets`. Do not deploy `.next` directly.

For local development, copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key. Then create `.dev.vars` containing `NEXTJS_ENV=development` (or copy `.dev.vars.example`) so the Worker preview loads the development Next.js environment. Never commit `.env*` or `.dev.vars` files.

Run the production build in the Workers runtime:

```sh
npm run preview
```

The command runs the PWA build before `next build`, adapts that output with OpenNext, and starts a local Wrangler preview. Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` available to the build; they are compiled into the browser bundle and are also read by the server at runtime. `SUPABASE_SERVICE_ROLE_KEY` must only be set as a Worker secret. `DEFAULT_SHOP_ID` is optional and may be set as a Worker runtime variable.

Before a CLI deployment, set the two public Supabase values in the build shell, then configure the Worker runtime values as secrets. For example, in PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "your-anon-key"
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

Each `wrangler secret put` command prompts for its value. Configure these build variables and runtime secrets separately when using Cloudflare Workers Builds. Set optional `DEFAULT_SHOP_ID` as a Worker variable when the database contains multiple shops. The Worker is named `insideout-manager`; the configured `ASSETS` binding serves OpenNext's static output, and `WORKER_SELF_REFERENCE` is reserved for OpenNext features that call the Worker itself. No R2 cache or image binding is configured because the current app does not use ISR/revalidation or Next Image optimization.

For **Cloudflare Workers Builds**, set the Dashboard build command to `npm run build:worker` and the deploy command to `npx opennextjs-cloudflare deploy`. Do not use `npm run build` as the Workers Builds command: it only creates the Next.js `.next` output and does not compile the OpenNext Worker. The deploy command expects that adapter output to exist.

The supplied Workers Builds log confirms its build command ran `npm run build`, which created only the Next.js output; the subsequent deploy command failed because the compiled OpenNext config was missing. Use the Dashboard commands above to fix that deployment pipeline failure. The separate production `Unexpected loadManifest(/.next/server/preview-props.json) call!` / Error 1101 remains consistent with an unadapted or incompatible Worker artifact, but it is not confirmed against a successfully deployed OpenNext build. Verify it by loading the home page, API route, and `/sw.js` from the Worker URL after the next successful deployment.

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run build:worker
npm run preview
```

Tests execute the actual migration on PGlite, a PostgreSQL WASM build, with a minimal Supabase Auth test schema. They cover tenant boundaries, staff restrictions, atomic rollback, checkout replay, immutable cost capture, cancellation reversal, shift closing and PIN lockout. A live Supabase staging check is still required; the test harness does not emulate the hosted Auth service.

## Current limitations

This is a working first implementation, not a completed production rollout of every item in `IMPLEMENTATION_PLAN.md`.

- Live Supabase Auth, deployment, device revocation, admin PIN recovery and staff invitation recovery require further integration work and verification.
- Payroll is an estimate using the configured hourly rate and sales bonus. Effective-dated rules and approved payroll periods are not implemented.
- Reports currently show revenue, sales volume, expenses and top products. Full historical profit reporting and scheduled aggregates remain to be built.
- Product and avatar uploads, receipt hardware validation, employee attendance corrections and returns after a closed shift are not implemented.
- Offline orders persist and retry with stable IDs. Conflicts are retained for attention. Resolving rejected orders and orders associated with closed shifts needs an admin workflow.
- The service worker uses Workbox for precaching and caching strategies; background retries run while the app is open. Installability on iOS and browser storage eviction recovery remain unverified.
- The current snapshot endpoint returns all RLS-visible records. Pagination, virtualization, route splitting, production performance budgets and full accessibility audit remain pending.
- The operational JSON export is not a database backup. Configure managed backups and rehearse restore before using real shop data.
- No production deployment or hosted database mutation has been performed.

## Sources

Implementation follows the supplied blueprints and the official [Next.js App Router documentation](https://nextjs.org/docs/app/getting-started/installation) and [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).
