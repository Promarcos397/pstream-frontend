-- ============================================================================
-- Multi-Profile Support ("Who's Watching?")
-- ----------------------------------------------------------------------------
-- Adds Netflix-style profiles under each account. Per-profile Continue Watching,
-- My List, and ratings (which drive the taste engine).
--
-- SAFETY: This migration is ADDITIVE and IDEMPOTENT. It never drops a data
-- column and never deletes a row. It is safe to run once, and safe to re-run
-- (every step is guarded). Run it in the Supabase SQL Editor BEFORE deploying
-- the matching front-end build.
--
-- What it does:
--   1. Creates `public.profiles` (id, user_id, name, avatar_url, is_kids, pin, ...)
--   2. Adds a nullable `profile_id` to watch_history / user_ratings / user_list
--   3. Backfills exactly one "default" profile per existing user and stamps
--      every existing row with that profile_id (no data is stranded)
--   4. Rebuilds the per-table unique constraints to include profile_id so two
--      profiles can each track the same title independently
--   5. Enables RLS on `profiles` with the same auth.uid() = user_id policy the
--      existing tables already use
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Preconditions. Abort BEFORE touching anything if the server can't support
--    the profile-scoped unique indexes below (NULLS NOT DISTINCT is PG15+).
--    Failing here is safe — no table has been altered yet. Failing later, after
--    the old unique constraints were dropped, would leave a data-integrity hole.
-- ---------------------------------------------------------------------------
do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception
      'Multi-profile migration requires PostgreSQL 15+ (NULLS NOT DISTINCT). Detected %. Aborting before any change.',
      current_setting('server_version');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. profiles table
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null,
  avatar_url  text,
  is_kids     boolean     not null default false,
  is_default  boolean     not null default false, -- ships-with-the-account profile (the Kids one); undeletable
  pin         text,                              -- 4-digit profile lock; null = no lock
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Idempotency: if an earlier revision of this migration already created the
-- table without is_default, add it in place.
alter table public.profiles add column if not exists is_default boolean not null default false;

create index if not exists profiles_user_id_idx on public.profiles (user_id);

