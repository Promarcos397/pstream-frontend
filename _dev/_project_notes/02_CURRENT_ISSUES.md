# Current Issues & What Needs Fixing
**Last updated:** 2026-04-23

This document captures every problem found during the codebase audit — visual, structural, functional, and TypeScript.

---

## 🔴 CRITICAL — Broken / Non-Functional

### 1. Navbar: Unused import warning (minor)
**File:** `Navbar.tsx` line 4  
**Issue:** `import pstreamLogo from '../assets/pstream-logo.png'` — this import is never used. The navbar now loads `/pstream-logo.svg` directly from the public folder as a static URL (correct), but the old PNG import remains and will trigger a bundler warning.
**Fix:** Remove line 4.

### 2. Navbar: `CATEGORIES` route doesn't exist
**File:** `Navbar.tsx` line 28  
**Issue:** The nav item `{ id: 'categories', path: '/categories' }` navigates to `/categories` which has NO route defined in `App.tsx`. Clicking it sends the user to a blank page / 404.  
**Fix:** Either remove this nav item, or create a `CategoriesPage.tsx` and add it to the router. Based on ITVX design, this could be a genre browser page.

### 3. MobileNav: Logo import from wrong path
**File:** `MobileNav.tsx` line 3  
**Issue:** `import pLogo from '../image.png'` — this imports `image.png` from the frontend root. This is a leftover file from before the branding update. It should use the new SVG logo from `/public/`.  
**Fix:** Remove the import and use `<img src="/pstream-logo.svg" />` directly.

