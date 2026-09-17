# Mama Afrika Market: Brand Guidelines v2.0 ("Golden-hour glass")

This is the brand source of truth for the storefront. Every value below is copied from the code that ships:
tokens from `public/css/base.css`, copy from `public/*.html` and `public/js/*.js`, the mark from `public/img/logo.svg`.
If this document and `base.css` ever disagree about a value, `base.css` wins and this file gets fixed.
A machine-readable export of the tokens lives next to it in `docs/design-tokens.json`.

v2.0 changes the surface system only (neo-brutalist cream slabs became frosted glass over a sunset sky) and adds one
colour family (hibiscus). Palette, type, motifs, logo and voice are unchanged.

## Quick reference

| Thing | Value |
|---|---|
| Name | **Mama Afrika Market** (always three words, "Afrika" with a k). Short form in running copy: "Mama Afrika". Never "Mama Africa", "MAM" (code-only namespace), or "Mama Afrika's". |
| Primary Color | #C8552F (`--clay-500`, "clay") |
| Accent Color | #F2A93B (`--saffron-500`, "saffron"; the call-to-action colour) |
| Secondary Color | #2A1A11 (`--cocoa-900`, "cocoa"; text and smoked chrome) |
| Ground | #FFF9EF (`--cream-100`) as pane colour, #FDE9CF (`--color-bg`) under the sky |
| Dusk addition | #8E1B3A (`--hibiscus-600`, bissap red) |
| Display font | Fraunces (variable: `opsz`, `wght`, `SOFT`, italic) |
| Body font | Karla |
| Voice | Warm, food-first, specific |
| Surface system | Frosted cream panes and smoked cocoa chrome over a fixed sunset sky |
| Page title pattern | `Page name | Mama Afrika Market`, sentence case |

## 1. Brand essence

**What we are.** An online market for authentic African food: spices, sauces, staples, snacks, drinks and meal kits,
bought directly from smallholder co-ops in nine countries, shipped within 48 hours, with a recipe card from a home cook
in every box.

**Positioning.** For people who grew up on this food and will not accept a dusty substitute, and for curious cooks who
want to get it right. Against the supermarket "world foods" shelf we offer freshness and provenance. Against generic
gourmet shops we offer cooks who actually eat this food every day.

**Essence in one line** (from the home hero): "Taste the whole continent, delivered."

**The founding rule** (from the About page): "If I can't tell you who grew it, I won't sell it to you. That's the whole rule."

**Personality.**

| Trait | Means | Does not mean |
|---|---|---|
| Aunty-warm | Welcoming, generous, a little bossy about pepper | Cute, gushing, exclamation marks everywhere |
| Food-first | The dish, the smell, the pot come before the business | Lifestyle fluff, "curated experiences" |
| Specific | Surulere, Kano, Kaolack, eighty-litre pots, a two-ring hob | "Exotic", "ethnic", "tribal", "the dark continent" |
| Proud, not precious | Pan-African and plain-spoken about quality | Poverty framing, charity tone, safari cliches |
| Straight | Short sentences, real numbers, honest demo notices | Hype, urgency tricks, superlatives without proof |

## 2. Voice and tone

### Principles

1. **Name the place and the dish.** "Jollof kits from Lagos, berbere from Addis, shito from Accra." A place name beats an adjective every time.
2. **Lead with food, follow with logistics.** "Spices ground this month, not this year." then "Orders leave our warehouse within two days."
3. **Talk like a cook.** "Nobody in Lagos measures pepper. You taste, you adjust, you taste again."
4. **Numbers are proof.** 9 countries, 42+ co-ops, 48h dispatch, 31k kitchens, free shipping over $60. Use the same numbers everywhere.
5. **Swahili and pidgin touches are seasoning.** `Karibu` (welcome) for arrivals and sign-ups, `Asante` (thank you) for completed orders. One per screen at most, never in error messages, never translated in brackets. Dish names keep their own spelling: ndolé, chin chin, shito, bissap, suya, egusi, ugali.
6. **British spelling** (favourites, colourings, flavour, neighbour), prices in US dollars, no emoji (icons are inline SVG).
7. **Punctuation.** Full stops and commas. No em dashes in customer-facing copy; use a full stop, a comma, or a middle dot (`·`) for metadata such as "Pan-African pantry · ships in 48h". Headlines end with a full stop.
8. **One italic word per headline.** The display headline pattern wraps exactly one stressed word in `.italic-accent`: "Six aisles, *one* market.", "Four rules we *don't* bend.", "Hungry *yet?*"

