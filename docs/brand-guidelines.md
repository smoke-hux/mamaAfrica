# Mama Afrika Market: Brand Guidelines v3.0 ("Golden-hour glass", Kenya edition)

This is the brand source of truth for the storefront. Every value below is copied from the code that ships:
tokens from `public/css/base.css`, numbers from `public/js/pricing.js` and `public/js/format.js`, products from
`server/data/products.json`, copy from `public/*.html` and `public/js/*.js`, the mark from `public/img/logo.svg`.
If this document and the code ever disagree about a value, the code wins and this file gets fixed.
A machine-readable export of the tokens lives next to it in `docs/design-tokens.json`.

v3.0 localises the store to Kenya. What changed: brand essence and positioning, voice (Kenyan English, light
Swahili), vocabulary, messaging pillars and every canonical number, currency, place names, the product catalogue
(20 products, six aisles, a new Restaurant Picks aisle), the product illustration recipe and the consistency
checklist. What did not change: the logo, the palette, typography, the "Golden-hour glass" surface system, the
motifs, motion and the accessibility commitments. Those sections are carried over from v2.0 as they were.

## Quick reference

| Thing | Value |
|---|---|
| Name | **Mama Afrika Market** (always three words, "Afrika" with a k). Short form in running copy: "Mama Afrika". Never "Mama Africa", "MAM" (code-only namespace), or "Mama Afrika's". |
| What we are | A Nairobi online market that delivers Kenya's kitchens: Kericho tea, Mwea rice, Mombasa spice, Nairobi choma, plus picks from real Nairobi restaurants |
| Primary Color | #C8552F (`--clay-500`, "clay") |
| Accent Color | #F2A93B (`--saffron-500`, "saffron"; the call-to-action colour) |
| Secondary Color | #2A1A11 (`--cocoa-900`, "cocoa"; text and smoked chrome) |
| Ground | #FFF9EF (`--cream-100`) as pane colour, #FDE9CF (`--color-bg`) under the sky |
| Dusk addition | #8E1B3A (`--hibiscus-600`) |
| Display font | Fraunces (variable: `opsz`, `wght`, `SOFT`, italic) |
| Body font | Karla |
| Voice | Warm, food-first, specific. Kenyan English with light Swahili |
| Currency | Kenyan shillings, written "KSh 1,250" (see section 3) |
| Surface system | Frosted cream panes and smoked cocoa chrome over a fixed sunset sky |
| Page title pattern | `Page name | Mama Afrika Market`, sentence case |

## 1. Brand essence

**What we are.** A Nairobi market that delivers Kenya's kitchens. Twenty products across six aisles: meal kits
(pilau, ugali and sukuma, mukimo), spices and sauces, staples and flours, snacks, tea and coffee, and a Restaurant
Picks aisle of plates from real Nairobi restaurants. The pantry comes from the places that do each thing best:
Kericho tea, Mwea pishori rice, Mombasa pilau masala and mandazi, Nyeri coffee and mukimo, Nakuru maize flour and
chilli, Lamu kashata, Kiambu greens. Delivery is next day or same day within Nairobi, or collect for free in Westlands.

**Positioning.** For Nairobi households who know exactly what pilau should smell like and will not accept a dusty
substitute, and for anyone who wants to cook Kenyan food properly. Against the supermarket aisle we offer
provenance: the county on every label and the co-op behind it. Against the delivery apps we offer the whole meal,
not just the plate: the kit, the spice, the flour and the recipe card, and when you want the restaurant version,
the restaurant version.

**Essence in one line:** "Kenya's kitchens, delivered."

**The founding rule** (About page): "If I can't tell you who grew it, I won't sell it to you. That's the whole rule."

**Personality.**

| Trait | Means | Does not mean |
|---|---|---|
| Aunty-warm | Welcoming, generous, a little bossy about kachumbari | Cute, gushing, exclamation marks everywhere |
| Food-first | The dish, the smoke, the sufuria come before the business | Lifestyle fluff, "curated experiences" |
| Specific | Kimathi Street, the Eastern Bypass, Mwea paddies, a 2 kg bag, a jiko on a Sunday | "Exotic", "ethnic", "tribal", "authentic African experience" |
| Proud, not precious | Kenyan and plain-spoken about quality; Nairobi is the customer, not the backdrop | Safari cliches, "Out of Africa" framing, poverty or charity tone |
| Straight | Short sentences, real numbers, honest demo notices | Hype, urgency tricks, superlatives without proof |

