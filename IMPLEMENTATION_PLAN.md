# Inside Out Manager Implementation Plan

## 1. Purpose and source of truth

This plan turns the two supplied blueprints into a buildable delivery sequence for a production ready Inside Out Manager application.

The newer **Inside Out Manager Product Blueprint** is the authoritative product specification. The older **INNOIR Manager V2 Product Blueprint** is a source for inherited business behavior. Where they differ, use the newer specification. In particular:

- Use the newer blue and neutral design tokens instead of the older optional gold or sage palette.
- Build a restrained profile picker inspired by Netflix, not a cinematic login screen with decorative video.
- Treat offline POS, theme preferences, PIN lockout, audit logging, performance budgets, and accessibility as launch requirements.
- Preserve the proven POS, cancellation, inventory reversal, financial, attendance, payroll, and receipt behavior described in V2.

The current workspace contains no application or Git repository. This is therefore a greenfield plan. No legacy implementation can currently be reused or verified.

## 2. Product outcome

Inside Out Manager will be a Vietnamese first, installable, mobile first point of sale and shop operations PWA for a small or medium retail shop. It will support a shared counter device, individual employee accountability, secure admin functions, offline checkout, inventory, attendance, cash closing, finance, payroll inputs, reporting, printing, and shop settings.

### Launch success criteria

- A new staff member can complete a first sale within five minutes without training.
- Switching between staff profiles, including PIN entry, takes less than three seconds under normal network conditions.
- A sale can be completed during a temporary outage and syncs exactly once when connectivity returns.
- Staff cannot read cost, profit, payroll, other staff history, global finance, or admin data through the UI or direct API calls.
- Cancelling an order is atomic: status, audit data, payment reversal, and inventory restoration either all succeed or all fail.
- Cash closing calculations are reproducible from immutable payments and approved finance records.
- Mobile and desktop Lighthouse Performance scores exceed 90 on the agreed test fixture, with LCP below 2.0 seconds and POS TTI below 2.5 seconds on the specified 4G profile.
- Primary workflows meet WCAG 2.2 AA, support keyboard and screen reader use, reduced motion, 200 percent zoom, portrait, and landscape.

## 3. Delivery assumptions and decisions

These decisions remove ambiguity from the blueprints. Record any change as an Architecture Decision Record before implementation diverges.

| Area | Decision |
|---|---|
| Tenancy | Model every business row with `shop_id` from day one. Launch may use one shop, but data isolation must be multi tenant safe. |
| Locale | Default to `vi-VN`, VND, and `Asia/Ho_Chi_Minh`. Store timestamps as UTC `timestamptz`; format them in the shop timezone. |
| Money | Store VND amounts as integer `bigint`. Never use floating point for money. |
| Human identity | Every admin and staff member has a distinct Supabase Auth identity. `auth.uid()` must always identify the acting human after profile selection. |
| Shared device | A separately revocable device enrollment identifies the shop and permits profile discovery. A successful PIN exchange creates a short lived employee session; it must never be a client side impersonation flag. |
| PIN storage | Store PIN hashes in a server only table using Argon2id or bcrypt with an appropriate work factor. Never store PINs in `profiles`, preferences, logs, analytics, or browser storage. |
| Data access | Use RLS for every exposed table and Storage bucket. Perform sensitive multi row mutations through transactional PostgreSQL functions or trusted server endpoints. Never ship a service role key to the browser. |
| Deletion | Products, variants, staff, and finance categories are archived, not hard deleted, once referenced by a transaction. |
| Sales history | Snapshot product name, SKU, sale price, cost, tax and discount values into order items so later catalog edits cannot rewrite history. |
| Offline scope | Checkout creation is offline capable. Admin actions, cancellation, inventory adjustment, staff management, cash closing approval, and financial edits require a connection at launch. |
| Offline stock conflict | Preserve a completed customer sale. On sync, accept the historical sale once, permit a negative stock exception if necessary, and create an admin reconciliation alert rather than silently dropping the order. |
| Data fetching | Use TanStack Query for server state and mutations. Keep cart state local and feature scoped. Do not introduce a global state library unless a measured need appears. |
| Forms | Use React Hook Form plus a shared schema validation layer. Use the same rules on client and server where possible. |
| UI language | User facing copy is Vietnamese. Code, schema, tests, and technical documentation are English. |
| Icons | Use one SVG icon family throughout. Do not use emoji as structural icons. |
| Backup | Provide admin exports for operational portability and configure provider level automated backups. Test restoration before launch. |

