# Operations and release runbook

## Configure and launch

Use separate Supabase projects for staging and production. Apply every SQL migration in filename order. Bootstrap the initial admin with the supplied SQL, then configure the three keys from .env.example in the deployment environment. Build with Node 24 using npm ci and npm run build. Serve with npm start behind HTTPS. Never publish the service role key.

First verify email login, profile PIN exchange, device revocation and image upload on staging. Each created staff account has a random password and an assigned PIN; staff can use the provider's password recovery flow if direct email login is required. PIN resets and unlocks require the admin's main password.

## Backups and restore

Operational exports omit authentication secrets and are not disaster recovery backups. Configure Supabase managed database backups with a retention period appropriate to the shop. Back up Storage objects separately; database backups alone do not contain uploaded image bytes. Record project references and restore ownership with the shop owner.

Before launch, restore a backup into an isolated staging project, restore Storage objects, configure new keys, and check counts of orders, payments, inventory movements, staff, payroll periods and expenses. Reconcile a sampled shift and sale. Verify that old enrolled devices cannot access the restored project. Record the restore duration and timestamp; never rehearse restoration over the live project.

## Offline orders

An order is persisted to IndexedDB before transmission. A stable ID makes retries idempotent. Foreground retries and supported browser background sync use the same outbox. Do not clear browser storage, uninstall the PWA, or reset the counter device while orders remain pending.

Only the original employee's session automatically syncs its orders. A manager can reconcile any pending order from the same shop in Settings. Reconciliation validates the original seller and shift, preserves amounts actually received, stores a reason, and reopens review of a closed cash shift. Changed catalog prices are never silently accepted through a staff offline flag.

If storage has been cleared before synchronization, recovery is not guaranteed. Use reliable managed counter devices, retain receipts, and investigate any missing sequence promptly.

## Payroll

Pay rules have effective timestamps. A work session crossing a rule change is split between rates. Preview payroll, enter reasoned adjustments, and approve a non-overlapping date range. Approval stores an immutable calculation snapshot. Payment marking is a separate action.

Approved periods lock attendance corrections and retroactive pay rule changes. Later operational corrections must be reviewed for a compensating payroll adjustment in a subsequent period. A payroll record marked paid does not initiate a bank transfer.

## Release and rollback

Run lint, type checking, all unit/PostgreSQL tests, production build and browser smoke tests. Validate the manifest, offline reload, pending queue retention, both themes and receipt print preview. Review migration SQL before applying it.

Keep database changes additive. Deploy migrations before code that depends on them. Roll back application code to a compatible artifact; do not drop transaction tables or rewind committed sales. Workbox waits before activating a new worker so open counters retain their running version; synchronize outboxes before reloading for an update.

## Physical acceptance

Test on the shop's Android and iOS devices, intended browsers and actual receipt printer. Check cash, transfer and mixed sales; cancellation; two devices competing for stock; network loss during payment; profile inactivity lock; and a complete shift close. Measure first-sale usability, profile-switch duration and Lighthouse budgets on the agreed hardware and network. These require access to the real environment and cannot be certified from a local browser.