## 2. Voice and tone

### Principles

1. **Name the place and the dish.** "Pilau masala from Mombasa, pishori from Mwea, tea from Kericho." A place name beats an adjective every time.
2. **Lead with food, follow with logistics.** "Kachumbari on the side is not optional." then "Next-day delivery in Nairobi, KSh 250."
3. **Talk like a cook.** "Nobody in Mombasa measures pilau masala. You smell, you adjust, you smell again."
4. **Numbers are proof.** 20 products, 8 counties and regions, 5 restaurant picks, free delivery from KSh 3,000, next day KSh 250, same day KSh 450, Westlands pickup free. Use the same numbers everywhere (section 3).
5. **Swahili is seasoning, not a costume.** Kenyan English is the language of the store. Swahili words appear where a Nairobi shopper would actually use them, one per screen at most, never in error messages, never translated in brackets:

   | Word | Use it for | Example |
   |---|---|---|
   | Karibu | Arrivals and sign-ups | "Karibu! You're on the list." (ships) |
   | Asante | A completed order | "Asante! Your order is on its way." (ships) |
   | Sawa | A small confirmation, sparingly | "Sawa, added to your basket." |
   | chai | Tea as a drink and a moment | "Chai time, sorted." (the aisle is still "Tea, Coffee & Drinks") |
   | chapo | Chapati in running copy | "Chapo flour that actually puffs." (the product name stays "Chapati Wheat Flour") |
   | kuku, choma, nyama choma | Chicken, roast, roast meat | "Quarter kuku choma with ugali." |

   Dish and ingredient names keep their own spelling and are not italicised: ugali, sukuma wiki, kachumbari, pilau,
   biryani, mukimo, mandazi, bhajia, kashata, ukwaju, tangawizi, njahi, mchuzi, unga. Explain once on a product page
   if it helps ("sukuma wiki (collard greens)"), never in a headline.
6. **What to avoid.**
   - Heavy Sheng. "Niaje msee, chapa order" is not our voice. If a word needs a Nairobi-under-30 to decode it, leave it out. "Sawa" and "poa" are the limit, and "poa" only in a toast.
   - Mock accents and phonetic spellings. Never write English the way a cartoon thinks Kenyans speak it.
   - Tourist Swahili: "Hakuna matata", "Jambo!", "Asante sana, karibu tena!" stacked into one line.
   - "Exotic", "ethnic", "tribal", "safari", "the wild", "discover Africa". We are describing home, not a holiday.
   - Em dashes. Full stops, commas or a middle dot (`·`) for metadata such as "Nairobi pantry · next-day delivery".
   - "Ksh", "KSH", "Kshs", "Sh.", "/=" and "KES" in visible copy (section 3).
   - Claiming a restaurant partnership that does not exist (section 4).
7. **British spelling** (favourites, flavour, neighbour, colour). No emoji; icons are inline SVG.
8. **Punctuation.** Headlines end with a full stop. No exclamation pile-ups: one "!" after Karibu or Asante is the whole budget.
9. **One italic word per headline.** The display headline pattern wraps exactly one stressed word in `.italic-accent`: "Six aisles, *one* market.", "Four rules we *don't* bend.", "Hungry *yet?*"

### Vocabulary

| Use | Instead of | Why |
|---|---|---|
| **basket** (visible copy: "Your basket", "Add to basket", "View basket") | cart | British spelling throughout. "cart" stays in code, ids, test ids and URLs. |
| **aisle** | category | The market metaphor: "Browse by aisle", "This aisle doesn't exist.", "More from this aisle." |
| **the market** | the store, the shop site, the app | "Shop the market" |
| **county** (Nakuru, Nyeri, Kiambu) and **region** (Mwea, Old Town) | state, province | Kenya has counties. "State" never appears in visible copy; the `state` form field is labelled "County" or "County / Region" (the field name stays `state` in code and the API). |
| **co-op, smallholder, farm gate** | supplier, vendor | Provenance is the product |
| **restaurant pick** | partner restaurant, collaboration | We list, we do not partner (section 4) |
| **delivery** ("next-day delivery", "same-day delivery") | shipping, dispatch, courier service | Nothing ships; a rider brings it. "shipping" stays in code (`shippingMethod`, `FREE_SHIPPING_THRESHOLD`). |
| **pickup** ("Pick up in Westlands") | click and collect, store collection | One word, one place |
| **M-Pesa** (capital M, hyphen, capital P) | Mpesa, MPESA, mobile money (as the label) | The visible option is "Mobile Money" with "M-Pesa first" in the hint |
| **VAT** ("VAT (16%)") | tax, sales tax, GST | It is what the receipt says in Kenya |
| **recipe card**, **home cook** | instructions, chef | "written by a home cook from that county, not a test kitchen" |
| **jiko** (charcoal stove), **sufuria** (cooking pot), **kachumbari** (tomato-onion salad) | grill, saucepan, salsa | The words a Kenyan kitchen uses. No translation in brackets in headlines; once in body copy if needed. |
| **kitchen**, **pot**, **stovetop** | household, customer base | "Kenya's kitchens" |
| authentic (sparingly, meta descriptions only) | exotic, ethnic, tribal, superfood, artisanal, curated | Those words describe us from the outside |

