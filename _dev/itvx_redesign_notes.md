# ITVX Redesign Roadmap & Notes

Based on a visual review of the ITVX screenshots and an architectural review of the `pstream-frontend` codebase, here are the observations and the required roadmap to transition from the current "Netflix DNA" to the premium "ITVX Cinematic DNA."

## 1. Current Codebase State (The "Netflix" DNA)
- **Palette:** Deeply locked into Netflix Red/Black (e.g., `netflix-red`, `netflix-black`, `netflix-dark` in `tailwind.config.js`). 
- **CSS Utility Bindings:** Classes like `.netflix-red-glow`, `.netflix-gradient-red` are heavily used to mimic Netflix's focus states and brand aesthetic.
- **Mobile Nav (`MobileNav.tsx`):** Uses the "Pill" design for the header (`[Series] [Films] [Categories]`). While clean, it differs from the sleek, underlined style seen in ITVX.
- **Typography:** Currently uses a mix (Harmonia, Leaner, Consolas, Bebas).
- **Cards:** Both desktop (`MovieCard.tsx`) and mobile (`MobileMovieCard.tsx`) use hard red progress bars and dark, low-radius styling.

## 2. Target Design Language (The "Midnight & Acid" Aesthetic)

### A. Color Palette
- **Background:** Rich Midnight Teal (`#061d2b` or similar). A flat, cinematic dark blue.
- **Brand Accent:** Acid Lime / Luminous Green (`#d6ff00`). Replaces the `netflix-red`. Used in headers and active states.
- **Overlays / Buttons:** Secondary buttons use a translucent slate-teal background (`rgba(255, 255, 255, 0.15)`) on top of the dark teal background.

### B. Typography
- **Hero Headers:** Heavy, wide sans-serifs (similar to Leaner Bold).
- **UI / Body Text:** Clean, highly legible geometric sans (Harmonia). The case is mostly sentence-style rather than all-caps for navigation.

### C. Component Level Specifics

#### Buttons (Hero / Detail Views)
- **Primary Play Button:** Solid white background, dense dark text, with a thin bordered triangle play icon. It is blocky (low border-radius, `~4px`), not perfectly round.
- **Secondary Action (e.g. Watch Ad-Free):** Translucent teal background, white text, and a stylized, gradient (acid green) play triangle. 
- **Icon Buttons (e.g., '+'):** Hard square with slightly rounded corners matching the secondary button height.

#### Focus States & Hover Glows
- Instead of the tight red outline from Netflix, card focus states use a solid white structural border (`2px`) combined with a **massive, wide, diffuse cyan/white glow** spreading into the dark background. 
- We need an `.itvx-glow` class that executes this via `box-shadow` or background diffusion.

#### Grids and Rows
- **Episode Grids:** Landscape (`16:9`), `~8px-12px` rounded corners. Images are full bleed. Text (`1. Episode Title`) is laid directly over the bottom of the image until selected, at which point an expanded description drops down.
- **Standard Rows (e.g., "More Drama"):** Portrait posters (like our standard TMDB fetched cards) with gentle `4px` rounding. 
- Note: TMDB images inherently contain text, unlike ITVX's pure backdrop assets, so we must be careful with our gradient overlays so text remains readable without looking messy.

## 3. Implementation Roadmap

### Phase A: Token & Theme Replacement (Foundation)
1. **`tailwind.config.js`:** Remove `netflix-*` colors. Add `itvx-bg` (midnight teal), `itvx-accent` (acid green), and `itvx-panel` (translucent slate/teal).
2. **`index.css`:** Update `body` background. Create `.itvx-glow` utility. Remove red Netflix glowing classes. 

### Phase B: Desktop Component Upgrades
1. **Hero Content (`HeroCarousel.tsx`):** Restyle buttons to match the solid white / translucent teal block configuration.
2. **`Row.tsx` & `MovieCard.tsx`:** Implement the white structural border + wide diffuse glow for the active hover state. Remove the red floating progress bar; replace with the ITVX white/teal style if progress is to be shown.
3. **Typography:** Unify the navigation to use the sentence-case, acid green bottom-notch indicator for active states.

### Phase C: Mobile UI Re-mapping
1. **`MobileNav.tsx`:** Remove or redesign the pill mode. Switch to standard text links with the sharp underline indicator.
2. **`MobileMovieCard.tsx`:** Apply the new border-radius. Swap the red `#e50914` progress bar logic to the blue/acid-green scale.

## 4. Observations on Image Formatting
Since we are reliant on TMDB, our posters will often have titles baked into the artwork. ITVX uses pure art (no titles) and overlays HTML text in a specific font. 
- For Hero sections, we should continue letting the TMDB Logo (`logoUrl`) drive the branding rather than generic text overlay if possible, as it looks much more premium.
- For Rows, we should ensure the gradient shadowing at the bottom of the poster doesn't clash with the artwork's baked-in title.

## 5. Additional UI Insights (from extended image review)
- **Navigation Active State:** The top nav features a continuous thin acid green line. The currently active nav item has a small, sharp triangular "notch" that points upward into the active text. This needs to be applied in our updated `MobileNav.tsx` or Header components via a pseudo-element (`::after` with borders).
- **Badging:** "NEW SERIES" or "RECENTLY ADDED" tags use the acid green background (`#d6ff00`) with dense black text. The padding is highly constrained, and the badges are positioned precisely at the bottom edge of the poster, slightly overlapping the inner frame.
- **Search & Grids:** The Search view (`image copy 10`) places text entirely *outside* and *below* the cards (left-aligned, light grey/blue font), rather than using inner overlays. This keeps the layout immaculate.
- **Mobile Hot & New Tabs:** In `MobileNewHotPage.tsx`, we currently render "Everyone's Watching" and "Top 10" as standard pill buttons (`border-radius: 24`). These need to be refactored to align with the sharp underline/notch aesthetic or translucent block styling to avoid looking cheap.
