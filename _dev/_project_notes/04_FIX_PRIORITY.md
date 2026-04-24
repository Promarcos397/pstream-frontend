# Fix Priority Queue
**Last updated:** 2026-04-23

This is an ordered list of what to fix, from most critical to least. Each item links back to `02_CURRENT_ISSUES.md`.

---

## Priority 1: Broken Things (Fix These First)

| # | Issue | File | Severity |
|---|-------|------|----------|
| 1 | `CATEGORIES` nav route goes to blank page (Issue #2) | `Navbar.tsx` | 🔴 Critical |
| 2 | Mobile hero never loads (`res?.results` bug) (Issue #14) | `MobileHomePage.tsx` | 🔴 Critical |
| 3 | Hero genre tags always empty (using `genres` instead of `genre_ids`) (Issue #12) | `HeroCarouselContent.tsx` | 🔴 Critical |
| 4 | Search results hide too many cards (`backdrop_path` filter) (Issue #19) | `SearchResultsPage.tsx` | 🔴 High |

---

## Priority 2: Visual Accuracy (Design Parity)

| # | Issue | File | Severity |
|---|-------|------|----------|
| 5 | Remove unused `pstreamLogo` import (Issue #1) | `Navbar.tsx` | 🟡 Medium |
| 6 | Remove unused `pLogo` import from `image.png` (Issue #3) | `MobileNav.tsx` | 🟡 Medium |
| 7 | Search skeleton is landscape not portrait (Issue #5) | `SearchResultsPage.tsx` | 🟡 Medium |
| 8 | Disable fake carousel dots on mobile hero (Issue #10) | `MobileHomePage.tsx` | 🟡 Medium |
| 9 | TopTenRow arrows need updated height for new card sizes (Issue #11) | `TopTenRow.tsx` | 🟡 Medium |
| 10 | NavBar: `activeTab` doesn't report 'search' on /search (Issue #13) | `App.tsx` | 🟡 Medium |

---

## Priority 3: Code Quality / Polish

| # | Issue | File | Severity |
|---|-------|------|----------|
| 11 | De-duplicate search icon rendering in Navbar (Issue #24) | `Navbar.tsx` | 🟢 Low |
| 12 | "View All" in `Row.tsx` is a console.log() placeholder (Issue #18) | `Row.tsx` | 🟢 Low |
| 13 | Remove or enable `Row.tsx` scroll arrows (Issue #4) | `Row.tsx` | 🟢 Low |
| 14 | `onPlay` prop in MovieCard is unused dead code (Issue #15) | `MovieCard.tsx` | 🟢 Low |

---

## What NOT to Change (Intentional Choices)

- **Hover-expand (Netflix carousel):** `HOVER_DISABLED = true` in `Row.tsx` — intentional, matches ITVX model
- **No play button on hero:** ITVX-style, click hero → InfoModal flow — intentional
- **Muted autoplay:** Browser policy requires this for autoplay to work — non-negotiable
- **`(user as any)?.email` cast:** Workaround until AuthService is updated to include display_name consistently

---

## Future Enhancements (Not Bugs)

1. **`/categories` page** — A genre browser page showing all content categories
2. **Real "View All" routes** — Navigate to filtered content pages from Row titles
3. **`CATEGORIES` nav item** — Currently works but goes nowhere; needs a destination page
4. **Mobile search bar** — Full search experience on mobile (currently just a link to `/search`)
5. **Better auth UI** — The login page works but feels disconnected from the main branding
6. **Offline support** — Service worker for offline browsing of cached content