-- A user can have at most a handful of profiles; enforce a sane ceiling and
-- unique names per account (matches Netflix behaviour).
create unique index if not exists profiles_user_name_uq
  on public.profiles (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- 2. profile_id columns on the per-profile data tables (nullable for backfill)
-- ---------------------------------------------------------------------------
alter table public.watch_history add column if not exists profile_id uuid
  references public.profiles (id) on delete cascade;
alter table public.user_ratings  add column if not exists profile_id uuid
  references public.profiles (id) on delete cascade;
alter table public.user_list     add column if not exists profile_id uuid
  references public.profiles (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Backfill: one default profile per existing user, then stamp every row.
-- ---------------------------------------------------------------------------
-- Create the default profile for every user that has ANY data or a settings row
-- but does not yet have a profile. Name from auth metadata when available,
-- avatar from the user's existing settings row.
insert into public.profiles (user_id, name, avatar_url, sort_order)
select
  u.user_id,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
    'Profile 1'
  ) as name,
  us.avatar_url,
  0 as sort_order
from (
  select user_id from public.user_settings where user_id is not null
  union
  select user_id from public.watch_history where user_id is not null
  union
  select user_id from public.user_ratings  where user_id is not null
  union
  select user_id from public.user_list     where user_id is not null
) u
left join auth.users          au on au.id = u.user_id
left join public.user_settings us on us.user_id = u.user_id
where not exists (
  select 1 from public.profiles p where p.user_id = u.user_id
);

-- Every account also gets a default Kids profile (mirrors the app's client-side
-- auto-create in useProfileStore.loadProfiles(), so the DB stays consistent even
-- for users who haven't opened the app since this change). Idempotent: guarded on
-- "no is_kids profile yet" and skipped at the 5-profile cap so it can never evict
-- an existing profile. sort_order is placed after all of a user's current
-- profiles so it never becomes the "default" target the stamping step below
-- picks (that step orders by sort_order asc, then created_at asc).
insert into public.profiles (user_id, name, is_kids, is_default, sort_order)
select
  p.user_id,
  'Kids',
  true,
  true, -- ships with the account; the delete RLS policy below refuses to remove it
  coalesce((select max(p2.sort_order) + 1 from public.profiles p2 where p2.user_id = p.user_id), 0)
from (select distinct user_id from public.profiles) p
where not exists (
  select 1 from public.profiles k where k.user_id = p.user_id and k.is_kids = true
)
and (
  select count(*) from public.profiles c where c.user_id = p.user_id
) < 5
on conflict (user_id, lower(name)) do nothing;

-- Stamp existing rows with that user's (lowest sort_order, oldest) default profile.
with default_profile as (
  select distinct on (user_id) user_id, id
  from public.profiles
  order by user_id, sort_order asc, created_at asc
)
update public.watch_history wh
set profile_id = dp.id
from default_profile dp
where wh.user_id = dp.user_id and wh.profile_id is null;

with default_profile as (
  select distinct on (user_id) user_id, id
  from public.profiles
  order by user_id, sort_order asc, created_at asc
)
update public.user_ratings ur
set profile_id = dp.id
from default_profile dp
where ur.user_id = dp.user_id and ur.profile_id is null;

with default_profile as (
  select distinct on (user_id) user_id, id
  from public.profiles
  order by user_id, sort_order asc, created_at asc
)
update public.user_list ul
set profile_id = dp.id
from default_profile dp
where ul.user_id = dp.user_id and ul.profile_id is null;

-- ---------------------------------------------------------------------------
-- 4. Rebuild unique constraints to include profile_id.
--    Old constraints keyed on (user_id, tmdb_id[, season, episode]); the new
--    ones add profile_id so each profile tracks titles independently.
--
--    ORDER MATTERS: we CREATE the new profile-scoped unique indexes FIRST, then
--    drop the old ones. There is never a moment where a table has no unique
--    constraint — so even if creation somehow failed, nothing has been dropped
--    and existing dedup guarantees stay intact. Rows were already stamped with a
--    profile_id in step 3, so the new indexes can't hit a duplicate on creation.
--    NULLS NOT DISTINCT keeps movie rows (null season/episode) deduping.
-- ---------------------------------------------------------------------------

-- 4a. Create the new profile-scoped unique indexes. These match the onConflict
--     targets the app uses (user_id,profile_id,tmdb_id[,season,episode]).
create unique index if not exists watch_history_profile_uq
  on public.watch_history (user_id, profile_id, tmdb_id, season, episode) nulls not distinct;
create unique index if not exists user_ratings_profile_uq
  on public.user_ratings (user_id, profile_id, tmdb_id) nulls not distinct;
create unique index if not exists user_list_profile_uq
  on public.user_list (user_id, profile_id, tmdb_id) nulls not distinct;

create index if not exists watch_history_profile_id_idx on public.watch_history (profile_id);
create index if not exists user_ratings_profile_id_idx  on public.user_ratings (profile_id);
create index if not exists user_list_profile_id_idx     on public.user_list (profile_id);

-- 4b. Only now drop the OLD unique constraints/indexes that lack profile_id.
--     (Guarded so we never drop the profile-scoped ones we just created.)
do $$
declare
  r record;
begin
  -- Constraint-backed uniques first.
  for r in
    select c.conname, t.relname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and c.contype = 'u'
      and t.relname in ('watch_history', 'user_ratings', 'user_list')
      and not exists (
        select 1
        from unnest(c.conkey) ck
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = ck
        where a.attname = 'profile_id'
      )
  loop
    execute format('alter table public.%I drop constraint %I', r.relname, r.conname);
  end loop;

  -- Stand-alone unique indexes (not backed by a constraint) that lack profile_id.
  for r in
    select i.relname as idxname
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and x.indisunique
      and not x.indisprimary
      and t.relname in ('watch_history', 'user_ratings', 'user_list')
      and i.relname not in ('watch_history_profile_uq', 'user_ratings_profile_uq', 'user_list_profile_uq')
      and not exists (select 1 from pg_constraint c where c.conindid = x.indexrelid)
      and not exists (
        select 1
        from unnest(x.indkey) ik
        join pg_attribute a on a.attrelid = x.indrelid and a.attnum = ik
        where a.attname = 'profile_id'
      )
  loop
    execute format('drop index if exists public.%I', r.idxname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. RLS on profiles (mirror the auth.uid() = user_id policy of existing tables)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    create policy profiles_select_own on public.profiles for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own') then
    create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    create policy profiles_update_own on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  -- Delete excludes is_default rows: the account's built-in Kids profile can
  -- never be removed, even by a hand-crafted API call. (Drop + recreate so a
  -- re-run upgrades the policy from the earlier revision without the guard.)
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_delete_own') then
    drop policy profiles_delete_own on public.profiles;
  end if;
  create policy profiles_delete_own on public.profiles
    for delete using (auth.uid() = user_id and not is_default);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Realtime: include profiles in the supabase_realtime publication so the
--    app receives live profile create/edit/delete events like the other tables.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;
  end if;
end $$;

-- Done. `profile_id` is intentionally left NULLABLE so the previous front-end
-- build keeps working during rollout; the new build always writes it.
