# Mama Afrika Market — Build Spec (shared contract for all workers)

Online store selling authentic African food: spices, sauces, staples, snacks, drinks, meal kits.
Stack: Node 22 + Express 5 (ESM, `"type": "module"`) serving a static multi-page vanilla HTML/CSS/JS frontend from `public/`.
No build step. No frameworks. Fonts from Google Fonts (Fraunces display + Karla body). Icons: inline SVG (Lucide-style strokes), never emoji.

## Folder layout / ownership
```
server/index.js            Express app entry (exports `app`, listens only when run directly)  [backend]
server/routes/*.js         products, orders, promo, newsletter routers                        [backend]
server/data/products.json  catalog (READ ONLY — do not edit)                                  [shared]
server/data/orders.json    created at runtime by the server (gitignored)                      [backend]
public/css/base.css        tokens, reset, typography, buttons, forms, cards (READ ONLY)        [shared]
public/css/site.css        header, footer, cart drawer, home, shop, product, about styles      [frontend-core]
public/css/checkout.css    cart page, checkout, confirmation styles                            [checkout]
public/js/format.js        money(), cents(), categoryLabel(), escapeHtml() (READ ONLY)          [shared]
public/js/pricing.js       computeTotals(), SHIPPING_METHODS, PROMO_CODES (READ ONLY)          [shared]
public/js/cart.js          cart store singleton `cart` (READ ONLY)                             [shared]
public/js/api.js           fetch client `api` (READ ONLY)                                      [shared]
public/js/layout.js        injects header + footer + cart drawer + toast into every page        [frontend-core]
public/js/pages/home.js, shop.js, product.js, about.js                                          [frontend-core]
public/js/pages/cart.js, checkout.js, confirmation.js, validation.js                            [checkout]
public/index.html, shop.html, product.html, about.html                                          [frontend-core]
public/cart.html, checkout.html, order-confirmation.html                                        [checkout]
public/img/*.svg           product illustrations (one per product `image` path) + logo.svg + favicon.svg [art]
tests/unit/*.test.js       vitest, pure logic                                                   [main]
tests/api/*.test.js        vitest + supertest against `app`                                    [backend]
tests/e2e/*.spec.js        playwright                                                          [main]
```

## Page skeleton (every HTML page)
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>… | Mama Afrika Market</title>
  <meta name="description" content="…">
  <link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/site.css">
  <!-- checkout pages also: <link rel="stylesheet" href="/css/checkout.css"> -->
</head>
<body data-page="home">
  <a class="skip-link" href="#main">Skip to content</a>
  <div id="site-header"></div>
  <main id="main"> …page content… </main>
  <div id="site-footer"></div>
  <script type="module" src="/js/layout.js"></script>
  <script type="module" src="/js/pages/home.js"></script>
</body>
</html>
```
`layout.js` MUST: render header into `#site-header` (logo linking `/`, nav: Shop `/shop.html`, Meal Kits `/shop.html?category=meal-kits`, About `/about.html`; search input that navigates to `/shop.html?q=…`; cart button with `[data-cart-count]` badge that opens the cart drawer), render footer into `#site-footer` (newsletter form posting to `api.subscribe`, link columns, "Made with love across the continent" line), render a slide-in cart drawer (`#cart-drawer`, `role="dialog"`, `aria-modal`, ESC closes, focus trap, backdrop click closes) listing `cart.items()` with qty steppers, remove, subtotal, "View cart" (`/cart.html`) and "Checkout" (`/checkout.html`) buttons, and expose `window.MAM = { toast(message, {type}), openCart(), closeCart() }`. Also style `.skip-link` (visually hidden until focused). Mobile: hamburger toggles nav (`aria-expanded`). Header sticky.

## Shared JS contracts
- `import { cart } from '/js/cart.js'` — see cart.js header comment. Subscribe with `cart.subscribe(fn)` or listen to `window` `cart:change`.
- `import { api } from '/js/api.js'` — `api.products({category, q, sort, tag})`, `api.product(slug)`, `api.categories()`, `api.validatePromo(code)`, `api.quote({items, shippingMethod, promoCode})`, `api.createOrder(payload)`, `api.order(id)`, `api.subscribe(email)`.
- `import { money, categoryLabel, escapeHtml } from '/js/format.js'`.
- `import { computeTotals, SHIPPING_METHODS, FREE_SHIPPING_THRESHOLD } from '/js/pricing.js'`.
- Always escape product strings with `escapeHtml` when using innerHTML.

## Product object
See `server/data/products.json`. Fields: id, slug, name, category (meal-kits|spices|sauces|staples|snacks|drinks), origin, flag (ISO-2), price, compareAt (nullable), unit, weight, rating, reviews, stock, featured, tags[], short, description, ingredients, image, color (hex used as card background tint).

