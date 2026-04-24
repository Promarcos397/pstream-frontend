# P-Stream Full Requirements & Design Spec
*Extracted from user voice note + screenshots in `/screeens/`*  
**Last updated:** 2026-04-23

---

## 1. Global Philosophy

- **Target:** Look as close to [ITVX](https://www.itv.com/watch) as possible — not an exact copy but same *feel* and design language
- **Not Netflix anymore.** Every component that was built for a Netflix-style card expand/hover UX must be replaced or refactored
- **Click-driven, not hover-driven** — ITVX style means click opens the detail page, hover only reveals minimal info (title below card, episode tooltip)
- **Two card types exist:**
  1. **Poster cards** (2:3 portrait) — used in horizontal rows
  2. **Backdrop cards** (16:9 landscape) — used in grids (View All pages, episode lists, search results, trending rows)
- **No "Stream Ad-Free" button** in navbar — this is a free personal project
- **No "sponsored by"** text anywhere
- **No Chromecast buttons** (ignore entirely)

---

## 2. Navbar (Desktop/Tablet)

### Layout
```
[P-Stream Logo]   [HOME] [FILM] [SERIES] [POPULAR] [MY LIST]   [Avatar/Profile Icon] [🔍]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ← 2px #d6ff00 line
                              ∧ (mountain/arch indicator under active tab)
```

### Nav items (in order, left to right):
| Label | Route | Notes |
|-------|-------|-------|
| `HOME` | `/` | Active by default |
| `FILM` | `/movies` | Movies page |
| `SERIES` | `/tv` | TV shows page |
| `POPULAR` | `/new` | New & Popular (was "News") |
| `MY LIST` | `/list` | My list page |

- Remove: "LIVE", "CATEGORIES", "NEWS", "STREAM AD-FREE button"
- Right side: Avatar icon → `/settings`, Search icon → `/search`
- Logo: NOT clickable (decorative) OR clickable to `/` — your call

### Active Tab Indicator ("Mountain" / arch)
- A continuous `2px solid #d6ff00` line runs the FULL width at the bottom of the navbar
- When a tab is active, an arch/bump shape appears CENTERED under that tab
- The arch color is `#d6ff00` on the outside, `#061d2b` fill (cuts INTO the yellow line visually)
- Shape: gentle curve (not sharp triangle) — like a mountain peak, ~40px wide, ~12px tall
- Active tab text: `#d6ff00`
- Inactive tab text: gray, turns white on hover
- Search icon: gets the same mountain indicator when on `/search`
- Logo: gets the mountain indicator when on `/` (home)

*Reference images: `image.png`, `image copy 8.png`, `image copy 10.png`*

---

## 3. Hero Carousel (Desktop — 3 pages have heroes)

### Pages with heroes:
1. **Home** (`/`) — rotating selection from popular/trending
2. **Films** (`/movies`) — movie-focused hero
3. **Series** (`/tv`) — TV-focused hero

### Hero Layout (from `image.png` and `image copy.png`)
```
┌──────────────────────────────────── full viewport width ──────────────────────────────────┐
│                                                                             [mute/unmute]   │
│  [TMDB logo image OR large text title]                                                      │
│  [Accent yellow tagline text — creative, not "New series - stream every episode"]          │
│  [Description paragraph, white, max 3 lines]                                               │
│  [GENRE · GENRE · FILM/SERIES]                  [backdrop image fills right side]          │
│                                                                                             │
│  [▶ PLAY]  [+ Add to List]                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────-─┘
     ━━━━━━━━━  ▪▪▪  ▪▪▪   ← carousel dot indicators, clickable, thick pills
```

### Carousel indicator dots:
- Thick pill shape (like ITVX — `width: 24px, height: 6px` for active, `8x6` for inactive)
- Active dot: white
- Inactive dots: `rgba(255,255,255,0.4)`
- Centered at the bottom of the hero
- Clickable to jump to that hero item

### Hover state (`image copy.png`):
- On hover, the hero gets a subtle blue-tinted vignette overlay
- Left/right arrow buttons appear (`<` and `>`) at the side edges to navigate the carousel
- Play button becomes visible as a full overlay button in center (optional — ITVX shows it on hover only)

### TMDB data for hero:
- `backdrop_path` → full-width background image
- `images.logos` from TMDB detail endpoint → show the logo image (priority: English SVG/PNG)
- Fallback: render title text in large bold font (`font-leaner` or `font-bebas`)
- Description: `overview` field, truncated to ~225 chars
- Genres: map `genre_ids` through `GENRES` dictionary from `constants.ts`
- Tag: "SERIES N" or "FILM" based on `media_type`

### What it fetches:
- Be creative — could be rotating set of popular/critically-acclaimed content
- Could be different each day (seed by date)
- Mix of movies and TV recommended
- Filter: must have `backdrop_path` AND be in English (or have English images available)

---

## 4. Title/Detail Page (`/info/:type/:id` or `/title/:type/:id`)

*Based on `image copy 5.png` (top of page) and `image copy 4.png` (scrolled down)*

### URL structure:
- `/title/tv/:id` → TV show detail page
- `/title/movie/:id` → Movie detail page
- This replaces the current modal approach for desktop — clicking a card opens a full page, not a modal

### Layout:

#### Section 1 — Hero (top of page)
```
[Backdrop image — full width, ~55vh height]
[Gradient overlay from left side — darkens left third]
Inside the overlaid area (left side):
  [Logo image from TMDB OR large title text]
  [Badge row: AD | S | DRAMA · 41M]    ← ignore AD and S badges for us
  [Description paragraph]
  [▶ PLAY]  [+ My List]                ← two buttons
```
- Same style as the home hero but taller/more detailed
- NO "WATCH AD-FREE" button (irrelevant for us)
- NO ad banner below it (the ITVX Premium banner in `image copy 5.png`)

#### Section 2 — Episodes grid (for TV shows)
- Below the hero, shows episode cards in a **responsive grid**
- Default: **4 columns** on desktop, 2 on tablet, 1 on mobile
- Each episode card is a **backdrop thumbnail** from TMDB episode stills (`still_path`)
- Card contains:
  - Thumbnail image (16:9)
  - Episode number overlaid on bottom-left: `"1. Episode Title"` (white text on dark bg)
  - On hover: episode title + synopsis revealed as a white tooltip/expand on the card (like `image copy 4.png` — card 4 shows expanded info with text)
  - The currently playing / last watched episode gets a **white border** and progress bar at bottom
- Season selector: dropdown above the episode grid if the show has > 1 season
  - Dropdown style: dark teal background, white text, accent border on focus
  - Shows "Series 1", "Series 2" etc.

#### Section 3 — "More [Genre]" row
- Below episodes (or below movie hero), a horizontal scroll row titled `"More Drama"` (or whatever the primary genre is)
- Contains poster cards (2:3) of related content (mix of similar genre + TMDB recommendations)
- Has `View all` button → navigates to `/browse/:genre`

*Reference: `image copy 6.png`*

---

## 5. Card Types

### 5a. Poster Card (rows) — `MovieCard.tsx`
- Aspect ratio: 2:3 (portrait)
- Image: `poster_path` from TMDB
- On hover:
  - Subtle scale: `scale(1.03)` only
  - Title appears BELOW the card in small text (NOT overlaid on the card)
  - Season info: `"Series 1 - 6"` in small gray text below title (for TV)
  - Optional badge overlaid bottom-left: `NEW SERIES` or `RECENTLY ADDED` in `#d6ff00` with black bold text
- Progress bar: thin (`h-1`) bar at the BOTTOM EDGE of the card image (NOT below the card), `#d6ff00` color with glow
- Click: navigates to `/title/:type/:id`

### 5b. Backdrop Card (grids, View All pages, search, trending rows) — `BackdropCard.tsx` (NEW component)
- Aspect ratio: 16:9 (landscape)
- Image: `backdrop_path` from TMDB
- Logo image (`images.logos`) rendered on top of backdrop, anchored bottom-left
  - If no logo: text title in white bold, bottom-left of card, with text-shadow
- Below the card (NOT on it): small text title in `rgba(255,255,255,0.65)` — slightly faded
- Border radius: `rounded-sm` (4px)
- On hover: slight brightness increase, soft white border `ring-1 ring-white/40`
- Progress bar: same as poster card — at bottom edge of image
- Click: navigates to `/title/:type/:id`

*Reference: `image copy 10.png` (search grid), `image copy 8.png` (trending row), `image copy 4.png` (episodes)*

---

## 6. Continue Watching Component (`ContinueWatchingCard`)

*This is a NEW card design used in both the mobile home row and the profile page*

### Card Structure:
```
┌──────────────────────────────────────┐
│  [Episode thumbnail image — 16:9]    │  ← rounded top corners only
│  [Logo image — small, proportional] │  ← at bottom of thumbnail, anchored bottom-left
│  ━━━━━━━━━━━━━━                       │  ← white/accent progress bar, thick (3-4px)
├──────────────────────────────────────┤
│  S3, E17                             │  ← season/episode, small text
└──────────────────────────────────────┘
```

### Key behaviors:
- **Thumbnail**: Last-played episode still image (`still_path`) OR movie backdrop
- **Logo**: TMDB logo image for the show/movie, rendered proportionally:
  - Wide logos fill width, tall logos fill height — respect the logo's natural ratio
  - Max height: ~40px (so a very tall logo doesn't dominate)
  - All logos constrained to same bounding box (`max-w-[120px] max-h-[40px] object-contain`)
- **Progress bar**: White, thick, sits immediately below the logo, full card width
- **Text**: `S3, E17` for TV, nothing (or duration) for movies — small, `text-[11px]`, `text-white/60`
- **Click**: Continue watching from saved position `/watch/:type/:id?season=3&episode=17`

*Reference: `Screenshot_20260422-182949.png` (mobile), `Screenshot_20260422-183103.png` (profile list view)*

---

## 7. "View All" / Browse Grid Page

*New page: `/browse/:rowKey` or `/browse/genre/:name`*

### When triggered:
- Clicking `"View All"` on any row → opens this page

### Layout:
- Back button (top left `←`) → returns to previous page
- Page title = row title (e.g., "More Drama", "Our Top Picks")
- Grid of **backdrop cards** (16:9), 4 columns on desktop, 2 on mobile
- Each card has logo/title + progress bar if in watchlist
- Text title below each card (slightly faded)
- Infinite scroll pagination OR "Load more" button

*Reference: `Screenshot_20260422-183003.png` (mobile grid view), `image copy 10.png` (desktop search grid)*

---

## 8. Search Page (`/search`)

*Reference: `image copy 10.png`*

### Structure:
```
[Full-width search input bar — tall, teal bg, bottom cyan accent border]
  🔍  Search for shows, films, actors...

[Most Popular]                           ← section heading
[4-column grid of backdrop cards]        ← not poster, backdrop!
```

### Default state (no query):
- Shows rotating "Most Popular" or category-specific content
- Rotates by day or is seeded — be creative (could be "Action Hits", "Critically Acclaimed", "This Week's Best")
- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Cards: **backdrop style** (NOT poster) with logo/title overlay and text below
- No `backdrop_path` filter — show everything (use poster as fallback)

### Active search state:
- Live search results populate the grid as user types
- Heading changes to `Search results for "[query]"`

### Navbar indicator:
- Search icon gets the mountain/arch indicator when on `/search`

---

## 9. Mobile Navigation

*Reference: `Screenshot_20260422-182916.png`*

### Top bar (fixed):
- Shows: P-Stream logo (left, NOT clickable) + Search icon (right, clickable to `/search`)
- Does NOT show second profile icon (already in bottom tab bar)
- Ignore Chromecast

### Bottom tab bar (5 tabs):
| Icon | Label | Route |
|------|-------|-------|
| 🏠 | Home | `/` |
| 📡 | Film | `/movies` |  
| ☰ | Series | `/tv` |
| ✦ | Popular | `/new` |
| 👤 | Profile | `/settings` |

- Active tab: icon + label in `#d6ff00` (acid lime)
- Inactive: white icon + label, slightly faded
- Active indicator: underline dot OR nothing (ITVX mobile just uses color highlight)

### Continue Watching mini-bar (above bottom tab bar):
- Shows when there's something in `continueWatching` queue
- Contains: play icon + show title + "CONTINUE WATCHING" text + close (×) button
- `#d6ff00` progress bar at very bottom of the bar
- Click: continues playback at saved position
- Close: dismisses the bar (localStorage key to remember dismissal)

*Reference: `Screenshot_20260422-182916.png` (bottom of screen bar)*

---

## 10. Mobile Hero Card

### Structure (home page hero):
- **Portrait image** using `poster_path` (tall card, ~65% of screen height)
- Title text rendered as text (bold, white, large) 
- OR show TMDB logo image if available
- Acid yellow tagline (creative — not "New series")
- Genre tags: `DRAMA · SERIES 1`
- Carousel dots at bottom (clickable, functional — rotate through 3-5 items)
- On tap: opens `/title/:type/:id`
- **No play button on the hero card itself** (tap to open detail page)

---

## 11. Profile / Settings Page

*Reference: `Screenshot_20260422-183103.png` (mobile), `Screenshot_20260422-183107.png`, `Screenshot_20260422-183116.png`*

### For mobile — tab-based inside "My ITVX" / "Profile" tab:
- Top tabs: `Continue Watching | My List | Downloads`
- Active tab underlined in `#d6ff00`
- Each tab shows a vertical list of **ContinueWatchingCard** style items:
  - Episode thumbnail (16:9) on the left
  - Title + `Series 3 - Episode 17` text on the right
  - Progress bar below thumbnail
  - "About this episode ⌄" expandable dropdown showing synopsis

### For desktop — embedded grid sections on Settings/Profile page:

#### Continue Watching section:
- Shows `2×2` grid (mobile) or `3×3` grid (desktop) of **ContinueWatchingCard**
- Bottom fade + ⌄ "Show more" button (centered, round)
- Clicking "Show more" reveals 2 more rows each time
- The expand button flips to ∧ "Show less" once expanded
- Only shows the expand section if there's more than 1 full row of content
  - Mobile (2 cols): needs ≥ 2 items to show first row, ≥ 4 to show expand button
  - Desktop (3 cols): needs ≥ 3 items to show first row, ≥ 6 to show expand button

#### My List section:
- Same grid + expand/collapse behavior as above
- Same card style (ContinueWatchingCard)
- If list is empty: placeholder message + recommended content below

---

## 12. Auth / Signup Bug Fix

### Problem:
When user signs up (enters display name → continues → copies identity key → confirms), the `display_name` they entered does NOT get saved to the backend profile.

### Root cause (suspected):
The profile creation request happens before the `display_name` can be sent up, OR the `display_name` field is not included in the initial `login()` call payload.

### Fix approach:
After successful signup/login:
1. Save `display_name` to `localStorage` immediately (`pstream-pending-name`)
2. After `login()` returns with a valid token, call `AuthService.syncProfile({ display_name: pendingName })` with a 1-second delay to ensure profile exists in Supabase first
3. Then clear `pstream-pending-name` from localStorage
4. After syncing, re-fetch the profile to update the displayed name

---

## 13. Row Behavior

*Reference: `image copy 6.png`, `image.png`*

### Row title area:
- Left: Row title in white bold (e.g., `"More Drama"`, `"Our Top Picks"`)
- Right: `"View All"` link in `#d6ff00` — clickable → navigates to `/browse/:rowKey`

### Scroll arrows:
- Desktop: show `>` right-edge arrow when scroll is possible
- Arrow appears as a thin, slightly transparent button at the right edge
- Arrow disappears when scrolled to end
- Left arrow appears when not at start

### Card display:
- Rows use **poster cards** (portrait) by default
- Special rows (trending, featured) may use **backdrop cards** — this is configured per-row in the manifest

---

## 14. "Trending" Row (Backdrop style)

*Reference: `image copy 8.png`*

- Horizontal scroll row
- Cards are **backdrop format** (16:9), wider than poster cards
- Logo image overlaid on backdrop, bottom-left
- Text below card: show title
- Same hover state as backdrop grid cards

---

## 15. Implementation Notes

### New components needed:
1. `BackdropCard.tsx` — 16:9 card with logo overlay + text below
2. `ContinueWatchingCard.tsx` — episode thumbnail + logo + progress + S/E label
3. `BrowseGridPage.tsx` — full-page grid opened from "View All"
4. `TitlePage.tsx` — full detail page replacing InfoModal on desktop
5. `EpisodeCard.tsx` — episode grid card for TV show detail page

### Modified components:
1. `Navbar.tsx` — remove LIVE/CATEGORIES/NEWS/STREAM AD-FREE, add HOME, fix mountain indicator
2. `MobileNav.tsx` — rename tabs (Film, Series, Popular, Profile), fix logo import
3. `Row.tsx` — add "View All" navigation, re-enable scroll arrows
4. `MovieCard.tsx` — add text below card on hover, badge at bottom-left, progress bar at card edge
5. `HeroCarouselContent.tsx` — fix genre_ids mapping, add carousel dots, refine tagline
6. `SearchResultsPage.tsx` — switch to backdrop card grid, fix backdrop_path filter
7. `MobileHomePage.tsx` — fix hero loading bug (`res?.results`), functional carousel dots

### Routes to add/change:
```
/title/tv/:id       → TitlePage (TV show detail)
/title/movie/:id    → TitlePage (Movie detail)
/browse/:rowKey     → BrowseGridPage (View All grid)
```

### Deep linking URL spec:
- Movie/TV detail: `/title/movie/550` or `/title/tv/1399`
- Watch (player): `/watch/movie/550` or `/watch/tv/1399?s=3&e=17`
- Browse row: `/browse/top-picks` or `/browse/genre/drama`
- Search: `/search?q=breaking+bad` (query in URL param)