### 4. `Row.tsx`: Arrows are permanently hidden
**File:** `Row.tsx` line 240  
**Issue:** `HOVER_DISABLED = true` makes both left/right arrow buttons permanently `opacity-0` (invisible and unclickable). On desktop, this means rows can only be scrolled horizontally by mousewheel/trackpad. This was intentional during development but creates a problem on desktops without a trackpad.  
**Consideration:** If ITVX design requires visible scrolling arrows (it does — there's a `>` arrow visible in the TopTen reference image), they should be re-enabled. But the hover-expand behavior (Netflix card zoom) should remain disabled. These are separate concerns.  
**Fix Options:**
  - Option A: Re-enable arrows but keep `HOVER_DISABLED = true` so cards don't expand on hover
  - Option B: Add visible pagination dots instead of arrows
  - Option C: Keep as-is (trackpad/wheel only) — simplest

### 5. `SearchResultsPage.tsx`: Grid shows `aspect-video` skeletons but `MovieCard` is portrait
**File:** `SearchResultsPage.tsx` line 68  
**Issue:** Loading skeleton uses `aspect-video` (16:9 landscape) but `MovieCard` uses `aspect-[2/3]` (portrait). The layout jumps when cards load.  
**Fix:** Change skeleton `aspect-video` to `aspect-[2/3]`.

---

## 🟡 VISUAL — Wrong or Inconsistent Styling

### 6. Hero Carousel: No bottom fade gradient into content rows
**File:** `HeroCarouselBackground.tsx`  
**Issue:** On ITVX, the hero image fades softly at the bottom into the dark background, allowing rows to overlap visually. The current hero has a hard edge at the bottom. The `HomePage.tsx` uses `-mt-8 sm:-mt-14 md:-mt-20` negative margin to pull rows UP over the hero, but the fade needs to be stronger.  
**Fix:** Ensure the bottom gradient in `HeroCarouselBackground` is strong enough (from black/full at bottom to transparent).

### 7. Navbar: Active triangle pointer is too small / offset
**File:** `Navbar.tsx` lines 88-93  
**Issue:** The SVG triangle pointer (`w-[40px] h-[12px]`) sits at `-bottom-[2px]` but the yellow line is rendered as a separate div BELOW the flex container. The triangle needs to sit directly on top of the yellow line, perfectly centered. The current geometry may be slightly off depending on font rendering.  
**Root cause:** The yellow border line is at the nav's very bottom, but the `<li>` items have `pb-[18px]` which affects vertical positioning of the triangle. Getting pixel-perfect alignment requires careful measurement.

### 8. Navbar: `pb-4` on right side items misaligns with left side items
**File:** `Navbar.tsx` line 101  
**Issue:** The right side div (search, avatar) has `h-full pb-4` — the `pb-4` padding-bottom pushes content UP. The left side nav items use `pb-[18px]` on each `<li>`. These are different values and may cause visual misalignment. On the reference ITVX screenshot, all items are perfectly baseline-aligned.

### 9. `MovieCard.tsx`: Progress bar sits below card, may be clipped
**File:** `MovieCard.tsx` lines 93-98  
**Issue:** The progress bar is positioned at `-bottom-2.5` (below the card) but the `Row` scroll container has `paddingBottom: '20px'` to accommodate it. This is functional but fragile — any change to Row's padding will clip the bar.

### 10. `MobileHomePage.tsx`: Carousel dots are fake (always show 3 dots for item 0)
**File:** `MobileHomePage.tsx` lines 122-129  
**Issue:** The carousel dots `[0, 1, 2]` are hardcoded with `i === 0` always being the "active" dot. They don't reflect actual carousel state because there IS no carousel on mobile home — there's only one hero card.  
**Fix:** Either remove the dots entirely (cleaner) or implement an actual carousel with multiple hero cards.

### 11. `TopTenRow.tsx`: Scroll arrows are sized for old card dimensions
**File:** `TopTenRow.tsx` lines 128-133  
**Issue:** The right arrow button uses `h-[120px] sm:h-[150px] md:h-[180px] lg:h-[210px]` which were the OLD card heights. The new cards are `h-[250px]` to `h-[380px]`. The arrow height needs to match the new card height.

### 12. `HeroCarouselContent.tsx`: Genre metadata unreliable
**File:** `HeroCarouselContent.tsx` line 44  
**Issue:** `movie.genres?.map(g => g.name)` — the detailed `genres` field is only available on the **detail** response (not in list endpoint results). TMDB list endpoints return `genre_ids` (array of numbers), not `genres` (full objects). Since the hero movie comes from a list endpoint, `movie.genres` will almost always be `undefined`, so `genresList` will always be empty.  
**Fix:** Map `movie.genre_ids` through the `GENRES` dictionary from `constants.ts`.

---

## 🟢 FUNCTIONAL — Works But Could Be Better

### 13. `App.tsx`: `activeTab` doesn't recognize `/search`
**File:** `App.tsx` lines 173-182  
**Issue:** `getActiveTab()` returns `'home'` when on `/search`. This means the Home nav item will appear active (highlighted yellow) when the user is on the Search page. The search icon in the navbar correctly becomes yellow (via `isSearch = location.pathname.startsWith('/search')`), but `activeTab` passed to Navbar isn't updated.  
**Fix:** Add `if (path === '/search') return 'search'` to `getActiveTab()`.

### 14. `MobileHomePage.tsx`: `fetchData(REQUESTS.fetchTrending)` error handling
**File:** `MobileHomePage.tsx` line 21  
**Issue:** `res?.results || []` — but `fetchData()` in `api.ts` already returns `response.data.results`, not the full `response.data`. So `res` IS the results array, and `res?.results` would be `undefined`. This means `results` is always `[]` and the hero never loads on mobile.  
**Fix:** Change `const results: Movie[] = res?.results || []` to `const results: Movie[] = Array.isArray(res) ? res : []`.

### 15. `Row.tsx` + `MovieCard.tsx`: `onPlay` prop passed but never used
**File:** `MovieCard.tsx` and `Row.tsx`  
**Issue:** `MovieCard` accepts `onPlay` in its props interface but the `handleOpenModal` never calls it — clicking always opens the InfoModal (or navigates to `/watch` for TV). `onPlay` is dead code in this component.  
**Consideration:** This is intentional for the "click to info first" UX. No fix needed unless UX changes.

### 16. Backend: HuggingFace Space cold start latency
**Not a code bug, but a known infrastructure issue.**  
HuggingFace Spaces on the free tier sleep after 15-30 minutes of inactivity. When the Space restarts, `/api/stream` can take 15-20 seconds. The `BackendWakeService` and prefetch system mitigate this by hitting the backend on app load.  
**Current mitigation:** `BackendWakeService.wake()` runs on mount with periodic keepalives.

---

## 📋 DESIGN PARITY GAP — What ITVX Has That P-Stream Doesn't

These items were present in the reference ITVX screenshots but have not been implemented:

### 17. Row arrows: ITVX shows a `>` right-edge arrow
The TopTen row in the screenshot has a visible `>` arrow at the right edge. P-Stream's `HOVER_DISABLED = true` hides all arrows. Consider making arrows visible (not just hover-revealed) on desktop.

### 18. Row title: "View All" needs to navigate somewhere real
`Row.tsx` line 180: `console.log('Navigate to genre/row')` — placeholder. Should navigate to a filtered content page.

### 19. Search Results: Should show posters, not JUST backdrop-filtered cards
`SearchResultsPage.tsx` line 76: `movie.backdrop_path &&` — filters out any movie without a backdrop. This hides many valid search results. ITVX search shows poster cards for everything. Since `MovieCard` now uses poster (`posterSrc`) when `isGrid=true`, the `backdrop_path` filter should be removed.

### 20. `MobileNav`: Missing search bar in top area
Looking at the mobile screenshots, there should be a search input in the mobile top bar. `MobileNav.tsx` has a `goSearch` function but it just navigates to `/search`. There's a search bar area in the top bar layout but functionality needs verification.

### 21. Footer is present on desktop but ITVX doesn't have one
`Footer.tsx` exists and is conditionally rendered. ITVX is a fully immersive UI with no traditional footer. Consider removing or making it very minimal.

---

## 🔧 CODE QUALITY

### 22. Multiple `h-full` class conflicts in Navbar
**File:** `Navbar.tsx` line 117  
`className="...h-full flex flex-col justify-end"` — the div also already has `flex items-center justify-center`. Conflicting justify-* classes (both `justify-end` and `justify-center` applied, with `justify-end` winning in some browsers). This creates unpredictable vertical alignment.

### 23. `constants.ts`: API key is hardcoded and publicly visible
The TMDB API key `c477878444affbf19e4818802309df39` is in plaintext in the source. Fine for a personal project but not production-safe.

### 24. Duplicate search icon rendering in Navbar
The Navbar has TWO separate blocks rendering the search icon + triangle — one for logged-out users (lines 116-132) and one for logged-in users (lines 158-174). They are identical except for minor className differences. These should be extracted into a shared component or function.