## 4. Target architecture

### 4.1 Technology baseline

- Next.js App Router with TypeScript and strict mode
- React and Tailwind CSS
- Shadcn UI primitives customized through semantic CSS tokens
- Supabase Auth, PostgreSQL, Storage, Realtime where justified, and Edge Functions or server routes for privileged flows
- TanStack Query for remote state
- IndexedDB through a small typed persistence adapter for the offline outbox
- Workbox based service worker, with an explicit fallback for browsers that do not support Background Sync
- Zod or an equivalent schema layer for boundary validation
- Vitest and Testing Library for unit and component tests
- Playwright for end to end, responsive, print, and offline tests
- Supabase local development plus SQL tests for migrations, constraints, functions, and RLS
- Lighthouse CI and automated accessibility checks

Pin exact dependency versions in the lockfile after the initial technical spike. Prefer maintained dependencies with small client bundles; do not add a library for behavior that the platform already handles well.

### 4.2 Application boundaries

```text
Browser PWA
  UI and cart state
  TanStack Query cache
  IndexedDB outbox
  Service worker
        |
        | authenticated HTTPS
        v
Next.js server and trusted functions
  device enrollment and PIN exchange
  protected commands
  receipt rendering and exports
        |
        | user JWT or server credential
        v
Supabase
  Auth
  PostgreSQL with RLS
  transactional RPC functions
  Storage
  scheduled report refresh and backup jobs
```

Rules for this boundary:

- Ordinary scoped reads may go directly from the browser to Supabase under RLS.
- Checkout, cancellation, inventory adjustment, shift closing, PIN verification, role changes, payroll finalization, and backup export use commands with server side authorization and database transactions.
- Realtime is limited to data where a second device must see a change promptly. Do not subscribe to whole shop tables.
- Cache keys always include `shop_id` and relevant filters. A logout, profile switch, or shop switch clears sensitive query caches.

### 4.3 Route map

```text
/login                         full email or phone and password sign in
/profiles                      shared device profile picker
/profiles/[id]/pin             in place PIN step, visually part of profile picker

/pos                           product discovery, cart, payment, sync state
/pos/orders/[id]               order details and receipt actions
/attendance                    check in, current work session, check out
/shift                         current shift totals and close shift

/reports                       admin overview and reports
/finance                       expenses and shift closing review
/admin/products                products and variants
/admin/inventory               stock levels and adjustments
/admin/staff                   staff, PIN, permissions, pay rules
/admin/staff/[id]              attendance, sales, and payroll detail
/admin/settings                shop, receipt, theme default, device, backup
```

Use route groups for public, profile selection, staff, and admin layouts. Route middleware improves navigation, but it is never the security boundary; every query and command enforces authorization again.

### 4.4 Suggested repository structure

```text
app/
  (public)/login/
  (device)/profiles/
  (staff)/pos/
  (staff)/attendance/
  (staff)/shift/
  (admin)/admin/
  (admin)/reports/
  (admin)/finance/
src/
  components/ui/
  components/layout/
  design-system/
  features/auth/
  features/pos/
  features/offline/
  features/attendance/
  features/shifts/
  features/catalog/
  features/inventory/
  features/staff/
  features/payroll/
  features/finance/
  features/reports/
  features/settings/
  lib/supabase/
  lib/validation/
  lib/formatting/
  lib/observability/
supabase/
  migrations/
  functions/
  seed.sql
  tests/
tests/
  e2e/
  fixtures/
  performance/
public/
  icons/
  manifest.webmanifest
docs/
  adr/
  runbooks/
```

Keep feature logic with its feature. Shared UI primitives must not contain business authorization or database calls.

## 5. Data model

Finalize the model through migrations, generated database types, constraints, and an entity relationship diagram. The minimum launch model is below.

### 5.1 Identity and tenant tables