## API (JSON) — backend implements exactly this
- `GET /api/health` → `{ ok: true, uptime }`
- `GET /api/products?category=&q=&sort=(featured|price-asc|price-desc|rating|name)&tag=&featured=true` → `{ products: Product[], total }`
- `GET /api/products/:slug` → `{ product, related: Product[] (same category, max 4, excluding itself) }` ; 404 `{ error: 'Product not found' }`
- `GET /api/categories` → `{ categories: [{ slug, label, count }] }` (labels from `public/js/format.js` CATEGORY_LABELS — server imports it)
- `POST /api/promo/validate` body `{ code }` → 200 `{ valid: true, promo: {code, type, value, label} }` or 404 `{ valid: false, error: 'Promo code not recognised' }`
- `POST /api/orders/quote` body `{ items: [{id, qty}], shippingMethod, promoCode }` → `{ items: [{id, slug, name, price, qty, lineTotal}], totals }` where totals = `computeTotals` output from `public/js/pricing.js` (server imports the same module). 400 on unknown product id / bad qty.
- `POST /api/orders` body:
  ```json
  { "items": [{"id":"p01","qty":2}], "shippingMethod": "standard", "promoCode": "KARIBU10",
    "customer": { "firstName","lastName","email","phone" },
    "address": { "line1","line2","city","state","postalCode","country" },
    "payment": { "method": "card" | "mobile-money" | "cash-on-delivery", "cardNumber","cardName","expiry","cvc" (card only; store ONLY last4), "provider","mobileNumber" (mobile-money only) },
    "notes": "" }
  ```
  Validation (400 `{ error: 'Validation failed', fields: { fieldPath: message } }`): items non-empty, each id exists & 1≤qty≤stock; customer names ≥2 chars; email RFC-ish; phone ≥7 digits; address line1/city/postalCode/country required; payment.method in list; card: number passes Luhn & 13–19 digits, expiry `MM/YY` in the future, cvc 3–4 digits; mobile-money: provider & mobileNumber required.
  Success 201 `{ order: { id: "MAM-XXXXXX" (6 uppercase alnum), status: "confirmed", createdAt, items, totals, customer, address: {…}, payment: { method, last4?, provider? }, estimatedDelivery (ISO date, +5 days standard, +2 express, +0 pickup), notes } }`. Persist to `server/data/orders.json` (array; create if missing; atomic write). Decrement in-memory stock.
- `GET /api/orders/:id` → `{ order }` or 404.
- `POST /api/newsletter` body `{ email }` → 200 `{ ok: true, message }` or 400.
- Unknown `/api/*` → 404 JSON `{ error: 'Not found' }`. Errors → JSON, never HTML. `express.json()` limit 100kb. Add `Cache-Control: no-store` on `/api/*`.
- Static: `express.static('public', { extensions: ['html'] })` so `/shop` and `/shop.html` both work. Non-API unknown routes → `public/404.html` (backend creates a minimal one using the skeleton above).
- `server/index.js`: `export const app`; `if (import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(PORT || 3000)`. Log a friendly banner with the URL.

## Pricing (shared, pricing.js)
Free standard shipping ≥ $60 after discount. Tax 8%. Promo codes KARIBU10 (10%), JOLLOF20 (20%), FREESHIP (free standard shipping). Shipping: standard $6.95, express $14.95, pickup $0.

## Pages
- **Home** `/`: bold hero (display headline like "Taste the whole continent, delivered." with italic accent word, two CTAs, floating product art, kente stripe), category tiles (6), featured products grid (`api.products({featured:true})`), "How it works / Why us" 3-up (sourced from smallholders, ships in 48h, recipes included), testimonials, recipe/story band, newsletter (footer). Staggered reveal on load; IntersectionObserver `.reveal` on scroll.
- **Shop** `/shop.html`: sticky filter bar (category chips, search box, sort select, result count), product grid with cards (image tinted with `product.color`, origin flag badge, tags → badges `bestseller/new/sale`, rating stars via SVG, price + compareAt, "Add to cart" button that toggles to "Added ✓" briefly and opens the drawer via `MAM.openCart()` is NOT required; just toast + badge bump). Reads `?category=&q=&sort=&tag=` from URL and keeps URL in sync (`history.replaceState`). Empty state with "Clear filters". Skeleton cards while loading.
- **Product** `/product.html?slug=…`: two-column (art left, sticky buy box right): breadcrumb, origin, rating, price, unit/weight, short, qty stepper, Add to cart (opens drawer), "Ships in 48h" / "Free shipping over $60" reassurance, tabs (Description / Ingredients / Shipping & returns) using `role="tablist"`, related products. 404 state if slug not found.
- **About** `/about.html`: brand story, values, "from 9 countries" stat band, team/sourcing cards. Editorial layout.
- **Cart** `/cart.html`: line items table (image, name, unit, qty stepper, line total, remove), promo code input (validate via API, show applied label / error), shipping method radio group, order summary (subtotal/discount/shipping/tax/total using `cart.totals()`), free-shipping progress bar, "Proceed to checkout", "Continue shopping". Empty state with CTA.
- **Checkout** `/checkout.html`: 3-step visual stepper (Contact → Shipping → Payment) as a single page with sections; forms with visible labels, inline validation (validation.js mirrors server rules incl. Luhn), payment method radio cards (Card / Mobile Money / Cash on delivery) that show the relevant fields; sticky order summary (reuses cart totals; re-quoted via `api.quote` before submit); on submit: loading state → `api.createOrder` → `cart.clear()` → `sessionStorage.setItem('mam.lastOrder', JSON.stringify(order))` → redirect `/order-confirmation.html?id=ORDERID`. Server field errors map to fields. Redirect to `/cart.html` if cart empty. Demo card hint: 4242 4242 4242 4242.
- **Confirmation** `/order-confirmation.html?id=…`: fetch `api.order(id)` (fallback to sessionStorage), celebratory header, order id, estimated delivery, items, totals, shipping address, "Continue shopping". Handle not-found.

## Quality bar
- Mobile-first, responsive at 375 / 768 / 1024 / 1440. No horizontal scroll.
- All interactive targets ≥ 44px. Visible focus. `aria-live="polite"` for toasts and cart count. Semantic landmarks.
- Contrast ≥ 4.5:1 for body text. Respect `prefers-reduced-motion` (base.css handles it).
- Use `data-testid` attributes on key controls for E2E tests: `product-card`, `add-to-cart`, `cart-count`, `cart-drawer`, `cart-line`, `qty-increment`, `qty-decrement`, `remove-line`, `checkout-button`, `promo-input`, `promo-apply`, `order-total`, `place-order`, `order-id`, `search-input`, `category-chip`, `sort-select`.
- No console errors. Every page loads standalone (direct URL).