### Vocabulary

| Use | Instead of | Why |
|---|---|---|
| **basket** (visible copy: "Your basket", "Add to basket", "View basket") | cart | London-born brand, British spelling elsewhere. "cart" stays in code, ids, test ids and URLs. |
| **aisle** | category | The market metaphor: "Browse by aisle", "This aisle doesn't exist.", "More from this aisle." |
| **the market** | the store, the shop site | "Shop the market" |
| **co-op, smallholder, farm gate** | supplier, vendor | Provenance is the product |
| **recipe card**, **home cook** | instructions, chef | "written by a home cook from that region, not a test kitchen" |
| **kitchen**, **pot**, **stovetop** | household, customer base | "31k kitchens fed" |
| authentic (sparingly, meta descriptions only) | exotic, ethnic, tribal, superfood, artisanal, curated | Those words describe us from the outside |

### Do and don't, from real site copy

| Context | Do (shipping today) | Don't |
|---|---|---|
| Hero | "Jollof kits from Lagos, berbere from Addis, shito from Accra. Sourced from smallholder farms, packed by people who cook this food every day." | "Discover a curated world of exotic flavours — elevated, authentic, unforgettable." |
| Value prop | "Spices ground this month, not this year." | "We are passionate about freshness and quality." |
| About | "It costs more. It also tastes like the thing it is supposed to taste like." | "Our premium small-batch process delivers best-in-class taste." |
| Category tile | "Jollof, ndolé and friends. Dinner in under an hour." | "Convenient meal solutions for busy lifestyles." |
| Empty state | "Your basket is empty. Fill it with jollof kits, berbere, shito and more." | "No items." |
| 404 | "This aisle doesn't exist." | "Oops! Something went wrong!!" |
| Form helper | "Where should the good stuff go?" / "For the courier, in case they can't find you." | "Please provide your shipping information below." |
| Success | "Asante! Your order is on its way." / "Karibu! You're on the list. Recipes and offers are on their way." | "Asante sana! Karibu tena! Hakuna matata!" (seasoning, not a costume) |
| Error | "That card number does not look right. Check the digits." | "Invalid input." or a joke. Errors are calm, plain and say what to do next. |
| Promo | "Try KARIBU10 for 10% off your first order." | "HURRY!!! Limited time only!" |

### Tone by context

| Context | Tone | Notes |
|---|---|---|
| Home, About, category pages | Warm and vivid | Places, dishes, people by name |
| Product cards and pages | Sensory and practical | What it tastes like, what to cook, what it pairs with ("Pairs beautifully with pounded yam.") |
| Basket, checkout | Calm, brief, reassuring | One friendly line per step, then get out of the way |
| Errors, stock problems | Plain, specific, no blame, no Swahili | Say what happened and what to do |
| Confirmation, newsletter | Celebratory, one Asante or Karibu | Then the facts: order number, delivery estimate |
| Legal, demo notices | Straight | "Demo store, no real orders are shipped." |

## 3. Messaging pillars

| Pillar | Claim | Proof points (keep these numbers consistent) | Signature line |
|---|---|---|---|
| Straight from the source | We buy from the people who grow it | 9 countries, 42+ farming co-ops, prices agreed before planting and paid at the farm gate, "names on every label" | "Every jar has a name behind it." |
| Fresh on purpose | Small batches, fast dispatch | Ground monthly (200 kg batches), sauces cooked weekly (80-litre pots), kits packed to order, out the door in 48 hours | "Spices ground this month, not this year." |
| Cook it tonight | You will actually be able to make it | A recipe card from a home cook of that region in every box, tested on a two-ring hob | "You taste, you adjust, you taste again." |
| The whole continent, one table | Pan-African, not one cuisine | Six aisles; Nigeria, Ghana, Ethiopia, Cameroon, Senegal, South Africa, Mozambique, Kenya, Tanzania | "9 countries · one table" |

Standing offers: free standard shipping over $60, `KARIBU10` (10% off a first order), 30-day happiness guarantee.

## 4. Logo

**The mark** (`public/img/logo.svg`, 48 x 48 viewBox): a cocoa calabash cooking pot (`#2A1A11`) with a clay rim
(`#C8552F`) and a saffron smile line (`#F2A93B`), a leaf sprig (`#4C8A45`) rising from it, under a saffron sun arc with
a clay sun dot. **The favicon** (`public/img/favicon.svg`) is the simplified pot and arc on a rounded cream tile
(`#FFF9EF`, 7px radius on 32px), without sprig or dot.