- `shops`: identity, name, locale, currency, timezone, active status
- `profiles`: one to one with `auth.users`; display name, phone, active status
- `shop_memberships`: shop, user, role `admin|staff`, employment status, timestamps
- `user_preferences`: user, shop, theme `dark|light`, accessibility and UI preferences, `pin_last_changed_at`
- `staff_pins`: user, shop, password hash, algorithm metadata, changed time; no client select policy
- `pin_attempts`: user, device, rolling failure count, window start, `locked_until`
- `device_sessions`: shop, label, token digest, enrolled by, last active user, last active time, revoked time, expiry
- `avatars`: user, shop, storage path, crop metadata, updated time
- `audit_logs`: actor, shop, action, target table, target id, request id, sanitized metadata, timestamp

### 5.2 Catalog and inventory tables

- `categories`
- `products`: shop, name, description, category, image, active status
- `product_variants`: product, SKU, barcode, attributes, sale price, cost price, active status
- `inventory_levels`: shop and variant unique pair, on hand, updated time, version
- `inventory_movements`: variant, type, signed quantity, order or adjustment reference, actor, reason, timestamp
- `inventory_alerts`: negative stock, failed sync, and reconciliation workflow

Cost is sensitive. Prefer a protected `product_costs` table or a view that omits cost for staff, rather than relying on the client not to request a column.

### 5.3 Sales and payment tables

- `orders`: client generated UUID, human order number, shop, seller, work session, cash shift, status, monetary totals, sync metadata, created and cancelled fields
- `order_items`: immutable product and price snapshots, quantity, cost at sale, line totals
- `payments`: order, method `cash|bank_transfer`, amount, reference, recorded time
- `transactions`: append only financial ledger entries linked to payments, refunds, expenses, and cash shifts
- `order_cancellations`: order, actor, authorizing admin when applicable, reason, timestamp
- `sync_receipts`: device and idempotency key, command type, server result, processed time

Mixed payment is represented by two or more payment rows whose sum equals the order total. Database constraints and the checkout function enforce the equality.

### 5.4 Attendance, cash shift, payroll, and finance tables

- `work_logs`: staff, check in, check out, source device, correction status, correction actor
- `shifts`: staff or drawer owner, opened and closed times, expected cash, actual cash, difference, note, review status
- `pay_rules`: effective dated hourly or monthly basis and bonus rules
- `payroll_periods`: shop, date range, status `draft|approved|paid`
- `payroll_lines`: employee, minutes worked, sales basis, base pay, bonus, adjustments, total, calculation snapshot
- `expense_categories`
- `expenses`: amount, category, occurrence time, note, attachment, creator, approval state
- `shop_settings`: receipt fields, cancellation policy, inactivity timeout, theme default, numbering rules

Do not calculate historical payroll from today’s mutable rules. Save effective dated rules and a calculation snapshot when a payroll period is approved.

### 5.5 Reporting objects and indexes

- Views for daily sales, payment mix, product performance, staff sales, attendance duration, shift variance, expenses, COGS, and profit
- Materialized monthly summaries only after query profiling shows the need
- Scheduled refresh with a visible `refreshed_at` value
- Composite indexes beginning with `shop_id` for common access paths such as `(shop_id, created_at)`, `(shop_id, status, created_at)`, `(shop_id, user_id, created_at)`, and `(shop_id, variant_id)`
- Unique constraints for shop SKU, barcode policy, order number, idempotency key, and one open work log or shift per applicable user

## 6. Security model

### 6.1 Required authorization matrix

| Capability | Staff | Admin |
|---|---:|---:|
| Sell and view own current shift orders | Yes | Yes |
| View product sale price and available stock | Yes | Yes |
| View product cost or profit | No | Yes |
| Check self in or out | Yes | Yes |
| View own current work session totals | Yes | Yes |
| View prior days, monthly totals, or other staff data | No | Yes |
| Close own cash shift | Yes | Yes |
| Approve or edit shift close | No | Yes |
| Cancel order | Policy dependent, reason required | Yes, reason required |
| Manage catalog, inventory, staff, pay, finance, settings | No | Yes |
| View reports | No | Yes |

### 6.2 Security implementation requirements