### Do and don't, in the Kenya edition

| Context | Do | Don't |
|---|---|---|
| Hero | "Pilau masala from Mombasa, pishori from Mwea, tea from Kericho. Grown by people with names, packed by people who cook this food every day." | "Discover the authentic flavours of Africa — an exotic culinary safari, delivered." |
| Value prop | "Tea from this season's Kericho flush, not last year's." | "We are passionate about freshness and quality." |
| About | "It costs more than the supermarket. It also tastes like the thing it is supposed to taste like." | "Our premium small-batch process delivers best-in-class taste." |
| Category tile | "Pilau, ugali and sukuma, mukimo. Dinner in under an hour." | "Convenient meal solutions for busy lifestyles." |
| Restaurant pick | "Kilimanjaro Jamia on Kimathi Street has fed the CBD for decades, and the beef pilau is the reason." | "Our exclusive partner Kilimanjaro Jamia brings you their world-famous pilau!" |
| Delivery | "Next-day delivery in Nairobi is KSh 250, same day KSh 450. Free from KSh 3,000. Or pick up in Westlands for free." | "Ships in 3–5 business days." |
| Payment | "Pay with M-Pesa, card or cash to the rider." | "We accept all major payment methods." |
| Empty state | "Your basket is empty. Fill it with pilau kits, Kericho tea, kachumbari chilli and more." | "No items." |
| 404 | "This aisle doesn't exist." | "Oops! Something went wrong!!" |
| Form helper | "Where should the good stuff go?" / "For the rider, in case they can't find you." | "Please provide your shipping information below." |
| Success | "Asante! Your order is on its way." / "Karibu! You're on the list. Recipes and offers are on their way." | "Asante sana! Karibu tena! Hakuna matata!" |
| Error | "That card number does not look right. Check the digits." / "That M-Pesa number needs 10 digits, starting with 07 or 01." | "Invalid input.", a joke, or Swahili |
| Promo | "Try KARIBU10 for 10% off your first order." | "HURRY!!! Limited time only!" |
| Sheng | "Sawa, added to your basket." | "Niaje! Umechapa order, fiti!" |

### Tone by context

| Context | Tone | Notes |
|---|---|---|
| Home, About, aisle pages | Warm and vivid | Places, dishes, people by name |
| Product cards and pages | Sensory and practical | What it tastes like, what to cook, what it pairs with ("Kachumbari on the side is not optional.") |
| Restaurant Picks | Plain and local | Where it is, what comes on the plate, "Delivered hot within Nairobi". No superlatives, no claims on the restaurant's behalf |
| Basket, checkout | Calm, brief, reassuring | One friendly line per step, then get out of the way |
| Errors, stock problems | Plain, specific, no blame, no Swahili | Say what happened and what to do |
| Confirmation, newsletter | Celebratory, one Asante or Karibu | Then the facts: order number, delivery day |
| Legal, demo notices | Straight | "Demo store, no real orders are shipped." |

## 3. Messaging pillars and canonical numbers

