# Design System Reference
**Last updated:** 2026-04-23  
**Target inspiration:** ITVX (itv.com/watch)  
**App name:** P-Stream

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#061d2b` | Main page background, navbar, all surfaces |
| `bg-secondary` | `#081721` | Slightly lighter background (MobileNav uses this) |
| `accent` | `#d6ff00` | Active states, highlights, "View All" links, nav triangle, badges |
| `text-primary` | `#ffffff` | Main text, titles, all body copy |
| `text-secondary` | `rgba(255,255,255,0.65)` | Subtitles, metadata, muted text |
| `text-inactive-nav` | `#9ca3af` (gray-400) | Inactive nav tabs on desktop |
| `border-subtle` | `rgba(255,255,255,0.10)` | Card borders, subtle dividers |
| `surface-glass` | `rgba(255,255,255,0.12)` | Glass/translucent buttons (Info button on mobile hero) |
| `accent-dark` | `#aacc00` | Darker shade of accent for gradients |

---

## Typography

### Font Stack (in order of priority)
```css
font-family: 'Harmonia Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
```
This is the main `font-sans` in `tailwind.config.js`.

### Font Face Files Available
| Family | Weight | File |
|--------|--------|------|
| `Harmonia Sans` | Regular | `assets/fonts/Harmonia Sans W01 Regular.ttf` |
| `Harmonia Sans` | Bold | `assets/fonts/Harmonia Sans W01 Bold.ttf` |
| `Harmonia Sans Mono` | Bold | `assets/fonts/Harmonia Sans Mono W01 Bold.ttf` |
| `Harmonia Sans Condensed` | Regular | `assets/fonts/Harmonia Sans W06 Condensed.ttf` |
| `Harmonia Sans Black Italic` | 900/Italic | `assets/fonts/Harmonia Sans W06 Black Italic.ttf` |
| `Leaner Bold` | Bold | `assets/fonts/LeanerBold.otf` |
| `Bebas Neue` | Regular | `BebasNeue-Regular.ttf` (root) |

### Typescale Usage
| Context | Size | Weight | Font | Case |
|---------|------|--------|------|------|
| Hero Title (logo fallback) | `5xl`→`7xl` | 900 | `font-leaner` | Uppercase |
| Hero Subtitle (highlight) | `base`→`xl` | Bold | `font-sans` | Sentence |
| Hero Overview | `sm`→`lg` | Medium | `font-sans` | Sentence |
| Navbar items | `13px` | Semibold | `font-sans` | Uppercase |
| Row titles | `17px`→`26px` | Bold | `font-sans` | Title case |
| Card titles (fallback) | `sm` | Semibold | `font-sans` | Title case |
| Badges | `10px`→`xs` | Bold | `font-sans` | Uppercase |
| Metadata/tags | `10px`→`xs` | Bold | `font-sans` | Uppercase |

---

## Navbar Design Spec

```
┌────────────────────────────────────────────────────────────┐  ← height: 72px (fixed)
│  [P-Stream Logo]  [LIVE] [FILM] [CATEGORIES] [NEWS] [LIST] │  ← left side, items-end
│                                            [Stream Ad-Free] [Avatar] [🔍] │  ← right side
└──────────────────────────────────────────────────────────── ┤  ← 2px solid #d6ff00 line
                                ▲ (triangle pointer under active tab)
```

### Active Tab Indicator (Triangle Pointer)
- The FULL width `#d6ff00` line runs across the entire bottom of `<nav>`
- The active tab renders an SVG chevron/triangle that:
  - Sits at `position: absolute; bottom: -2px` relative to the `<li>`
  - Points UPWARD (chevron shape: wide at bottom, narrow point at top)
  - Is filled with the background color `#061d2b` to "cut into" the yellow line
  - Has a `stroke="#d6ff00"` border so it visually reads as a triangle pointing up FROM the line
- Active tab TEXT color: `#d6ff00`
- Inactive tab TEXT color: `#9ca3af` (gray-400), turns `white` on hover

### SVG Path for Triangle
```svg
<path d="M0 13 L15 3.5 C17 2, 23 2, 25 3.5 L40 13" stroke="#d6ff00" strokeWidth="2" fill="#061d2b" />
```
Width: 40px, Height: 12px. The curve control points give it the gentle ITVX arch.

---

## Card Design Spec

### Desktop Standard Card (`MovieCard.tsx`)
- **Aspect ratio:** 2:3 (portrait)
- **Border radius:** `rounded-sm` (~2px)
- **Default border:** `border border-white/10`
- **Hover:** `hover:scale-105` (subtle scale, no card expand)
- **Progress bar:** Positioned at `-bottom-2.5`, height `h-1`, color `#d6ff00` with glow
- **Image:** TMDB poster at `w780` resolution

### Desktop Top 10 Card (`TopTenRow.tsx`)
- **Card container:** `w-[180px]→w-[280px]`, `h-[250px]→h-[380px]`
- **Number:** Massive text, `text-[200px]→text-[320px]`, gradient from `white/40` (top) to `transparent` (bottom), positioned bottom-left behind the poster
- **Number hover:** Becomes solid white via `group-hover/card:from-white group-hover/card:to-white`
- **Poster:** Occupies right 70-75% of card, height 80-85% of card
- **Poster hover:** Gets `ring-[2px] ring-white`

### Mobile Card (`MobileMovieCard.tsx`)
- Generally portrait, but refer to `MobileMovieCard.tsx` for exact spec