**The lockup** (rendered by `public/js/layout.js`): the mark in a 44px cream medallion, then the wordmark set in Fraunces
800, `'SOFT' 60, 'opsz' 48`, letter-spacing -0.02em: "Mama Afrika" upright followed by "*Market*" in italic weight 400,
`'SOFT' 100`. The word "Market" is `--clay-600` on light surfaces and `--saffron-500` on smoked surfaces.

Rules:

- The pot is cocoa, so the mark always sits on a light ground. On smoked glass, dark bands or photos, keep the cream medallion (`.brand__mark`). Never place the bare SVG on cocoa, clay or the hibiscus corner of the sky.
- Clear space: at least half the mark's height on every side (22px around the 44px medallion). Nothing but the wordmark enters it.
- Minimum sizes: mark 24px (below that use the favicon drawing), full lockup 140px wide. Below 140px drop to the mark alone, never to a shrunken wordmark.
- Do not recolour, outline, rotate, add shadows to the artwork, stretch, or animate the mark. The medallion may carry the standard glass shadow; the artwork itself stays flat.
- Do not retype the wordmark in Karla or any other face, and do not set "Market" upright or "Mama Afrika" italic.
- The fallback "M" disc (`.brand__fallback`, clay-500 with a cream Fraunces 900 "M") exists only for a failed image load. It is not a logo variant.
- One lockup per view in the header and one in the footer. Do not tile the mark as a pattern; the motifs in section 8 do that job.
- Alt text and accessible name: "Mama Afrika Market" (links: "Mama Afrika Market, home").

## 5. Colour

### Core palette (primitives in `base.css`)

| Family | Token | Hex | Role |
|---|---|---|---|
| Clay | `--clay-900` | #3B1F14 | Deepest earth; the rgb base of every glass shadow (59, 31, 20) |
| | `--clay-800` | #5A2E1C | |
| | `--clay-700` | #7A3F22 | Small clay-coloured text on glass when it may sit over the dusk corner |
| | `--clay-600` | #A2482A | Primary hover, eyebrows, "Market" in the light lockup; safe ground for white text |
| | `--clay-500` | **#C8552F** | **Primary brand colour.** Fills, large display text, kente stripe |
| | `--clay-400` | #DD7A55 | Sky (top right), soft accents |
| | `--clay-100` | #F6DFD2 | Tints |
| Saffron | `--saffron-700` | #B8730E | Icons and non-text accents on light panes (3.65:1, not for body text) |
| | `--saffron-600` | #D98E1C | Accent hover |
| | `--saffron-500` | **#F2A93B** | **Accent / call to action**, always with `--cocoa-950` text (9.17:1) |
| | `--saffron-300` | #F7CB80 | Sky (top left), selection, labels on smoked glass |
| | `--saffron-100` | #FCEFD3 | Tints |
| Cream | `--cream-100` | #FFF9EF | Pane colour, text on smoked glass |
| | `--cream-200` | #F8EEDC | Secondary text on smoked glass |
| | `--cream-300` | #EFE1C6 | Image fallback tint (`safeColor` default) |
| | `--cream-400` | #DCC9A6 | |
| Cocoa | `--cocoa-950` | #1E120C | Smoked glass base, text on saffron |
| | `--cocoa-900` | **#2A1A11** | **Body text**, dark buttons, the pot in the logo |
| | `--cocoa-700` | #4A3327 | Dark button hover |
| | `--cocoa-600` | #5C4436 | Muted text on glass (`--color-text-muted`) |
| | `--cocoa-500` | #6E5546 | Decorative icons, placeholders; never on glass lighter than `--glass-bg-strong` |
| | `--cocoa-300` | #A08B7C | Borders and hover edges only. Not a text colour on any surface (3.09:1 on cream, under 2:1 on smoked glass) |
| Leaf | `--leaf-600` | #3E6B3A | Success text and edge, kente stripe |
| | `--leaf-500` | #4C8A45 | Sky (bottom left), logo sprig |
| | `--leaf-300` | #A9E09D | Success text on smoked glass |
| | `--leaf-100` | #E1EED9 | Success ground, "new" badge |
| Danger | `--danger-700` | #8F1A1A | Error text on tinted error grounds |
| | `--danger-600` | #B42323 | Errors |
| | `--danger-300` | #FFB9AE | Error text on smoked glass |
| | `--danger-100` | #FBE1E1 | Error ground |
| Hibiscus | `--hibiscus-600` | **#8E1B3A** | **The v2 addition: bissap red, the dusk end of the sky.** Sky, orbs, the Drinks aisle, Senegal. With cream text only (8.47:1). |
| | `--hibiscus-300` | #D9778F | Orbs and glows behind panes. Never text. |

