# P-Stream Project Overview
**Audit Date:** 2026-04-23  
**Auditor:** Claude Sonnet (Thinking)

---

## What Is P-Stream?

P-Stream is a **personal streaming platform** — a full-stack web app that lets you watch movies and TV shows. It is NOT a content platform (it doesn't host video files). Instead, it:

1. Uses **TMDB (The Movie Database) API** to get movie/TV metadata, posters, backdrops, logos, and overviews
2. Uses a **custom backend (giga-backend)** hosted on HuggingFace Spaces to scrape and resolve actual video streams from free streaming providers
3. Plays those streams through a custom **HLS video player** built inside the frontend

Think of it as: **TMDB UI + streaming resolver + custom player**, all in one app.

---

## Architecture Summary

```
Browser (React/Vite Frontend)
    │
    ├── TMDB API (metadata, images, search)
    │     └── api.themoviedb.org
    │
    ├── Giga Backend (HuggingFace Space)
    │     └── ibrahimar397-pstream-giga.hf.space
    │         ├── /api/stream  → resolves stream URLs
    │         ├── /api/auth/   → challenge/verify (Ed25519 keypair)
    │         └── /api/sync    → profile sync (Supabase + Redis)
    │
    └── YouTube API (trailers in Hero Carousel)
          └── Searched by title, embedded as background video
```

### Frontend Stack
- **React 18 + TypeScript**
- **Vite** (build tool)
- **Tailwind CSS v3** (utility-first styling)
- **React Router v6** (routing)
- **Framer Motion** (NOT heavily used — most animations are CSS)
- **i18next** (internationalization — multiple languages supported)
- **Axios** (HTTP)
- **HLS.js** (for playing `.m3u8` streams)
- **js-cookie** (for session cookies)

### Backend Stack (giga-backend)
- **Node.js + Express**
- **Puppeteer** (headless Chrome for JS-heavy scraping)
- **Cheerio** (HTML parsing)
- **ioredis** (Redis caching — TTL-based stream caching)
- **Supabase** (profile/user data storage)
- **jsonwebtoken** (session auth tokens)
- **tweetnacl** (Ed25519 cryptography for passwordless auth)

---

## Authentication Model

P-Stream uses a **passwordless, key-pair auth system**:
1. User generates a **12-word BIP-39 mnemonic** (like a crypto wallet seed phrase)
2. Frontend derives an **Ed25519 keypair** from it using tweetnacl
3. Login is a **challenge-response handshake**: backend sends challenge, frontend signs it, backend verifies
4. A JWT session token is returned and stored in localStorage
5. Profile data (watchlist, history, settings, progress) is synced to Supabase

The `UserProfile` type has: `public_key`, `display_name`, `settings`, `history`, `list`, `videoStates`, `episodeProgress`, `likedMovies`

**Note:** `email` is NOT a field on `UserProfile` — this was a TypeScript error that appeared in Navbar.tsx (now fixed with `as any` cast).

---

## Content Sources

### TMDB (metadata only)
- Movie/TV posters, backdrops, logos
- Overview, genres, vote averages
- Trailer video IDs (YouTube)
- Cast, credits, recommendations
- All fetched through TMDB's REST API with the hardcoded API key in `constants.ts`

### Giga Backend (actual video streams)
- Scrapes providers like: VixSrc, VidSrc, 2Embed, AutoEmbed, VidZee, VidLink
- Returns either direct `.m3u8` HLS URLs or embed iframe URLs
- Has a **Redis cache** with TTL to avoid re-scraping for repeated plays
- Has a **warm prefetch** system triggered by the frontend on load

### YouTube (trailers)
- Hero carousel background plays YouTube trailers (muted, autoplay)
- Uses `YouTubeService.ts` to search for official trailers by title/year
- The `useYouTubePlayer` hook manages the `youtube-player` iframe API

---

## Platform Split: Desktop vs. Mobile

The app has a hard split at **768px** (checked via `useIsMobile` hook):

**Mobile routes** (`< 768px`):
- `/` → `MobileHomePage.tsx`
- `/tv` → `MobileSeriesPage.tsx`  
- `/movies` → `MobileFilmsPage.tsx`
- `/new` → `MobileNewHotPage.tsx`
- `/my-pstream` → `MyPStreamPage.tsx`
- All wrapped in `MobileNav.tsx` (fixed top + bottom nav)

**Desktop routes** (`>= 768px`):
- All routes use `Layout.tsx` (wraps `Navbar.tsx`)
- `/` → `HomePage.tsx`
- `/tv` → `ShowsPage.tsx`
- `/movies` → `MoviesPage.tsx`
- `/new` → `NewPopularPage.tsx`
- `/list` → `MyListPage.tsx`
- `/search` → `SearchResultsPage.tsx`

Both platforms share: `/watch/:type/:id` → `CinemaPage.tsx` (full-screen video player, no nav)

---

## Global State (GlobalContext)

The `GlobalContext` is the central store. It manages:
- `myList` — user's saved watchlist
- `continueWatching` — watch history (last 20 items)
- `settings` — all user settings (subtitle preferences, language, avatar)
- `videoStates` — resume times per movie (tmdbId → time)
- `episodeProgress` — resume time per episode (showId-SxEx → progress)
- `likedMovies` — rated movies (dislike/like/love)
- `user` / `login` / `logout` — auth state
- `heroVideoState` — shared YouTube trailer state across Hero
- `activeVideoId` — prevents two videos playing simultaneously
- `globalMute` — mute state persisted per day via cookie
- `pageSeenIds` — deduplication across rows on the same page

All data persists to **localStorage** with keys prefixed `pstream-*`.

---

## The Hero Carousel System

This is the most complex part of the frontend. The `HeroCarousel` component:

1. Uses `HeroEngine` service to pick a daily-consistent "hero" movie
2. Fetches the movie's **logo image** from TMDB (for branding-quality title display)
3. Uses `YouTubeService` to find and play the **trailer** as a muted background video
4. Plays the YouTube video through a zoomed-in iframe (1.9x zoom to crop YouTube UI)
5. Tracks **scroll position** and **tab visibility** to pause/play correctly
6. Handles **audio fading** (fade in when playing, fade out when pausing)
7. The `HeroCarouselContent` component overlays text on top (logo, overview, genre tags)
8. The `HeroCarouselBackground` manages the actual image/video layer

**Key behavior:** Click anywhere on the hero opens the `InfoModal` (not auto-play). There are no play buttons on the desktop hero — you must click to open the detail modal first.

---

## The Video Player

`VideoPlayer.tsx` (68KB) is a heavily engineered component that handles:
- HLS.js stream playback
- Quality selection
- Subtitle rendering (SRT/VTT parsing)
- Auto-next episode (fires at 99.7% completion)
- Fullscreen (cross-browser, including iOS)
- Picture-in-picture
- Resume from saved position
- Provider fallback (if one stream fails, tries next)
- Double-tap seek (mobile)
- Mobile-specific controls

---

## Row Layout System

The main content rows are managed by `useDynamicManifest` hook which generates a list of rows based on context (home, movies, tv). Each row is either:
- A `Row` component (horizontal scroll of `MovieCard` poster cards)
- A `TopTenRow` component (numbered Top 10 poster cards)

The `Row` component features:
- Lazy loading and pagination (loads more on scroll to right edge)
- Smart deduplication via `pageSeenIds` (avoids showing same movie across rows)
- Quality filtering (hides rows with < 5 items)

---

## Design Intent: "Midnight & Acid" (ITVX-inspired)

The target aesthetic is inspired by **ITVX** ("ITV's streaming platform"):

- **Background:** Deep midnight teal `#061d2b`
- **Accent:** Acid lime / luminous yellow-green `#d6ff00`
- **Nav style:** Fixed-height navbar, continuous bottom border in accent color, active tab has upward-pointing triangle indicator
- **Cards:** Portrait poster format (2:3 ratio), clean with subtle hover states
- **Hero:** Full-width cinematic backdrop, left-aligned text overlay, logo-first approach
- **Top 10 Row:** Large semi-transparent numbers behind portrait posters
- **Search:** Dedicated `/search` page with massive full-width search bar
- **No hover-expand cards:** Strictly click-driven interactions (no Netflix-style hover zoom-to-reveal)

---

## What Has Been Done (Recent Changes)

1. ✅ `Navbar.tsx` — Rewrote entirely for ITVX style (continuous yellow border, triangle pointer on active tab, search as nav link)
2. ✅ `HeroCarouselContent.tsx` — Fixed broken `genreMapper` import, rewrote for cinematic left-aligned layout
3. ✅ `MovieCard.tsx` — Now portrait-only (2:3 ratio), no hover expand, minimal styling
4. ✅ `TopTenRow.tsx` — Numbers now use gradient text effect (fades up from transparency), poster gets ring on hover
5. ✅ `SearchResultsPage.tsx` — Now has its own dedicated massive ITVX-style search bar at the top
6. ✅ `App.tsx` — Added `/search` as a proper route (not just a state overlay)
7. ✅ `MobileNav.tsx` — Updated to use new SVG P-Stream logo
8. ✅ `index.html` — Updated favicon and theme-color to P-Stream branding

---

## Outstanding Issues (Things That Still Need Work)

See `02_CURRENT_ISSUES.md` for the full analysis.