| Pillar | Claim | Proof points (keep these numbers consistent) | Signature line |
|---|---|---|---|
| Straight from the county | We buy from the people who grow it | 8 counties and regions (Mombasa, Nairobi, Kiambu, Nyeri, Nakuru, Mwea, Lamu, Kericho), co-ops named on the label, prices agreed before harvest and paid at the farm gate | "Every bag has a county on it." |
| Fresh on purpose | Small batches, fast delivery | Masala ground monthly, flour milled this month, next-day delivery in Nairobi, same day if you need it | "Tea from this season's flush, not last year's." |
| Cook it tonight | You will actually be able to make it | A recipe card from a home cook of that county in every kit, tested on a two-ring stove and a jiko | "You smell, you adjust, you smell again." |
| Nairobi's table, Kenya's kitchens | Coast, Central, Rift and Lake on one plate | 20 products, six aisles, 5 restaurant picks from real Nairobi restaurants | "8 counties · one table" |

### Canonical numbers (from `pricing.js`, `format.js`, `products.json`, `orders.js`)

| Fact | Value | Say it as |
|---|---|---|
| Free delivery threshold | `FREE_SHIPPING_THRESHOLD = 3000`, applies to standard delivery after discount, at or above | "Free next-day delivery from KSh 3,000" (not "over", the rule is at-or-above) |
| Standard delivery | KSh 250, next day, Nairobi | "Next-day delivery in Nairobi, KSh 250" |
| Express delivery | KSh 450, same day, Nairobi. Never free. | "Same-day delivery in Nairobi, KSh 450" |
| Pickup | KSh 0, Westlands, ready today | "Pick up in Westlands (free)" |
| Delivery area | Nairobi and its environs | Never promise delivery outside Nairobi |
| VAT | `TAX_RATE = 0.16` | "VAT (16%)" on every summary line. Never "Tax" |
| Payment order | Mobile Money (M-Pesa first, then Airtel Money), then Card, then Cash on delivery | "Pay with M-Pesa, card or cash to the rider." Mobile Money is the default-checked option |
| Promo codes | `KARIBU10` 10% off, `PILAU20` 20% off, `FREESHIP` free standard delivery | Always uppercase, always in code font or a chip |
| Order caps | 20 per line, 60 units per order | "Up to 20 of each item, 60 items per order" |
| Catalogue | 20 products, six aisles, 5 restaurant picks, 8 counties and regions | "Six aisles, one market." |
| Aisles, in order | Meal Kits, Restaurant Picks, Spices & Sauces, Staples & Flours, Snacks & Bites, Tea, Coffee & Drinks | The `CATEGORY_LABELS` spelling, ampersand included |

Standing offers: free next-day delivery from KSh 3,000, `KARIBU10` (10% off a first order), free Westlands pickup.
There is no "30-day happiness guarantee" in the Kenya edition; do not reintroduce it without a returns policy.

### Currency rules

- The symbol is **KSh**, capital K, capital S, lower-case h, followed by a space, then the amount with thousands
  separators: **KSh 1,250**. This is what `money()` in `public/js/format.js` prints (`en-KE` locale).
- Catalogue prices are whole shillings and print without decimals: "KSh 850", never "KSh 850.00".
- Computed lines (VAT, discounts) may carry cents and `money()` prints two decimals only then ("KSh 35.20").
  Never hand-write a price; every visible amount goes through `money()`.
- "KES" is the ISO code and lives only in code, APIs and data (`CURRENCY = 'KES'`). It does not appear in copy.
- No "Ksh", "KSH", "Kshs", "Sh.", "Shs", "/=", "$" or "£" anywhere on the storefront, including hints, placeholders
  and meta descriptions. Sale prices show the old price struck through: "KSh 850 ~~KSh 950~~".
- Free things say "free", not "KSh 0", except in a totals table where the row must add up.

## 4. Restaurant Picks policy

The Restaurant Picks aisle lists five plates from real Nairobi restaurants: Kilimanjaro Jamia (Nairobi CBD),
Swahili Plate (Nairobi), Mama Oliech (Kilimani), Kipevu Restaurant (Nairobi) and Kamakis (Eastern Bypass).
These are real businesses that have not agreed to anything with us, so the rules are strict.

1. **Source.** Every pick is a dish that appears on the restaurant's public delivery menu (Glovo or Uber Eats).
   We do not invent dishes, sizes or sides. The `origin` field is "Restaurant, area" ("Mama Oliech, Kilimani").
2. **The non-affiliation sentence** appears on the About page and in the product page perks for every pick,
   verbatim: "Restaurant picks are listed from public delivery menus for this demo; Mama Afrika Market is not
   affiliated with these restaurants."
3. **Naming.** Product names are "Dish, Restaurant": "Beef Pilau, Kilimanjaro Jamia", "Whole Fried Tilapia, Mama
   Oliech". The restaurant name is spelled as the restaurant spells it. Never "Kilimanjaro Jamia x Mama Afrika".