Proportions on any screen: sky and cream glass do most of the work (about 70%), cocoa chrome about 20%, clay, saffron and
hibiscus together about 10%. Saffron is reserved for the one primary action in a view plus small sparks (badges, stepper
dots). Hibiscus is atmosphere: it never becomes a button, link or alert colour, so it cannot be confused with danger red.

### Semantic roles

| Token | Resolves to | Use |
|---|---|---|
| `--color-bg` | #FDE9CF | Solid colour under the sky mesh, and the page colour if the mesh fails |
| `--color-bg-elevated` | `--glass-bg-strong` | Legacy name; any "raised" surface is strong glass |
| `--color-bg-muted` | rgba(248, 238, 220, 0.6) | Quiet fills inside a pane |
| `--color-bg-strong` | `--glass-bg-dark` | Legacy name; any dark band is smoked glass |
| `--color-text` / `--color-text-muted` | `--cocoa-900` / `--cocoa-600` | Text on light panes |
| `--color-text-on-strong` | `--cream-100` | Text on smoked panes (secondary: `--cream-200`) |
| `--color-primary` / `-hover` / `--color-on-primary` | `--clay-600` / `--clay-700` / #FFFFFF | Default button (white on clay-600 is 6.0:1; clay-500 stays for fills and display type) |
| `--color-accent` / `-hover` / `--color-on-accent` | `--saffron-500` / `--saffron-600` / `--cocoa-950` | Primary call to action |
| `--color-border` | rgba(59, 31, 20, 0.16) | Hairlines and dividers inside a pane. Not for pane edges. |
| `--color-border-strong` | rgba(59, 31, 20, 0.55) | Control boundaries that must reach 3:1 |
| `--color-success` / `--color-danger` | `--leaf-600` / `--danger-600` | Status |
| `--color-ring` | `--cocoa-900` on light panes (16:1), `--saffron-300` on smoked surfaces (6.2:1) | `:focus-visible` outline (3px, 3px offset). Smoked surfaces (`.glass--dark`, `.card--strong`, header, footer, toasts) override the token; any new dark surface must do the same |

### Product tints

