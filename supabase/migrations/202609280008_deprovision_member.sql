-- Fix FK constraints to allow safe staff deletion.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Strategy:
--   • members + staff_pins + user_preferences: ON DELETE CASCADE from auth.users
--   • inventory_movements + expenses: actor_id becomes nullable + ON DELETE SET NULL
--   • audit_logs + orders.cancelled_by: already nullable, add ON DELETE SET NULL
--   • device_sessions.enrolled_by: ON DELETE SET NULL
--
-- After this migration, server-side code can:
--   1. Guard-check orders/shifts (no financial data loss)
--   2. Delete member + staff_pins rows manually
--   3. Call auth.admin.deleteUser() — no FK will block it

-- ── members ──────────────────────────────────────────────────────────────
alter table public.members
  drop constraint if exists members_id_fkey,
  add  constraint members_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;

-- ── staff_pins ───────────────────────────────────────────────────────────
alter table public.staff_pins
  drop constraint if exists staff_pins_user_id_fkey,
  add  constraint staff_pins_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

-- ── user_preferences ─────────────────────────────────────────────────────
alter table public.user_preferences
  drop constraint if exists user_preferences_user_id_fkey,
  add  constraint user_preferences_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

-- ── inventory_movements.actor_id ─────────────────────────────────────────
alter table public.inventory_movements
  alter column actor_id drop not null;
alter table public.inventory_movements
  drop constraint if exists inventory_movements_actor_id_fkey,
  add  constraint inventory_movements_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete set null;

-- ── expenses.actor_id ────────────────────────────────────────────────────
alter table public.expenses
  alter column actor_id drop not null;
alter table public.expenses
  drop constraint if exists expenses_actor_id_fkey,
  add  constraint expenses_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete set null;

-- ── audit_logs.actor_id (already nullable) ───────────────────────────────
alter table public.audit_logs
  drop constraint if exists audit_logs_actor_id_fkey,
  add  constraint audit_logs_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete set null;

-- ── orders.cancelled_by (already nullable) ───────────────────────────────
alter table public.orders
  drop constraint if exists orders_cancelled_by_fkey,
  add  constraint orders_cancelled_by_fkey
    foreign key (cancelled_by) references auth.users(id) on delete set null;

-- ── device_sessions.enrolled_by ──────────────────────────────────────────
alter table public.device_sessions
  drop constraint if exists device_sessions_enrolled_by_fkey,
  add  constraint device_sessions_enrolled_by_fkey
    foreign key (enrolled_by) references auth.users(id) on delete set null;

-- Make enrolled_by nullable to allow SET NULL
alter table public.device_sessions
  alter column enrolled_by drop not null;