- Implement RLS policies from an explicit matrix for every table and Storage bucket.
- Test positive and negative access using real staff and admin JWTs.
- Put cost and aggregate finance behind admin only relations, not hidden UI fields.
- Make role changes, PIN resets, profile unlocks, cancellations, inventory adjustments, pay changes, exports, and device enrollment auditable.
- Enforce five failed PIN attempts within ten minutes, then a fifteen minute lock. Use a transaction or row lock so simultaneous requests cannot bypass the counter.
- Require the main admin password or a freshly verified admin credential to unlock a PIN profile.
- Default user inactivity timeout to ten minutes. Return to `/profiles`, preserving unsynced orders but clearing personal caches.
- Set secure, HttpOnly, SameSite cookies where the chosen auth flow permits. Protect state changing server routes against CSRF.
- Validate and normalize every server boundary. Rate limit login, PIN, cancellation authorization, export, and destructive admin commands.
- Never include PINs, auth tokens, cost data, or sensitive payroll fields in client logs or analytics.
- Scan dependencies and secrets in CI. Keep development, staging, and production Supabase projects separate.

### 6.3 Authentication proof of concept gate

Before feature work, prove the complete shared device flow:

1. Admin signs in and enrolls a device to one shop.
2. Device can list only active profiles for that shop and safe avatar metadata.
3. Staff selects a profile and submits a PIN to a server controlled endpoint.
4. The endpoint verifies the hash and lockout atomically.
5. Success creates a short lived session whose database identity resolves to that employee's `auth.uid()` and membership.
6. Failure exposes no account existence or secret detail and updates lockout state.
7. Inactivity or manual switch ends the employee session but preserves valid device enrollment.
8. A revoked device cannot list profiles or exchange a PIN.

Do not start broad UI implementation until this spike works under local Supabase and its mechanism is documented in `docs/adr/`.

## 7. Design system and interaction contract

### 7.1 Foundation

- Implement all supplied light and dark colors as semantic CSS variables at `:root` and the selected theme scope.
- Default to dark. Resolve preference in this order: user preference, shop default, dark fallback.
- Use Inter variable for interface text and JetBrains Mono or system monospace with tabular figures for money, time, and stock.
- Use the supplied 12, 14, 16, 20, 24, and 32 pixel scale, but keep mobile form text at least 16 pixels to prevent browser zoom.
- Use a 4 and 8 pixel spacing system, 12 pixel card radius, 16 pixel modal radius, and 10 pixel primary button radius.
- Define one hairline elevation and one raised elevation. Blur is reserved for modal separation.
- Define global z-index, motion, icon size, focus, shadow, safe area, and content width tokens.

### 7.2 Responsive navigation

- Phone: bottom navigation with no more than five labeled top level destinations appropriate to the role.
- Tablet and desktop: persistent sidebar plus a stable content header.
- Do not expose unavailable admin destinations to staff, but provide an explicit access denied page for direct URLs.
- Preserve cart, search, filter, and scroll state on predictable back navigation.
- Ensure fixed navigation and checkout bars reserve safe area and content padding.

### 7.3 Interaction quality gates

- One visually dominant action per screen.
- Minimum 44 by 44 pixel targets, with at least 8 pixels between adjacent targets.
- Visible focus in both themes; logical keyboard and screen reader order.
- Persistent labels on inputs, inline errors, first invalid field focus, and recovery instructions.
- Press feedback begins within 100 milliseconds. Micro interactions last 120 to 180 milliseconds; sheets and route level transitions last 200 to 280 milliseconds.
- Animate only transform and opacity. All motion is interruptible and removed or reduced under `prefers-reduced-motion`.
- Use skeletons shaped like the final content for waits above roughly 300 milliseconds.
- Empty states always offer a relevant next action. Errors state what happened, what was preserved, and what to do next.
- Never use color as the only status signal. Charts have a textual summary and table alternative.
- Validate at 320, 375, 768, 1024, and 1440 pixel widths, plus phone and tablet landscape, 200 percent zoom, and increased text size.

### 7.4 Critical screen behavior