4. **No logos, no branding.** No restaurant logo, signage, menu photography, colours or lettering in the
   illustration, the card or anywhere else. The illustration shows the plate, in our palette, on the product tint.
5. **No claims on their behalf.** No "partner", "official", "in collaboration with", "recommended by", no quotes
   attributed to the restaurant or its staff, no ratings presented as theirs. Describe the place plainly and in
   our voice ("on Kimathi Street", "Nairobi's Sunday ritual"); do not describe their kitchen, staff or sourcing.
6. **Prices match the public menu.** The price in `products.json` must equal the price on the public delivery
   menu at the time it was captured. Prices must be re-checked against the live menus before any real launch,
   and re-checked whenever the catalogue is edited. If a dish leaves the menu, the pick leaves the store.
7. **Delivery.** Picks are "Delivered hot within Nairobi". Express (same day) is the option to point at; copy may
   say "choose Express at checkout for same-day". Never promise a restaurant's own delivery time.
8. **Removal.** A listed restaurant can ask to be removed and the pick comes down the same day. Nothing in the
   copy should make that awkward.
9. **Demo notice.** The footer already says "Demo store, no real orders are shipped." Restaurant picks are the
   reason that sentence is not optional.

## 5. Places and spellings

Places are Kenyan now, and specific. Use the county or the neighbourhood, not "Kenya" alone, wherever the product
comes from somewhere in particular.

| Write | Not | Notes |
|---|---|---|
| Nairobi CBD | "the C.B.D.", "downtown Nairobi", "Nairobi city center" | "the CBD" is fine after the first mention. Kimathi Street is where Kilimanjaro Jamia is |
| Westlands | "Westy", "West Lands" | The pickup point: "Pick up in Westlands" |
| Kilimani | "Kili" | Mama Oliech |
| Kamakis | "Kamakis strip", "Ruiru bypass" | "Kamakis, Eastern Bypass" as an origin; "the Kamakis choma strip" in copy is fine |
| Mombasa Old Town | "Old Town, Mombasa", "Mombasa Raha" | Pilau, masala, mandazi, bhajia. Coast dishes are "coast" or "Swahili", not "coastal cuisine" |
| Kericho | "Kericho tea highlands" is copy, "Kericho" is the origin | Tea, chai masala |
| Mwea | "Mwea, Kirinyaga" as the origin; "Mwea paddies" in copy | Pishori rice. Mwea is a region in Kirinyaga county; it gets its own badge because the rice does |
| Nyeri | "Nyeri County" only on the About page | Coffee (Kenya AA), mukimo |
| Nakuru | | Maize flour, kachumbari chilli |
| Kiambu | "Kiambaa" | Sukuma wiki, greens |
| Lamu | "Lamu Island" | Kashata |
| Kisumu | "Kisumu City" | Lake fish culture; Mama Oliech's tilapia is "Lake Victoria tilapia" |

Region words: "Coast", "Central", "the Rift", "the Lake" are capitalised when they mean the region. "Upcountry" is
fine in running copy. No "the Kenyan bush", "the wild", "safari country".

## 6. Logo

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
- One lockup per view in the header and one in the footer. Do not tile the mark as a pattern; the motifs in section 10 do that job.
- Alt text and accessible name: "Mama Afrika Market" (links: "Mama Afrika Market, home").
- The mark never sits next to, inside or in a lockup with a restaurant's logo (section 4).

## 7. Colour

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
| Hibiscus | `--hibiscus-600` | **#8E1B3A** | **The v2 addition: the dusk end of the sky.** Sky, orbs, the Drinks aisle. With cream text only (8.47:1). |
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

