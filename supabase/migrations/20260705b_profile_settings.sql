-- ============================================================================
-- Per-Profile App Settings
-- ----------------------------------------------------------------------------
-- Subtitle/playback/language/autoplay preferences currently live on
-- `user_settings` (one row per ACCOUNT). Netflix scopes these per PROFILE —
-- each profile keeps its own subtitle style, language, and autoplay choices.
-- This adds a `profile_settings` table keyed by profile_id and leaves
-- `user_settings` untouched as a legacy fallback for pre-migration reads.
--
-- SAFETY: Additive and idempotent. Creates one new table; touches no
-- existing data. Safe to run once or re-run.
-- ============================================================================

create table if not exists public.profile_settings (
  profile_id            uuid primary key references public.profiles (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,
  display_language      text,
  audio_language        text,
  subtitle_language      text,
  show_subtitles        boolean,
  subtitle_size         text,
  subtitle_bg_opacity   integer,
  subtitle_color        text,
  subtitle_bg_color     text,
  autoplay_previews     boolean,
  autoplay_next_episode boolean,
  autoplay_video        boolean,
  show_new_content_badges boolean,
  updated_at            timestamptz not null default now()
);

create index if not exists profile_settings_user_id_idx on public.profile_settings (user_id);

alter table public.profile_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_settings' and policyname='profile_settings_select_own') then
    create policy profile_settings_select_own on public.profile_settings for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_settings' and policyname='profile_settings_upsert_own') then
    create policy profile_settings_upsert_own on public.profile_settings for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_settings' and policyname='profile_settings_update_own') then
    create policy profile_settings_update_own on public.profile_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_settings' and policyname='profile_settings_delete_own') then
    create policy profile_settings_delete_own on public.profile_settings for delete using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profile_settings'
    ) then
      alter publication supabase_realtime add table public.profile_settings;
    end if;
  end if;
end $$;