- **Profile picker:** two columns on phones, up to six on tablets, square squircle avatars, names below, subtle add account item last. Selection scales briefly before revealing PIN without a hard navigation flash.
- **PIN pad:** semantic numeric controls, 4 to 6 digits, progressive dots, accessible status, shake animation only when motion is allowed, clear lockout countdown and admin recovery path.
- **POS:** search and category access remain reachable, product card shows price and stock status, cart total and checkout remain visible, adding an item is optimistic, and sync status is persistent but quiet.
- **Payment:** cash, transfer, and mixed modes use progressive disclosure. Mixed amounts must balance before submit. Prevent double submit.
- **Reports:** prioritize summary, trend, and exceptions. Use line charts for time trends and bar charts for product or staff comparison. Offer exact values and a table alternative.

## 8. Offline and synchronization design

### 8.1 Outbox contract

Each offline command contains:

- `idempotency_key`, a client generated UUID
- `device_id` and monotonically increasing local sequence
- `shop_id`, `actor_id`, and session evidence
- `occurred_at` and local timezone offset
- normalized order, item snapshot, and payment payload
- schema version, retry count, last error, and local status

Lifecycle: `draft -> pending_sync -> syncing -> synced` or `needs_attention`.

### 8.2 Sync rules

- Persist the completed order before showing success.
- The server processes checkout in one database transaction and records the idempotency key before returning.
- Replaying the same command returns the original result without duplicate order, payment, transaction, or inventory rows.
- Process a device outbox in sequence. Use bounded exponential backoff with jitter.
- Background Sync is an enhancement. Also retry when the app opens, regains focus, or receives an `online` event, and provide a manual retry action.
- Show an always understandable state: saved on device, syncing, synced, or needs attention.
- Keep unsynced orders across profile logout and app restart. Limit access to the enrolled device and authorized shop.
- Cache only the minimum catalog required to sell. Do not cache cost, payroll, or broad report data for staff.
- Service worker uses cache first or stale while revalidate for versioned static assets, network first for catalog, and never caches authenticated HTML or financial API responses indiscriminately.
- Activation of a new service worker must not discard an old outbox. Version and migrate IndexedDB deliberately.

### 8.3 Offline acceptance scenarios

- Lose the network before payment, complete a cash sale, reload the app, restore network, and receive exactly one server order.
- Submit repeatedly while connectivity flaps and still receive one order.
- Two offline devices sell the final unit; both sales remain recorded and an inventory reconciliation alert is raised.
- App update occurs with queued orders and the queue migrates without loss.
- Employee session expires with a queued order; the order remains visible as device pending data and sync resumes only after valid authorization.
- A server validation failure moves the item to `needs_attention` with a safe recovery flow and never silently deletes it.

## 9. Phased implementation backlog

Every phase ends with a working vertical slice, automated tests, updated documentation, and a demo against acceptance criteria.

### Phase 0: Product lock and technical spikes

**Goal:** remove the highest risk unknowns before building breadth.

- Create the Git repository, decision log, issue labels, environments, and branch protections.
- Confirm shop terminology, receipt fields, order numbering, VND rounding, tax and discount rules, salary rules, bonus formula, cancellation policy, and who owns a cash drawer.
- Create wireflows for login, profile switch, sale, mixed payment, offline state, cancellation, attendance, shift close, and admin review.
- Prove the shared device and PIN identity flow described in section 6.3.
- Prove a transactional `checkout_order` function with mixed payment and stock movement.
- Prove IndexedDB outbox replay and idempotency across reloads.
- Benchmark an empty production build and set CI budget baselines.

**Exit gate:** approved ADRs for authentication, command boundaries, offline conflict policy, shift model, and money rules; all three technical proofs pass.

### Phase 1: Project foundation and continuous delivery

**Goal:** establish a deployable, observable skeleton.

- Scaffold Next.js with strict TypeScript, linting, formatting, path aliases, environment validation, and generated Supabase types.
- Configure Tailwind, Shadcn primitives, semantic tokens, fonts, SVG icons, themes, reduced motion, focus, and responsive shells.
- Create local, staging, and production Supabase configuration and migration workflow.
- Add CI for type check, lint, unit tests, SQL tests, build, bundle budgets, accessibility smoke, and Playwright smoke.
- Add structured error reporting, request IDs, privacy filtering, health checks, and a minimal operational dashboard.
- Implement role aware navigation, loading, empty, error, access denied, and not found foundations.

**Exit gate:** every merge produces a preview or staging build; dark and light shells work at all target widths; no secret reaches the client bundle.

