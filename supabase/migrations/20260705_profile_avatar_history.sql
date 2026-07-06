-- ============================================================================
-- Profile Avatar History
-- ----------------------------------------------------------------------------
-- Adds a per-profile "recently used" list of avatar icons, shown in a
-- "History" row on the mobile Choose Icon page (mirrors Netflix's picker).
--
-- SAFETY: Additive and idempotent — one nullable-with-default column, no
-- existing data touched. Safe to run once or re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_history text[] not null default '{}';
