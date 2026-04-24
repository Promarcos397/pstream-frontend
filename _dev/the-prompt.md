# P-Stream ITVX Redesign — Master Design Brief

> **Status**: Active development. Design language: ITVX "Midnight & Acid".
> Accent color: `#DEEB52` (yellow-green). Background: `#061d2b` (midnight teal).

---

## 1. Architectural Shift: Netflix → ITVX

The earlier components were built for a Netflix-style design (poster cards, info modals, etc.).
We are now shifting to the ITVX design language. Key changes:

### 1.1 InfoModal → TitlePage (CRITICAL)
- **Remove** the `InfoModal` popup entirely from the flow.
- All movie/TV card clicks must navigate to `/title/:type/:id` — a **full page**, not a modal.
- Reference: `pstream.watch` — clicking a title navigates to a dedicated page.
- `TitlePage.tsx` is the destination. All `onSelectMovie` callbacks should route there.

### 1.2 Card Types
Two types of cards exist:
1. **Poster cards** — used in horizontal scroll rows (portrait ratio, old Netflix style, being phased out)
2. **Backdrop cards** (`BackdropCard.tsx`) — used in grids and select rows. 16:9 aspect ratio, with:
   - Backdrop image from TMDB (`/w780` or `/original`)
   - TMDB title logo image overlaid bottom-left (fetched from `/images` endpoint)
   - Progress bar at bottom edge (if user has watch history)
   - Slightly dimmed text title below the card (very slightly blue-tinted white, e.g. `rgba(255,255,255,0.65)`)

---

## 2. Navigation Bar

### 2.1 Nav Items (correct order)
```
HOME | FILM | SERIES | POPULAR | MY LIST  [search icon] [profile avatar]
```
- **Removed**: LIVE, CATEGORIES, NEWS, "Stream at free" button
- Profile avatar navigates to `/settings` (desktop) or `/my-pstream` (mobile)

### 2.2 Mountain-Arch Active Indicator
- A mountain/arch SVG indicator sits below the active nav item
- The arch **blends into** the yellow bottom border line of the navbar
- The fill color of the arch must match the background (`#061d2b`) to "cut out" the yellow line
- The arch stroke color is `#DEEB52` (the correct accent green)
- When on Home: indicator appears under the **logo**
- When on Search: indicator appears under the **search icon**
- When on any nav item: indicator appears under that item

### 2.3 Bottom Border
- Navbar has a 2px solid `#DEEB52` bottom border — always full width
- The mountain arch sits at `-3px` from bottom to perfectly overlap this border

---

## 3. Hero Section

### 3.1 Desktop Hero (HeroCarousel)
- Full-width backdrop image (16:9 from TMDB `/original`)
- TMDB title logo image overlaid bottom-left
- Description text, genre tags, year
- **Play button** (white → hover to `#DEEB52`) and **My List button**
- Carousel indicator dots below (thick, clickable)
- Buttons revealed on hover
- **Remove** "sponsored by" and "stream at free" taglines — use creative alternatives

### 3.2 Hero Pages
Three pages have hero sections:
1. **Home** (`/`) — mixed trending content
2. **Film** (`/movies`) — movies focus
3. **Series** (`/tv`) — TV shows focus

### 3.3 Mobile Hero
- Uses **poster** (portrait) image, not backdrop
- Takes up ~65% of viewport height
- Shows title, genre tag, rating
- Play + Info buttons at bottom
- Carousel dot indicators

---

## 4. TitlePage (`/title/:type/:id`)

This is the ITVX show/movie detail page. Reference: `image copy 5.png`, `image copy 4.png`.

### 4.1 Hero Section
- Full-width backdrop image with heavy left-side gradient
- TMDB title logo image (large, left-aligned)
- Genre · Rating · Seasons count / Runtime
- Overview text (3 lines max, clamp)
- **Play/Continue** button + **My List** button

### 4.2 Episodes Grid (TV only)
- Season selector: `<select>` styled as ITVX dropdown (shows "Series 1", "Series 2"...)
- Default: last watched season, else Season 1
- Grid: `2 cols (mobile) → 3 cols (md) → 4 cols (lg)`
- Each episode card:
  - **Still image** (16:9 thumbnail from TMDB `/w500`)
  - Episode number + name overlaid bottom
  - **Hover state**: darkened overlay with episode overview text
  - **Progress bar** at very bottom (yellow `#DEEB52`, 3px tall)
  - **Ring highlight** on last-watched episode
  - If no still image: dark placeholder with episode number

### 4.3 "More [Genre]" Row
- Below episodes section
- Title: "More Drama" / "More Crime" / etc. (based on primary genre)
- Horizontal scroll row of **BackdropCards**
- "View All" button → navigates to `/browse/related-{id}?title=More+Drama`

---

## 5. BrowseGridPage (`/browse/:rowKey`)

Full-page grid when user taps "View All" on any row.

- Back button (← circle) top-left
- Title from `?title=` query param or formatted row key
- Grid: `2 cols (mobile) → 3 cols (md) → 4 cols (lg)`  
- All cards are **BackdropCards** (backdrop + title logo + progress bar)
- Text title below each card (slightly greyed, e.g. `rgba(255,255,255,0.65)`)
- Infinite scroll or "Load More" button
- No poster cards in this view

---

## 6. Continue Watching Cards

The new "Continue Watching" card design (replaces text-title cards):

### Card anatomy:
1. **Rounded top corners** (e.g. `border-radius: 8px 8px 0 0`)
2. **Thumbnail** = last played episode still (for TV) or movie backdrop
3. **Title logo image** from TMDB — small, proportionally sized, centered below thumbnail
   - Square logos get more height allowance than wide landscape logos
   - Respect aspect ratio — don't stretch