### Phase 2: Database, RLS, and identity

**Goal:** deliver a secure multi tenant core.

- Implement identity, shop, membership, preference, PIN, device, avatar, audit, catalog, inventory, sales, work, shift, payroll, finance, and settings migrations.
- Add constraints, indexes, archive behavior, updated timestamps, and seed fixtures.
- Implement and test RLS and Storage policies for staff, admin, cross shop denial, inactive users, and revoked devices.
- Build full login, device enrollment, profile picker, PIN pad, lockout, profile unlock, inactivity timeout, logout, and profile switch.
- Implement theme preference persistence and avatar crop and upload.

**Exit gate:** the authorization matrix is covered by automated negative tests; profile switching meets the three second target on staging; lockout is race safe.

### Phase 3: Online POS and receipt vertical slice

**Goal:** sell, persist, view, and print a correct order while online.

- Build product search, categories, barcode input hook, stock state, variant selection, cart editing, totals, and optimistic interaction.
- Build payment flow for cash, bank transfer, and mixed payment.
- Implement transactional checkout, immutable item snapshots, payment rows, financial ledger rows, inventory decrement, and audit data.
- Add order success, order details, browser receipt view, print CSS for common receipt widths, and shop receipt settings.
- Add retry safe loading behavior and prevent double submit.
- Unit test all money calculations and property test invariants such as payment sum equals total.

**Exit gate:** a seeded staff account completes and prints all three payment types; database invariants hold under concurrent submissions.

### Phase 4: Offline POS and PWA

**Goal:** make the sales path resilient on real mobile browsers.

- Implement versioned IndexedDB catalog cache, cart recovery, outbox, retry scheduler, and reconciliation UI.
- Add the idempotent sync endpoint and server receipts.
- Configure manifest, icons, install behavior, service worker strategies, update UX, offline fallback, and dynamic browser theme colors.
- Add network quality and offline indicators without disruptive repeated toasts.
- Test browser restart, device sleep, connectivity flapping, app update, duplicate replay, conflict, and outbox migration.

**Exit gate:** all scenarios in section 8.3 pass on Chromium and a representative iOS/WebKit path; installability audit passes.

### Phase 5: Cancellation, attendance, and cash shifts

**Goal:** complete the staff daily operating loop.

- Implement order search and detail within staff scope.
- Implement online atomic cancellation, mandatory reason, admin authorization or configured staff permission, inventory reversal, ledger reversal, and audit trail.
- Implement check in, current session duration, check out, duplicate prevention, and admin correction workflow.
- Implement shift opening, expected cash from cash ledger, actual cash entry, variance, note rules, submission, admin review, and immutable approval history.
- Show only current personal shift revenue to staff.

**Exit gate:** a staff member can sign in, check in, sell, cancel with the correct policy, close a shift, check out, and switch profile; totals reconcile from ledger data.

### Phase 6: Catalog, inventory, and staff administration

**Goal:** let an admin configure and operate the shop without database access.

- Build product, variant, category, image, SKU, barcode, pricing, archive, and bulk status workflows.
- Build stock overview, movement history, low or negative stock alerts, and reasoned adjustments through a transaction.
- Build staff creation or invitation, role and status, PIN set or reset, profile unlock, avatar, inactivity setting, cancellation permission, and device revocation.
- Build staff detail with attendance, sales, pay rule history, and safe corrections.
- Virtualize lists only when measured row counts justify it; retain accessible table semantics and a mobile card alternative.

**Exit gate:** an admin can set up a new product and employee, adjust stock with an audit trail, revoke a device, and deactivate an employee without corrupting historical data.

### Phase 7: Finance, payroll, reports, and settings

**Goal:** deliver the management and decision making layer.

- Build expense categories and expense entry, edit policy, approval state, attachments, and ledger integration.
- Implement effective dated pay rules, draft payroll calculation, admin adjustments with reason, approval snapshot, paid state, and export.
- Build day, week, and month revenue, COGS, gross profit, expenses, operating result, payment mix, shift variance, top products, and staff performance.
- Add accessible trend and comparison charts, exact tooltips, summaries, empty states, and table or CSV alternatives.
- Profile report queries; add materialized views and scheduled refresh only where necessary.
- Build shop identity, receipt template, numbering, theme default, session timeout, cancellation policy, device management, and backup or export settings.
- Implement scoped CSV or JSON exports plus documented provider backup and restore process.