Each product carries its own `color` in `server/data/products.json` (for example the Mombasa Pilau Kit #B5451B,
Kachumbari Chilli Sauce #C8412B, Mama Oliech's tilapia #8E1B3A, Mwea Pishori Rice #F2A93B, Kericho Black Tea
#3E6B3A). These warm food tints are an approved extension of the palette, but only as the ground of a product
image, its card media and its origin swatch, read through `safeColor()`. They are data: do not copy them into HTML
or CSS by hand, and do not use them for text, buttons or panes. Most tints are palette primitives already; a new
product should pick from the palette before inventing a hex.

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

## 8. Typography

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
| `.price` | `'SOFT' 30, 'opsz' 48` | Crisper and more numeric; weight 700. "KSh" and the number are set in the same run, no smaller symbol |

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

## 9. The "Golden-hour glass" surface system

The idea: the market at dusk, seen through amber glass. It must read as a Nairobi food market at golden hour, not as a
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
| `--glass-bg-tint` (`.glass--tint`) | saffron at 0.42 | 0.90 | One highlight pane per view: a promo, a free-delivery nudge | `--cocoa-950` only, short |
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

### Hero and banner guidance

The home hero is the one place the brand gets to be loud. It is a glass hero over the sky with the headline on the
left and four floating product tiles on the right, a kente stripe at its seam, and grain over the gradient.

**What the hero tiles show.** Four products, one from each of the four pillars of the pantry, so the hero says
"Kenya's kitchens" without a word: Mombasa (Mombasa Pilau Kit or Pilau Masala), Kericho (Kericho Black Tea), Mwea
(Mwea Pishori Rice) and Nairobi choma (Goat Nyama Choma, Kamakis, or the Nyama Choma Rub). Each tile's `--tint`
must equal that product's `color` in `products.json` and its image must be that product's `/img/<slug>.svg`; the
tiles are not a place for hand-picked hex values. Restaurant plates may appear as a tile only with the plate
drawn in our palette (section 4), never with anything that reads as the restaurant's own branding.

**Layout, from the banner reference, applied to our hero.**

- Three zones: eyebrow and headline at the top, the lead and proof line ("8 counties · one table") in the middle,
  the call to action at the bottom of the text column. The eye lands on the headline, then the tiles, then the button.
- Safe zones: keep the headline, lead and CTA inside the central 70 to 80% of the canvas and at least 50 to 100px
  from any edge at desktop widths; at 390px the tiles drop below the text and the CTA stays above the fold.
- **One call to action.** One saffron button per hero ("Shop the market"). A second link may exist as an outline
  button or a text link, but there is only ever one saffron surface in view, as the surface system already requires.
  The CTA is at least 44px tall and sits in the terminal position of the text column.
- Headline at least 32px on any banner and `--text-hero` on the site; body at least 16px; no more than seven words a
  line and three lines of headline. Two typefaces only (Fraunces, Karla), as everywhere.
- Contrast: measure the headline against the sky at the tile positions, not the cream bloom.
- Motifs: one kente stripe at the seam, grain on the hero only, at most two or three sheen panes.

**Off-site banners** (social covers, ads, email headers) follow the same rules with these sizes: website hero
1920 x 600 to 1080, section banner 1200 x 400, email header 600 x 200, Instagram post 1080 x 1080, Instagram story
1080 x 1920 (central 80% safe), Facebook cover 820 x 312, X header 1500 x 500, Google Display 300 x 250 and 728 x 90.
Text stays under 20% of an ad's area and 40% of a social cover. The art direction is our own: "Illustrated" product
tiles on the sunset sky through amber glass, never stock photography, never a restaurant's food photography, never a
Kenyan flag as decoration. Every banner carries the lockup on its cream medallion, one CTA, and prices as "KSh 1,250".

## 10. Pattern motifs

Motifs are texture, not wallpaper. They mark seams and fill art blocks; they never sit under body text and never fill a
whole pane that carries copy.

| Motif | Class | Made of | Where |
|---|---|---|---|
| Kente stripe | `.pattern-kente` | 66px repeat: clay-500 18, saffron-500 18, cocoa-900 6, leaf-600 18, cocoa-900 6 | Thin bands (6 to 12px) at seams: under heroes, on top of the footer, under the stats band. One per seam, at most two in view. Same stripe order everywhere. |
| Mudcloth (bogolan) | `.pattern-mudcloth` | cocoa-900 ground, 24px cream grid at 8%, saffron dots at 35% | Art blocks inside dark panes (the story quote, one category tile). Large Fraunces quotes only on top of it. The sky's dot grid is the same motif at a whisper. |
| Zigzag | `.pattern-zigzag` | 24px saffron-500 chevrons on clay-500 | Small, loud accents: stickers, corner tabs, empty-state art. Never behind text, never larger than about 160px. |
| Grain | `.grain::after` | fractal noise, 18% opacity, multiply | Hero sections only, to take the digital edge off the gradient. |

Use the motifs respectfully: these are living textile traditions (Asante and Ewe kente, Bamana bogolanfini), carried
over from the pan-African edition as the brand's own texture. Keep them abstracted as they are here, do not mix in
unrelated "tribal" clip art, kanga slogans or Maasai shuka checks as decoration, and do not recolour them outside the
palette.

## 11. Iconography and illustration

**Icons.** Inline SVG in the Lucide style from `icon()` in `public/js/components.js`: 24 x 24 viewBox, `fill: none`,
`stroke: currentColor`, stroke-width 2, round caps and joins. Sizes 16 (`.icon--sm`), 20 (default) and 28 (`.icon--lg`).
Icons take their colour from the text around them. Never emoji, never filled or two-tone icon sets, never an icon
without a text label or an `aria-label` on its control. Decorative icons carry `aria-hidden="true"`.

**Product illustration** (`public/img/<slug>.svg`, one per product, 600 x 600 viewBox, `role="img"` with a `<title>`
that is the product name). The recipe, as the Kenya-edition files draw it:

1. **Ground.** A full-bleed rectangle in the product's own `color` from `products.json`, so the card media, the
   origin swatch and the illustration always agree. Over it, a cream (`#FFF9EF`) pattern at about 14 to 15%: the
   chevron, or a ring-and-dot grid for kits. Nothing else in the background.
2. **The food.** Flat vector, no gradients, no drop shadows. Rounded rectangles, circles and simple paths in palette
   colours (cream, cocoa, clay, saffron, leaf, hibiscus). One hero object (the pot, the bag, the bottle, the plate) plus
   one hint of the dish or its ingredients (steam, a lime wedge, cardamom pods, a sprig of sukuma), usually tilted 20
   to 40 degrees. Thin cream strokes may separate food pieces from the ground; there are no black outlines.
3. **The label band.** A cream pill (`x=50 y=500 width=500 height=56 rx=28`, fill `#FFF9EF`, 3px `#2A1A11` stroke)
   across the bottom, with the product name in Karla 800, 22px, uppercase, letter-spacing 0.06em, `#2A1A11`, centred
   at `y=536`. Long names drop the subtitle ("KACHUMBARI CHILLI", not the full "Kachumbari Chilli Sauce"). The band
   is the only text outside the packaging; packaging labels may carry a second, smaller line such as "NAKURU · 350 ML".
4. **County and region badges.** Every product has a `flag` code that the site renders as a three-letter badge in a
   tinted square next to the origin, Karla 800, never a flag emoji or a national flag. The codes: **MSA** Mombasa,
   **NBI** Nairobi (including every restaurant pick), **KMB** Kiambu, **NYR** Nyeri, **NKR** Nakuru, **MWE** Mwea,
   **LMU** Lamu, **KRC** Kericho. Eight codes, eight counties and regions. The illustration itself does not repeat the
   badge; if one is drawn into packaging it uses the same three letters.
5. **Restaurant picks.** The plate, in our palette, on the product tint: rice, meat, a block of ugali, a heap of
   kachumbari. No logo, no signage, no wrapper, no lettering that imitates the restaurant (section 4).
6. On the site the illustration sits in a tinted media block at the top of a glass card; the glass never covers it.
   The old pan-African files (jollof, bissap, shito, suya and friends) are retired and must not be reused as
   placeholders.

**People.** No stock photography. People appear as initials in a Fraunces 800 disc (`--av` colour from the palette,
cream text, so the disc must be clay-500 or darker, leaf-600, or hibiscus-600; on saffron discs use cocoa-950 text).
Testimonial names and places are Kenyan (Nairobi neighbourhoods, Mombasa, Kisumu, Nakuru), never invented foreign
cities.

## 12. Motion

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

## 13. Accessibility commitments

- WCAG 2.1 AA: 4.5:1 for text, 3:1 for large text, control boundaries and focus indicators, measured against the worst sky behind the pane (section 7), not the prettiest.
- The three glass fallbacks (no blur support, reduced transparency, more contrast) are part of the design and are checked on every surface change.
- `:focus-visible` always shows: 3px `--color-ring` outline, 3px offset, cocoa on light panes and saffron-300 on smoked ones. Never `outline: none` without a replacement of equal weight.
- Touch targets are at least 44 x 44px (`.btn` 48px, `.btn--icon` and `.qty__btn` 44px, `.chip` 40px with spacing).
- Reduced motion is honoured in CSS and JS.
- Every page has a skip link, one h1, `lang="en"`, a unique title and meta description; decorative art is `aria-hidden`; product images in cards are decorative because the product name is the link.
- Colour is never the only signal: errors add text and an icon, sale prices add a strikethrough, the free-delivery bar has a sentence.
- Visible labels and accessible names use the same word (a button that says "Basket" is not named "Open cart").
- Copy is plain English at a comfortable reading level. Swahili touches are never required to understand an action.

## 14. Consistency checklist for future changes

Visual
- [ ] Every colour is a token. No new hex values in HTML, CSS or JS (product tints arrive through `product.color` and `safeColor()`).
- [ ] New surface uses a pane token, the filter token with its `-webkit-` twin, `--glass-border` or `--glass-border-dark`, and a glass shadow token.
- [ ] Text sits on `--glass-bg` or denser; forms, long text and errors on `--glass-bg-strong`; no muted text on soft glass; smoked panes use cream text.
- [ ] Checked over the light centre and the hibiscus corner of the sky, at 390px and 1360px, with no horizontal overflow.
- [ ] Checked with blur unsupported, with reduced transparency and with more contrast.
- [ ] No blur above 20px, no animated `backdrop-filter`, no more than two blurred layers, fixed children not trapped inside a blurred ancestor.
- [ ] Headings are Fraunces with the documented axes, one italic accent word; everything else is Karla; no new fonts.
- [ ] Icons are stroke-2 inline SVG; no emoji; motifs only at seams and in art blocks.
- [ ] The logo sits on its cream medallion, unmodified, with clear space, never beside a restaurant logo.
- [ ] Product illustrations: 600 x 600, ground in `product.color`, cream label band with the product name, a `<title>`; hero tiles use real products and their real tints.
- [ ] One saffron call to action per view, including the hero.

Voice
- [ ] The name is "Mama Afrika Market" (or "Mama Afrika" in running copy). Title is `Page | Mama Afrika Market`, sentence case.
- [ ] Says basket, aisle, county, co-op, recipe card, delivery, pickup. Names a Kenyan place or a dish where it can.
- [ ] No "state" in visible copy: the field is "County", the badge is a county or region code.
- [ ] Numbers match: free delivery from KSh 3,000, next day KSh 250, same day KSh 450, Westlands pickup free, VAT 16%, 20 products, 8 counties and regions, 5 restaurant picks, KARIBU10 / PILAU20 / FREESHIP.
- [ ] Every amount is "KSh 1,250" through `money()`: no "$", "£", "Ksh", "KES" or ".00" in visible copy.
- [ ] The tax line says "VAT (16%)", never "Tax".
- [ ] Payment options read Mobile Money (M-Pesa first, default checked), then Card, then Cash on delivery; hints name M-Pesa and Airtel Money.
- [ ] Delivery copy says next day or same day within Nairobi; no "ships in 48 hours", "business days", "warehouse" or non-Nairobi promises.
- [ ] No pan-African leftovers: no jollof, berbere, shito, suya, bissap, rooibos, Lagos, Accra, Addis, Peckham, London, Brooklyn, "9 countries", "the continent".
- [ ] At most one Karibu, Asante or Sawa on the screen, none in errors. No Sheng beyond that, no mock accents, no "hakuna matata".
- [ ] No em dashes, no exclamation pile-ups, no "exotic / ethnic / tribal / safari / curated / elevated".
- [ ] Restaurant picks: named "Dish, Restaurant", price matches the public delivery menu, the non-affiliation sentence is present verbatim on the About page and in product perks, no logos, no partnership language.
- [ ] Errors say what happened and what to do next.

Meta and tokens
- [ ] Unique meta description of 50 to 160 characters in brand voice, in Kenyan terms; `theme-color` is #2A1A11 (the smoked header) on every page.
- [ ] Favicon is `/img/favicon.svg`.
- [ ] If a token changed in `base.css`, this file and `docs/design-tokens.json` changed in the same commit. The JSON is a verbatim export of the `:root` blocks (including the `@supports` and reduced-transparency overrides); regenerate it by parsing `base.css`, never by hand, and do not run generic brand-sync scripts that invent colour scales.
- [ ] If a number changed in `pricing.js`, `format.js` or `products.json`, section 3 of this file changed in the same commit.
- [ ] Before any real launch: restaurant pick prices re-checked against the live Glovo / Uber Eats menus, and the demo notice reviewed.
