# Inside Out Manager - Design System

## 1. Visual Concept: "Industrial Retail Terminal"
Inside Out Manager is an operations tool designed for precision, speed, and absolute clarity. The aesthetic moves away from soft, bubbly consumer interfaces toward a **robust, high-density, high-contrast terminal**.

### Principles
- **Solid Shapes:** Use tight, precise border-radii (`4px` to `6px`). No large, rounded, soft corners (`12px+`).
- **Mechanical Feedback:** Buttons should feel like physical terminal keys. Use solid color shifts and clear active states (scale down slightly) with immediate response.
- **Strict Delineation:** Use crisp, high-contrast `1px solid var(--border)` to separate sections instead of soft drop shadows or blur.
- **Data Dominance:** The information is the UI. Typography must scale precisely, and tables/grids should maximize screen real estate.

## 2. Typography
- **Primary Interface Font:** `Inter Variable` (or system UI sans-serif fallback). Use for navigation, labels, forms, and general copy.
- **Data Font:** We enforce `tabular-nums` for all numbers (money, time, quantities, stock). If possible, use `JetBrains Mono` or a monospace fallback for distinct financial components.
- **Scale:**
  - `30px` (Headers - H1)
  - `16px` (H2 - Section Headers)
  - `14px` (Base body font, increased contrast)
  - `12px` (Secondary text, metadata)
  - `10px` / `9px` (Eyebrow labels, badges, tertiary notes - highly capitalized and letter-spaced)

## 3. Core Design Tokens (CSS Variables)

We optimize for high contrast and legibility, defaulting to Dark Mode for the terminal feel.

### Color Palette (Dark Theme - Terminal Focus)
- `--bg`: `#0A0806` (Warm near-black — avoids "AI gray")
- `--surface`: `#130F0D` (Elevated panels)
- `--raised`: `#1E1814` (Hover states, input backgrounds)
- `--border`: `#2C2420` (Crisp separation)
- `--border-soft`: `#1E1814`
- `--text`: `#F5F0EA` (High contrast warm text)
- `--muted`: `#7A6E68` (De-emphasized text)
- `--accent`: `#C0392B` (A strong, pure, inside out red for primary actions)
- `--accent-soft`: `rgba(192,57,43,0.12)` (For active nav items and highlights)
- `--sidebar`: `#080603` (Distinctive control column)

### Color Palette (Light Theme)
- `--bg`: `#F9F6F0` (Warm cream)
- `--surface`: `#FDFAF5` (Warmer white)
- `--raised`: `#F0EBE3`
- `--border`: `#DDD5CB`
- `--border-soft`: `#EDE6DD`
- `--text`: `#1A1410`
- `--muted`: `#7A6E65`
- `--accent`: `#B5341F`
- `--sidebar`: `#1A1410` (Dark sidebar in light mode for strong contrast)

### Spacing & Sizing
- Grid Gap / Spacing Base: `4px` / `8px`
- Global Input/Button Height: `40px` (Dense) or `48px` (Touch targets)
- Sidebar Width: `240px` (Strict constraint)
- Border Radius:
  - Global `var(--radius): 6px`
  - Small elements `var(--radius-sm): 4px`

## 4. Interaction Patterns
- **Primary Actions:** A solid, high-contrast block (e.g., solid blue with white text). No gradient.
- **Secondary Actions:** Outline button with `var(--border)` and `var(--raised)` hover.
- **Inputs:** Strict rectangular inputs with solid borders. Clear `2px solid var(--accent)` ring on focus.
- **Empty States:** Stark icons, muted text, always one clear primary action.
- **Animation:** 
  - `transform 120ms` and `background-color 120ms`. 
  - No slow, decorative fades.

## 5. POS (Point of Sale) Contract
- **Cart Context:** Always fixed to the right on desktop (`320px` to `360px` wide). High contrast total row.
- **Product Grid:** Tight padding. Strict vertical alignment. Stock levels always visible in a high-contrast badge.
- **Checkout Action:** The most visually dominant button on the screen. Fixed at the bottom of the cart.