**Exit gate:** report totals reconcile to ledger and order fixtures; staff cannot reach any report data; a backup restoration rehearsal succeeds in staging.

### Phase 8: Hardening, launch, and handover

**Goal:** prove the system is supportable under production conditions.

- Run full RLS, abuse, session, CSRF, XSS, upload, rate limit, and dependency security review.
- Run concurrency, month end volume, slow query, offline queue, and degraded network tests.
- Audit bundle size, image and font loading, Core Web Vitals, route splitting, caching, and render cost.
- Complete accessibility review with keyboard, screen reader, reduced motion, 200 percent zoom, dark and light contrast, and chart alternatives.
- Test receipt printers through browser print on the actual target devices and paper sizes.
- Run user acceptance sessions with at least one new staff member and one admin. Measure time to first sale and profile switching.
- Prepare migration, release, rollback, incident, credential rotation, device replacement, stuck outbox, and restore runbooks.
- Seed production configuration, train admins, perform a limited pilot, resolve launch blockers, then roll out.

**Exit gate:** all launch success criteria pass, no severity one or two issue remains open, rollback and restore are rehearsed, and the product owner signs off.

## 10. Testing strategy

### 10.1 Test pyramid

- **Unit:** currency calculations, discounts, payment allocation, wage and bonus rules, date and timezone handling, outbox transitions, permission helpers, validation schemas.
- **Database:** constraints, indexes, checkout transaction, cancellation reversal, shift calculation, report views, idempotency, concurrent inventory updates.
- **RLS:** every table with anonymous, device only, staff self, other staff, admin same shop, admin other shop, inactive user, and revoked device cases.
- **Component:** PIN pad, product card, cart, payment split, theme switch, forms, tables, charts, empty and error states.
- **End to end:** all role journeys, direct URL denial, profile timeout, each payment method, print, cancellation, attendance, shift close, admin CRUD, reports, export, and backup controls.
- **Offline:** use deterministic network toggles and server request counting to prove exactly once effects.
- **Visual and responsive:** targeted screenshots for critical screens in both themes and target widths. Review changes, do not blindly accept snapshots.
- **Accessibility:** automated axe checks plus manual keyboard and screen reader passes for critical flows.
- **Performance:** Lighthouse CI, bundle analyzer, query explain plans, and user timing around add to cart and checkout feedback.

### 10.2 Required financial invariants

- `order.total = sum(order_items.line_total)` after valid discounts and rounding.
- `sum(payments.amount) = order.total` for a completed order.
- Each completed order has one balanced set of financial ledger entries.
- Each stock affecting order item has one corresponding movement; cancellation has one inverse movement.
- A cancelled order cannot be cancelled again.
- The same idempotency key can never create a second financial or inventory effect.
- Expected shift cash derives only from opening cash and posted cash ledger movements in the shift window.
- Approved payroll and historical order snapshots do not change when source configuration changes.

## 11. Performance and reliability budgets

| Budget | Gate |
|---|---|
| Initial compressed JavaScript | Under 180 KB for the staff POS entry path, measured consistently in CI |
| Initial transfer | Under 1 MB including critical fonts and icons on the defined fixture |
| LCP | Under 2.0 seconds on agreed mid tier mobile and 4G profile |
| POS interactive | Under 2.5 seconds on the same profile |
| CLS | Under 0.1 |
| Input feedback | Visible within 100 milliseconds |
| Animation | No long main thread task attributable to decorative animation; transform and opacity only |
| Database | No unbounded table scan on launch report and POS access paths |
| Sync | Exactly once database effects for repeated outbox delivery |

Measure budgets from the first vertical slice. Do not postpone performance work to Phase 8.

## 12. Delivery estimate and critical path

Estimate assumes two experienced full stack engineers, a product or UI designer at roughly half time through Phase 5, and QA support increasing from Phase 3. It also assumes prompt answers to business rule questions and access to target mobile devices and receipt printers.