4. **Progress info label** (below logo): `S3 · EP17` for TV, omit for movies
5. **Progress bar**: white, thick (4–5px), full width, at very bottom of the card component

### In Profile / Mobile "My P-Stream":
- Expandable grid section for Continue Watching
- Mobile: starts showing **2 columns × 2 rows = 4 items**, then "+2 rows" expand button
- Desktop: starts showing **3 columns × 2 rows = 6 items**, then "+2 rows" expand button
- Expand reveals 2 more rows each click
- Fade gradient at the bottom of collapsed state

---

## 7. My List Grid (Profile Page)

Same expandable grid as Continue Watching but for My List.

### Logic:
- Only shows the expand button if there is at least **one full row** of items
  - Mobile (2 cols): expand button appears only if ≥ 4 items
  - Desktop (3 cols): expand button appears only if ≥ 6 items
- When expanded: button changes to **collapse** (chevron up)
- Cards are **BackdropCards** (same as everywhere else)

---

## 8. Search Page (`/search`)

Reference: `image copy 10.png`

- Mountain arch indicator on **search icon** in navbar
- Grid of backdrop cards (popular/trending mix)
- 2–4 column responsive grid
- Text search bar at top
- No poster cards

---

## 9. Mobile Navigation (MobileNav)

Bottom tab bar with 5 items:
```
HOME | FILM | SERIES | POPULAR | PROFILE
```
- **Profile** tab (was "My ITV") → navigates to `/my-pstream`
- Top bar: logo (not clickable) + search icon (clickable)
- **No** Chromecast icon, no duplicate profile icon
- Mobile top bar shows: `[Logo]  ·····  [Search icon]`

---

## 10. Profile Page — Desktop (`/settings`)

Settings-style page with embedded collapsible components:
- **Continue Watching** section (expandable grid)
- **My List** section (expandable grid)
- **Settings accordion** sections (account, preferences, etc.)
- **Profile header** with avatar + display name

---

## 11. Auth Fix — Display Name Timing

**Problem**: When a new user signs up, their display_name entered during registration is not persisted to the profile because the profile hasn't been created yet when the name is sent.

**Fix**:
1. After `login()` succeeds with `isSignUp = true`
2. Add a **1-second delay** before calling `updateSettings` or the name update endpoint
3. This gives the backend time to create the profile record first
4. Then send the `display_name` as a profile update

```ts
// In handleLogin (LoginPage.tsx) after successful signup:
if (isSignUp) {
  setTimeout(() => {
    updateSettings({ displayName: displayName.trim() });
    // or call AuthService.updateProfile({ display_name: displayName.trim() })
  }, 1000);
}
```

---

## 12. Row Design Updates

### Row component changes:
- "View All" label → navigates to `/browse/:rowKey?title={row.title}&url={encodedUrl}`
- Row cards should be **BackdropCards** (backdrop + logo + progress)
- Row title styling: uppercase, tracking-wider, white, bold
- Rows should NOT use poster cards (those are phased out)

### Row types:
- Standard row → BackdropCards in horizontal scroll
- Top 10 row → numbered overlay cards

---

## 13. Color Reference

| Token | Value | Usage |
|-------|-------|-------|
| Accent / Yellow-green | `#DEEB52` | Mountain arch, progress bars, active states, buttons hover |
| Background | `#061d2b` | Main dark background |
| Card background | `#0a2337` | Card placeholder, secondary bg |
| Text primary | `#ffffff` | Main text |
| Text muted | `rgba(255,255,255,0.65)` | Card subtitles, muted text |
| Text faint | `rgba(255,255,255,0.40)` | Labels, metadata |

---

## 14. Reference Screenshots

All screenshots located in `/screeens/`:

| File | Content |
|------|---------|
| `image.png` | Desktop home screen, normal hero |
| `image copy.png` | Desktop home screen, hero on hover (reveals buttons) |
| `image copy 2.png` | Desktop hero with carousel |
| `image copy 4.png` | TitlePage scrolled down — episodes grid (TV show) |
| `image copy 5.png` | TitlePage hero + episode grid (TOP) |
| `image copy 6.png` | TitlePage — hover on "More Drama" row |
| `image copy 7.png` | Trending row design |
| `image copy 8.png` | Backdrop card row design |
| `image copy 9.png` | Desktop content grid |
| `image copy 10.png` | Search page — backdrop card grid |
| `Screenshot_*-182916.png` | Mobile home — Continue Watching mini bar |
| `Screenshot_*-182949.png` | Mobile home scrolled — Continue Watching row |
| `Screenshot_*-182958.png` | Mobile home scrolled further — rows |
| `Screenshot_*-183003.png` | Mobile "View All" grid page (backdrop cards) |
| `Screenshot_*-183103.png` | Mobile profile page |
| `Screenshot_*-183107.png` | Mobile profile page collapsed sections |

---

## 15. Deep Linking / Routes

| Route | Page |
|-------|------|
| `/` | Home |
| `/movies` | Film |
| `/tv` | Series |
| `/new` | Popular (New & Popular) |
| `/list` | My List |
| `/search` | Search |
| `/title/:type/:id` | TitlePage (replaces InfoModal) |
| `/browse/:rowKey` | BrowseGridPage (View All grid) |
| `/watch/:type/:id` | CinemaPage (video player) |
| `/settings` | Desktop profile/settings |
| `/my-pstream` | Mobile profile |
| `/login` | Auth page |

---

## 16. Things to Ignore / Remove

- ❌ "Stream at free" tagline
- ❌ Chromecast / Cast button
- ❌ "Sponsored by" text
- ❌ Netflix-era poster cards in grid views
- ❌ InfoModal popup (fully replaced by TitlePage)
- ❌ Duplicate profile icon in mobile top bar
- ❌ Content tags (recently added ITVX feature, ignore for now)