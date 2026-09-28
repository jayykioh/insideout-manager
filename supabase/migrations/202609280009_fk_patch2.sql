-- Patch 2: missing FK fixes discovered from Supabase error logs.
-- Run this in Supabase SQL Editor after the previous migration.

-- ── pay_rules.(shop_id, user_id) → members(shop_id, id) ─────────────────
-- pay_rules are salary history tied to a member; cascade-delete them when member is removed.
alter table public.pay_rules
  drop constraint if exists pay_rules_shop_id_user_id_fkey,
  add  constraint pay_rules_shop_id_user_id_fkey
    foreign key (shop_id, user_id) references public.members(shop_id, id) on delete cascade;

-- ── payroll_periods.approved_by → auth.users(id) ─────────────────────────
alter table public.payroll_periods
  alter column approved_by drop not null;
alter table public.payroll_periods
  drop constraint if exists payroll_periods_approved_by_fkey,
  add  constraint payroll_periods_approved_by_fkey
    foreign key (approved_by) references auth.users(id) on delete set null;

-- ── order_resolutions.actor_id → auth.users(id) ──────────────────────────
alter table public.order_resolutions
  drop constraint if exists order_resolutions_actor_id_fkey,
  add  constraint order_resolutions_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.order_resolutions
  alter column actor_id drop not null;