| Phase | Expected calendar time | Primary dependency |
|---|---:|---|
| 0. Product lock and spikes | 1 to 2 weeks | stakeholder decisions and Supabase proof |
| 1. Foundation | 1 to 2 weeks | Phase 0 architecture |
| 2. Data, RLS, identity | 2 to 3 weeks | auth proof and schema approval |
| 3. Online POS and receipt | 2 to 3 weeks | secure identity and catalog schema |
| 4. Offline POS and PWA | 2 to 3 weeks | stable checkout contract |
| 5. Cancellation, attendance, shifts | 2 weeks | order ledger and identity |
| 6. Admin catalog, inventory, staff | 2 to 3 weeks | core tables and audit pattern |
| 7. Finance, payroll, reports, settings | 3 to 4 weeks | stable transactional data |
| 8. Hardening and launch | 2 weeks | feature complete release candidate |

Some work overlaps after Phase 2. A realistic target is **16 to 20 calendar weeks** for the stated team, including pilot and hardening. A solo implementation is more realistically **28 to 36 weeks**. Reestimate after Phase 0 because payroll rules, authentication mechanics, offline conflict handling, and receipt hardware can materially change effort.

Critical path:

```text
business rules
  -> employee identity and RLS
  -> transactional online checkout
  -> idempotent offline sync
  -> immutable ledger and inventory history
  -> shifts, payroll, and reports
  -> reconciliation, security, performance, pilot
```

## 13. Project control and release policy

- Organize work as vertical user outcomes, not separate frontend and backend silos.
- Each ticket states role, preconditions, happy path, failure and empty states, offline behavior, audit requirement, analytics or observability, and test cases.
- Require database migration review for all schema or policy changes.
- Use feature flags for unfinished admin modules and risky sync changes. Never flag away database integrity or security checks.
- Promote the same artifact from staging to production. Apply backward compatible migrations before code that depends on them.
- Keep a release checklist and changelog. Define rollback for code, schema, and service worker versions.
- Treat incorrect totals, duplicate transactions, lost offline orders, cross tenant access, PIN exposure, and broken inventory reversal as launch blocking severity one defects.

## 14. Definition of done

A feature is done only when:

- Product behavior and permissions match an approved acceptance scenario.
- Loading, empty, error, retry, disabled, offline, and permission denied states are implemented where applicable.
- Mobile, tablet, desktop, dark, light, keyboard, and reduced motion behavior is verified.
- Touch targets, contrast, labels, focus management, and screen reader announcements pass the relevant checks.
- Server validation, RLS, transactional integrity, audit logging, and rate limiting are present where required.
- Unit, database, RLS, component, and end to end coverage appropriate to the risk is green.
- Performance budgets and query plans have not regressed.
- No secrets or sensitive data appear in client bundles, logs, screenshots, fixtures, or analytics.
- Documentation, generated database types, migrations, and runbooks are current.
- The functionality is deployed to staging and accepted by the product owner.

The project is complete only when every Phase 8 exit criterion and every launch success criterion in section 2 is satisfied on production equivalent infrastructure.

## 15. Decisions required before Phase 0 can close

These are product decisions, not reasons to delay initial setup. Track them immediately and obtain explicit answers during Phase 0:

1. Are discounts supported, and if so are they line level, order level, fixed amount, percentage, or role restricted?
2. Are prices tax inclusive, and is any tax invoice behavior required?
3. Is a shift owned by one employee, one physical cash drawer, or a group of employees?
4. What opening cash is entered, and who may correct a submitted or approved closing?
5. What exact wage and bonus formulas apply, including effective dates, overtime, breaks, and manual adjustments?
6. Does an offline sale allow stock below zero, or must selected products be blocked from offline selling?
7. What receipt widths, printers, logo, legal fields, and order numbering format are required?
8. Does phone login mean phone plus password, SMS verification, or both?
9. How long may a device remain enrolled, and what is the recovery process for a lost device?
10. What backup retention, export format, restore time, and data retention rules are required?
11. Are returns, exchanges, customer records, loyalty, supplier purchasing, and multi location transfers explicitly out of scope for the first launch?
12. Which devices and browsers are the supported production matrix?

Until answered, use the assumptions in section 3 and avoid implementing speculative features beyond the two supplied blueprints.