---

## Hero Carousel Design Spec

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Logo or Title]                         [mute] [age badge] │
│  [Highlight subtitle in #d6ff00]                            │
│  [Overview paragraph, white]                                │
│  [GENRE · GENRE · FILM/SERIES tags]                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                    ↑ fades into content rows below
```

### Dimensions
- Mobile: `h-[50vh]`
- Tablet: `h-[60vh]`
- Desktop: `h-[80vh]`

### Content positioning
- Left padding: `pl-[1.5rem]` to `pl-16` (matches nav left padding)
- Content max-width: `max-w-2xl`
- Vertically centered: `flex-col justify-center`

### Video behavior
- YouTube trailer auto-plays at 1s delay (2s on slow networks)
- Video is 1.9x zoom to crop YouTube UI chrome
- Muted by default (bypass autoplay policy)
- Audio fades in/out when pausing/playing
- Text description fades OUT after 7 seconds once video is playing
- Logo remains visible when text fades

---

## Button Design Spec

### Primary Action (Play)
- Background: `#ffffff`
- Text: `#000000`, bold, ~15px
- Icon: Solid black play triangle
- Border radius: `4px` (not fully round)
- Height: ~40px
- Padding: `12px 24px`

### Secondary Action (Info / Watch Ad-Free)
- Background: `rgba(255,255,255,0.12)` with `backdrop-filter: blur(8px)`
- Text: `#ffffff`, semibold
- Border: `1px solid rgba(255,255,255,0.25)`
- Border radius: `4px`
- Icon (if any): Stroke in `#d6ff00`

### Navigation Link Button (e.g., "Stream Ad-Free" in Navbar)
- Background: transparent
- Text: white, small, uppercase, tracking-widest
- Border: `1px solid rgba(255,255,255,0.60)`
- Hover: `border-white`
- No border radius (sharp corner)

---

## Search Page Design Spec

### Search Input Bar
```
┌──────────────────────────────────────────────┐
│ 🔍  Search for shows, films, actors...        │  ← full width, tall input
└──────────────────────────────────────────────┘
```
- Background: `#053c52` (slightly lighter teal)
- Bottom border: `2px solid #089bb2` (cyan accent)
- Border radius: `rounded-t` (only top corners)
- Height: ~64px on mobile, ~80px on desktop
- Font size: `text-2xl`
- Placeholder: `rgba(255,255,255,0.80)`
- On focus: entire box darkens to `#061d2b`

### Results Grid
- `grid-cols-2` → `grid-cols-6` responsive
- No filters shown (ITVX-style simplicity)
- Poster format cards (`isGrid=true`)
- No `backdrop_path` filter — show everything with a poster

---

## Mobile Navigation Design Spec (`MobileNav.tsx`)

### Top Bar (height: 162px)
- Row 1 (60px): Logo + Search icon + Profile icon
- Row 2 (56px): Search bar input
- Row 3 (46px): SubNav tabs `[Series] [Films] [New & Hot]`

### Bottom Tab Bar (height: 72px)
- 5 tabs: Home, Series, Films, New & Hot, My P-Stream
- Active tab: white icon/label + indicator dot or underline
- Background: `#061d2b` with blur backdrop

### Continue Watching Bar (height: 62px, optional)
- Shows above bottom tab bar when there's a recently watched item
- Contains thumbnail + title + resume progress
- Can be dismissed

---

## CSS Utilities (in `index.css`)

| Class | Description |
|-------|-------------|
| `.itvx-glow` | White border + acid green + cyan glow via box-shadow |
| `.itvx-gradient-accent` | Vertical gradient from `#d6ff00` to `#aacc00` |
| `.glass` | Dark glassmorphism panel (blur + translucent) |
| `.text-gradient-red` | Acid lime text gradient (misnamed) |
| `.scrollbar-hide` | Hides scrollbars on row strips |
| `.row-scroll-outer` | `touch-action: pan-y` for vertical scroll passthrough |
| `.row-scroll-strip` | `touch-action: pan-x` for horizontal card scroll |
| `.text-shadow-hard` | `0 2px 4px rgba(0,0,0,0.8)` |
| `.backdrop-pop` | Slight saturation/contrast boost on images |
| `.movie-card-glow` | Ambient shadow under cards |
| `.animate-modal-spring` | Spring animation for modal entrance |
| `.subtitle-overlay` | Subtitle rendering container for video player |

---

## Spacing & Layout Constants

| Constant | Value | Usage |
|----------|-------|-------|
| Navbar height | `72px` | Both desktop and mobile |
| Desktop left padding | `px-6 md:px-14 lg:px-16` | Consistent across all page sections |
| Row title size | `text-[17px]→text-[26px]` | Responsive row labels |
| Row gap | `my-3 md:my-4` | Space between rows |
| Hero negative overlap | `-mt-8 sm:-mt-14 md:-mt-20` | How much rows overlap the hero |
| Card gap in row | `mr-1 md:mr-1.5 lg:mr-2` | Gap between cards in a Row |

---

## Asset Paths

| Asset | Path | Usage |
|-------|------|-------|
| P-Stream full logo | `/public/pstream-logo.svg` | Desktop navbar, mobile nav |
| P-Stream square logo | `/public/p-pstream-logo.svg` | Favicon |
| Default avatar | First item in `AVATAR_CATEGORIES[4].avatars` (Blue Fluffball) | Profile picture fallback |