Each product carries its own `color` in `server/data/products.json` (for example suya #B5451B, jollof #C8412B, bissap
#8E1B3A, palm oil #E0591C). These warm food tints are an approved extension of the palette, but only as the ground of a
product image, its card media and its origin swatch, read through `safeColor()`. They are data: do not copy them into
HTML or CSS by hand, and do not use them for text, buttons or panes.

### Contrast (WCAG 2.1, computed from the tokens)

Glass is translucent, so every ratio is a range. "Light sky" is the cream bloom at the centre (about #FEF4E6), "dusk sky"
is the hibiscus corner at bottom right (about #C8766F), which is the darkest thing the base sky puts behind a pane.

| Text | Surface | Light sky | Dusk sky | Verdict |
|---|---|---|---|---|
| `--cocoa-900` | `--glass-bg` | 15.8 | 10.7 | AAA |
| `--cocoa-600` (muted) | `--glass-bg` | 8.5 | 5.8 | AA everywhere |
| `--cocoa-600` | `--glass-bg-strong` | 8.6 | 7.1 | AA everywhere |
| `--cocoa-600` | `--glass-bg-soft` | 8.4 | **4.5** | Fails at dusk: no muted text on soft glass |
| `--cocoa-600` | `--glass-bg` over a `--hibiscus-600` orb | | **4.2** | Fails: keep saturated dark orbs out from under text |
| `--clay-600` (eyebrow) | `--glass-bg` | 5.7 | **3.8** | Use `--clay-700` (7.7 / 5.3) for small clay text that can sit low on the page |
| `--clay-500` | any light pane | 4.1 | 2.8 | Large display text only |
| `--danger-600` | `--glass-bg-strong` | 6.3 | 5.2 | AA. On `--glass-bg` it drops to 4.2 at dusk: errors belong on strong glass |
| `--cream-100` | `--glass-bg-dark` | 9.0 | 12.8 | AAA. Smoked glass is weakest over the bright part of the sky, which is why it is 0.78 dense |
| `--cream-200` | `--glass-bg-dark` | 8.2 | 11.6 | AAA |
| `--saffron-500` | `--glass-bg-dark` | 4.7 | 6.7 | AA, but prefer `--saffron-300` for small labels |
| `--saffron-300` | `--glass-bg-dark` | 6.2 | 8.8 | AA. The small-accent colour on smoke, and the focus ring there |
| `--cocoa-300` | `--glass-bg-dark` | **2.9** | 4.1 | Never |
| `--cocoa-950` | `--saffron-500` | 9.2 | | AAA (accent button) |
| #FFFFFF | `--clay-500` | **4.4** | | Just under AA for normal text. Use `--clay-600` (6.0) under small white text |
| `--cream-100` | `--hibiscus-600` | 8.5 | | AAA |
| `--leaf-600` / `--danger-600` | their `-100` grounds | 5.2 / 5.3 | | AA |
| `--cream-100` | `--saffron-700`, `--saffron-600`, `--leaf-500` | 3.7, 2.6, 4.0 | | Fail: on saffron grounds the text is `--cocoa-950` |

Rules that follow:

- Light panes take `--cocoa-900` and `--cocoa-600`. Smoked panes take `--cream-100` and `--cream-200`. Nothing else is body text.
- Saffron is a ground or a large accent, never small text on cream (2.6:1 to 3.7:1).
- With `prefers-contrast: more` or `prefers-reduced-transparency: reduce`, panes turn solid and every pair above returns to its solid-colour ratio (cocoa-600 on cream 8.6, cream-100 on cocoa-950 17.5).
- The saffron focus ring is 2.5:1 against light panes. Until `base.css` moves to a two-tone ring, never remove the 3px offset, and never place a focusable element where its ring is the only focus cue on a saffron or clay ground.

## 6. Typography

**Fraunces** (display) and **Karla** (body), loaded from Google Fonts in one request at the top of `base.css`. No third
typeface; numerals, prices and initials are Fraunces, everything functional is Karla.

```css
--font-display: 'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
--font-body: 'Karla', 'Segoe UI', Helvetica, Arial, sans-serif;
```

Fraunces is loaded with all four axes: `opsz` 9..144, `wght` 300..900, `SOFT` 0..100, plus italic. `SOFT` rounds the
serifs and terminals; it is where the warmth comes from, so set it deliberately:

| Use | Setting | Notes |
|---|---|---|
| Headings h1 to h3, `.font-display` | `'SOFT' 60, 'opsz' 144` | Weight 700 (h1 800, h3 600), letter-spacing -0.015em, `text-wrap: balance` |
| `.hero-title` | same axes | Weight 900, line-height 0.95, letter-spacing -0.03em |
| `.italic-accent` | `'SOFT' 100, 'opsz' 144` | Italic, weight 400. One word per headline |
| Wordmark | `'SOFT' 60, 'opsz' 48` / accent `'SOFT' 100, 'opsz' 48` | Small optical size keeps it sturdy at 20px |
| `.price` | `'SOFT' 30, 'opsz' 48` | Crisper and more numeric; weight 700 |

Karla: body 400, labels and buttons 700, badges 800. `.eyebrow` is Karla 700, `--text-xs`, uppercase, letter-spacing 0.18em.

| Token | Value | Pixels | Used for |
|---|---|---|---|
| `--text-xs` | 0.75rem | 12 | Eyebrows, badges |
| `--text-sm` | 0.875rem | 14 | Hints, meta, chips |
| `--text-base` | 1rem | 16 | Body (never smaller for running text or inputs) |
| `--text-lg` | 1.125rem | 18 | `.lead` (max 60ch, `text-wrap: pretty`) |
| `--text-xl` | 1.375rem | 22 | h3 |
| `--text-2xl` | 1.75rem | 28 | `.price--lg` |
| `--text-3xl` | clamp(2rem, 1.4rem + 2.2vw, 2.75rem) | 32 to 44 | h2 |
| `--text-4xl` | clamp(2.5rem, 1.6rem + 3.6vw, 4rem) | 40 to 64 | h1 |
| `--text-hero` | clamp(2.75rem, 1.2rem + 6vw, 6rem) | 44 to 96 | `.hero-title` |

Line heights: `--leading-tight` 1.05 (display), `--leading-snug` 1.25, `--leading-normal` 1.55 (body).
Text over glass gets no text-shadow and no gradient fills; legibility comes from the pane density.

## 7. The "Golden-hour glass" surface system

The idea: the market at dusk, seen through amber glass. It must read as an African food market at golden hour, not as a
purple SaaS glass template. Warm sky, cream frost, cocoa smoke, kente at the seams.

### The sky

One fixed layer, `body::before` (`position: fixed; inset: 0; z-index: -1`), not `background-attachment: fixed`, which
repaints on every scroll frame on mobile. Top to bottom it stacks: a 26px cocoa dot grid at 7% (a mudcloth whisper), a
saffron sun top left (`--saffron-300` at 95%), clay top right (`--clay-400` at 70%), hibiscus dusk bottom right
(`--hibiscus-600` at 42%), a breath of leaf bottom left (`--leaf-500` at 26%), a cream bloom at the centre for reading
comfort, and a linear base #FFF1D6 to #FBD9B5 to #F2B896. Under it all is `--color-bg` #FDE9CF.
Do not add a second page-level background, and do not hide the sky behind opaque full-width sections.

### Panes

Every pane is: a translucent background token, `-webkit-backdrop-filter` and `backdrop-filter` from the filter tokens,
a 1px lit edge, and a glass shadow. Use the primitives (`.glass`, `.card`, and the modifiers) or the same four tokens.

| Token (class) | With blur | Without blur | Use for | Text allowed |
|---|---|---|---|---|
| `--glass-bg-soft` (`.glass--soft`, `.btn--outline`) | cream at 0.40 | 0.86 | Decorative panes, outline buttons, stamps | A few words of `--cocoa-900`. Never muted text |
| `--glass-bg` (`.glass`, `.card`, `.chip`) | cream at 0.62 | 0.92 | The default pane: product cards, tiles, quotes, summaries | Body and muted text |
| `--glass-bg-strong` (`.glass--strong`, `--color-bg-elevated`) | #FFFBF4 at 0.80 | 0.96 | Forms, long text (the About essay), order summary, alerts, dropdowns | Everything, including errors |
| `--glass-bg-tint` (`.glass--tint`) | saffron at 0.42 | 0.90 | One highlight pane per view: a promo, a free-shipping nudge | `--cocoa-950` only, short |
| `--glass-bg-dark` (`.glass--dark`, `.card--strong`, `--color-bg-strong`) | cocoa-950 at 0.78 | 0.94 | Smoked chrome: header, footer, cart drawer, dark bands, active chips, toasts | `--cream-100`, `--cream-200`; saffron for large accents |

Inputs are the densest glass of all (`rgba(255, 253, 249, 0.86)`, solid #FFFDF9 on focus) and carry no blur, because a
form has many of them. Typed text must never fight the sky.

### Lit edges, shadows, sheen

- **Lit edge.** Light panes: `--glass-border` rgba(255, 255, 255, 0.7). Smoked panes: `--glass-border-dark` rgba(255, 249, 239, 0.16). Always 1px. `--color-border` is for dividers inside a pane, never for its edge.
- **Shadows.** `--glass-shadow` at rest (it contains the inset top highlight, so always use the whole token), `--glass-shadow-lift` on hover or for the one raised element, `--glass-shadow-dark` for smoked panes, `--glass-glow` (a saffron halo) only on the primary call to action. Shadow colour is clay-900, never neutral black or grey. `--shadow-hard` is a legacy alias of the lift shadow; do not use it in new code.
- **Sheen.** `--glass-sheen` via `.glass--sheen`: a diagonal highlight across the top-left corner at 60% opacity. Hero tiles and feature panes only, at most two or three per view. It needs `position: relative; overflow: hidden` on the pane.
- **Radii.** Panes `--radius-lg` 20px (feature panes `--radius-xl` 28px), inputs `--radius-md` 12px, buttons, chips and badges `--radius-pill`.
- **Depth.** Give the blur something to refract: a few blurred orbs (`--saffron-300`, `--clay-400`, `--hibiscus-300`) or a kente or mudcloth accent behind panes, absolutely positioned, `pointer-events: none`, `aria-hidden`, clipped by the section (`overflow: clip`). Keep dark, saturated orbs (`--hibiscus-600`, cocoa) out from under panes that carry muted text.

### Smoked chrome

Header, footer, cart drawer, toasts and full-width dark bands are smoked cocoa glass, `--glass-bg-dark`, either edge to
edge or as inset rounded panes. The logo keeps its cream medallion there. Kente stripes sit at the seam between chrome
and page. Small text on smoke is cream; saffron is for large numerals, icons and the wordmark accent.

### Hard rules

1. Blur never exceeds 20px (`--glass-blur` is 18px, the soft filter 10px). Do not write `blur()` by hand; use `--glass-filter` or `--glass-filter-soft`.
2. Never transition or animate `backdrop-filter`, `filter: blur()` or the glass background alpha. Animate `transform`, `opacity` and `box-shadow` only.
3. Text sits on `--glass-bg` or denser. Long text, forms and errors sit on `--glass-bg-strong`. Muted text never sits on `--glass-bg-soft`.
4. No more than two blurred layers stacked (a pane inside a pane is the limit; a chip inside a card inside a blurred section is too many).
5. A `backdrop-filter` element is a containing block for fixed children and a stacking context. Keep the cart drawer, toasts and dropdowns outside blurred ancestors, and keep the header sticky.
6. No solid cream, white or cocoa page sections. If it spans the page, it is glass or it is the sky.
7. Always go through the tokens, because the fallbacks depend on them:
   - **No `backdrop-filter`:** the `:root` defaults are near-opaque (0.86 to 0.96), so panes stay legible without blur.
   - **`prefers-reduced-transparency: reduce` or `prefers-contrast: more`:** panes become solid (#FFF9EF, #FFFDF8, #1E120C, saffron-500), filters become `none`, and the lit edge becomes a dark hairline rgba(59, 31, 20, 0.3).
   A hard-coded `rgba(...)` background or a literal `blur(10px)` silently opts out of both.
8. No neo-brutalist leftovers: no 2px cocoa borders, no offset shadows such as `4px 4px 0`, no dashed boxes.

## 8. Pattern motifs

Motifs are texture, not wallpaper. They mark seams and fill art blocks; they never sit under body text and never fill a
whole pane that carries copy.

| Motif | Class | Made of | Where |
|---|---|---|---|
| Kente stripe | `.pattern-kente` | 66px repeat: clay-500 18, saffron-500 18, cocoa-900 6, leaf-600 18, cocoa-900 6 | Thin bands (6 to 12px) at seams: under heroes, on top of the footer, under the stats band. One per seam, at most two in view. Same stripe order everywhere. |
| Mudcloth (bogolan) | `.pattern-mudcloth` | cocoa-900 ground, 24px cream grid at 8%, saffron dots at 35% | Art blocks inside dark panes (the story quote, one category tile). Large Fraunces quotes only on top of it. The sky's dot grid is the same motif at a whisper. |
| Zigzag | `.pattern-zigzag` | 24px saffron-500 chevrons on clay-500 | Small, loud accents: stickers, corner tabs, empty-state art. Never behind text, never larger than about 160px. The same chevron appears at 15% in product illustrations. |
| Grain | `.grain::after` | fractal noise, 18% opacity, multiply | Hero sections only, to take the digital edge off the gradient. |

Use the motifs respectfully: these are living textile traditions (Asante and Ewe kente, Bamana bogolanfini). Keep them
abstracted as they are here, do not mix in unrelated "tribal" clip art, and do not recolour them outside the palette.

## 9. Iconography and illustration

**Icons.** Inline SVG in the Lucide style from `icon()` in `public/js/components.js`: 24 x 24 viewBox, `fill: none`,
`stroke: currentColor`, stroke-width 2, round caps and joins. Sizes 16 (`.icon--sm`), 20 (default) and 28 (`.icon--lg`).
Icons take their colour from the text around them. Never emoji, never filled or two-tone icon sets, never an icon
without a text label or an `aria-label` on its control. Decorative icons carry `aria-hidden="true"`.

**Product illustration** (`public/img/*.svg`, 600 x 600): flat vector, no gradients, no outlines, no drop shadows. A
full-bleed ground in the product's own tint, the chevron pattern in cream at 15%, then the food and its packaging drawn
from rounded rectangles and circles in palette colours (cream tin, cocoa lid, clay label, saffron and leaf details),
usually tilted 20 to 40 degrees, one hero object plus one hint of the dish. Every file has a `<title>`. On the site the
illustration sits in a tinted media block at the top of a glass card; the glass never covers the illustration.

**People.** No stock photography. People appear as initials in a Fraunces 800 disc (`--av` colour from the palette,
cream text, so the disc must be clay-500 or darker, leaf-600, or hibiscus-600; on saffron discs use cocoa-950 text).
**Countries** appear as ISO-2 letter codes (NG, GH, ET) in a tinted square, never as flag emoji.

## 10. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 150ms | Hover, press, colour changes |
| `--dur-base` | 240ms | Buttons, shadows, drawer |
| `--dur-slow` | 480ms | `.reveal` and `.stagger` entrances |
| `--ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | Default |
| `--ease-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | Small confirmations only: the basket count bump, a check mark |

Motion is a lift, never a bounce-house: panes rise 1 to 4px and swap `--glass-shadow` for `--glass-shadow-lift`; content
enters once with `.reveal` (18px rise and fade) or `.stagger` (60ms steps, capped at the ninth child). Nothing loops
except loaders (`.skeleton` shimmer, the button spinner). Only `transform`, `opacity` and `box-shadow` animate.
`prefers-reduced-motion: reduce` collapses every animation and transition to 0.01ms and turns off smooth scrolling;
JavaScript timers (the drawer close) check the same media query.

## 11. Accessibility commitments

- WCAG 2.1 AA: 4.5:1 for text, 3:1 for large text, control boundaries and focus indicators, measured against the worst sky behind the pane (section 5), not the prettiest.
- The three glass fallbacks (no blur support, reduced transparency, more contrast) are part of the design and are checked on every surface change.
- `:focus-visible` always shows: 3px `--color-ring` outline, 3px offset, cocoa on light panes and saffron-300 on smoked ones. Never `outline: none` without a replacement of equal weight.
- Touch targets are at least 44 x 44px (`.btn` 48px, `.btn--icon` and `.qty__btn` 44px, `.chip` 40px with spacing).
- Reduced motion is honoured in CSS and JS.
- Every page has a skip link, one h1, `lang="en"`, a unique title and meta description; decorative art is `aria-hidden`; product images in cards are decorative because the product name is the link.
- Colour is never the only signal: errors add text and an icon, sale prices add a strikethrough, the free-shipping bar has a sentence.
- Visible labels and accessible names use the same word (a button that says "Basket" is not named "Open cart").
- Copy is plain English at a comfortable reading level. Swahili touches are never required to understand an action.

## 12. Consistency checklist for future changes

Visual
- [ ] Every colour is a token. No new hex values in HTML, CSS or JS (product tints arrive through `product.color` and `safeColor()`).
- [ ] New surface uses a pane token, the filter token with its `-webkit-` twin, `--glass-border` or `--glass-border-dark`, and a glass shadow token.
- [ ] Text sits on `--glass-bg` or denser; forms, long text and errors on `--glass-bg-strong`; no muted text on soft glass; smoked panes use cream text.
- [ ] Checked over the light centre and the hibiscus corner of the sky, at 390px and 1360px, with no horizontal overflow.
- [ ] Checked with blur unsupported, with reduced transparency and with more contrast.
- [ ] No blur above 20px, no animated `backdrop-filter`, no more than two blurred layers, fixed children not trapped inside a blurred ancestor.
- [ ] Headings are Fraunces with the documented axes, one italic accent word; everything else is Karla; no new fonts.
- [ ] Icons are stroke-2 inline SVG; no emoji; motifs only at seams and in art blocks.
- [ ] The logo sits on its cream medallion, unmodified, with clear space.

Voice
- [ ] The name is "Mama Afrika Market" (or "Mama Afrika" in running copy). Title is `Page | Mama Afrika Market`, sentence case.
- [ ] Says basket, aisle, co-op, recipe card. Names a place or a dish where it can.
- [ ] Numbers match: 9 countries, 42+ co-ops, 48 hours, $60 free shipping, KARIBU10.
- [ ] At most one Karibu or Asante on the screen, none in errors.
- [ ] No em dashes, no exclamation pile-ups, no "exotic / ethnic / tribal / curated / elevated".
- [ ] Errors say what happened and what to do next.

Meta and tokens
- [ ] Unique meta description of 50 to 160 characters in brand voice; `theme-color` is #2A1A11 (the smoked header) on every page.
- [ ] Favicon is `/img/favicon.svg`.
- [ ] If a token changed in `base.css`, this file and `docs/design-tokens.json` changed in the same commit. The JSON is a verbatim export of the `:root` blocks (including the `@supports` and reduced-transparency overrides); regenerate it by parsing `base.css`, never by hand, and do not run generic brand-sync scripts that invent colour scales.
