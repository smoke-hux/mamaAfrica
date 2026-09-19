# Mama Afrika Market

An online store for authentic Kenyan food, delivered in Nairobi: meal kits, restaurant picks, spices, staples, snacks, tea and coffee sourced from co-ops in eight counties.
Built as a zero-build, framework-free web app: **Node 22 + Express 5** API serving a **vanilla HTML/CSS/JS** storefront.

## Run it

```bash
npm install
npm start          # → http://localhost:3000
```

`npm run dev` restarts the server automatically on file changes.

## Test it

```bash
npm run test:unit   # pure logic: cart store, pricing rules, formatting, checkout validation
npm run test:api    # Express API with supertest: products, promo, quotes, orders, validation, persistence
npm run test:e2e    # Playwright: full shopping journey in desktop + mobile Chrome
npm test            # all three
npm run test:e2e:report   # open the HTML report from the last e2e run
```

E2E tests boot their own server on port 3777 and write orders to `test-results/orders.e2e.json`, so they never touch real data.

## Demo script (presentation)

1. **Home** `/` — hero, six aisle tiles (including *Restaurant Picks*), featured products.
2. **Shop** `/shop.html` — filter by *Meal Kits* or *Restaurant Picks*, search "pilau", sort by price. Add a couple of items; the cart badge bumps and the drawer slides in.
3. **Product** `/product.html?slug=pilau-kit` — tabs, quantity stepper, related products. Open `/product.html?slug=mama-oliech-fried-tilapia` to show a restaurant pick with its non-affiliation note.
4. **Cart** `/cart.html` — change quantities, apply promo `KARIBU10` (10%), `PILAU20` (20%) or `FREESHIP`; watch the free-delivery bar (free standard delivery over KSh 3,000; standard KSh 250 next day, express KSh 450 same day, pickup in Westlands free). VAT is 16%.
5. **Checkout** `/checkout.html` — pay by Mobile Money (M-Pesa or Airtel Money, default), card (demo card `4242 4242 4242 4242`, any future expiry, any CVC), or cash on delivery. Country defaults to Kenya. Try an invalid card to show inline validation.
6. **Confirmation** — order id `MAM-XXXXXX`, estimated delivery (next day for standard, same day for express and pickup), receipt. Orders persist in `server/data/orders.json` and are retrievable at `/api/orders/:id`.

## Architecture

```
server/            Express app (index.js exports `app`; routes/ for products, orders, promo, newsletter, tracking)
server/lib/        catalog, orders-store, validation, security (CSP + rate limits),
                   geocode.js (Nairobi areas -> coordinates) and tracking.js (pure rider simulation)
server/data/       products.json (catalog) · orders.json (created at runtime)
public/            static storefront
  css/base.css     design tokens + glass primitives ("Golden-hour glass": Fraunces + Karla, clay/saffron/cocoa/cream over a sunset sky)
  css/site.css     site chrome: header, footer, cart drawer, toasts, product cards
  css/pages.css    page sections: home, shop, product, about
  css/checkout.css cart, checkout, confirmation
  js/pricing.js    computeTotals() — imported by BOTH browser and server (single source of truth)
  js/cart.js       localStorage-backed cart store with subscriptions
  js/cart-sync.js  refreshes saved cart lines (price, stock) from the live catalog on cart + checkout
  js/track-client.js  live tracking feed: SSE with a polling fallback
  js/maps-loader.js   loads the Google Maps JS API when a key is configured
  js/tracking-map.js  the map component (Google backend, or a self-drawn simplified map)
  js/api.js        fetch client
  js/layout.js     injects header/footer/cart drawer/toasts into every page
  js/pages/*.js    one module per page
  img/*.svg        hand-drawn product illustrations, logo, favicon
docs/              brand-guidelines.md (brand + glass surface rules) · design-tokens.json (export of base.css tokens)
tests/unit · tests/api · tests/e2e
```

Pricing rules live in one shared module so the browser preview and the server-computed order total can never disagree.
Card numbers are never stored; only the last four digits are kept on the order.

## Live order tracking

Every order gets an Uber-style tracking view: the customer watches the rider approach on a map, and
the shop watches every active order on one board.

- **Customer:** `/order-confirmation.html?id=MAM-XXXXXX` shows the stage, ETA, remaining distance, the
  rider, a timeline, and a live map.
- **Ops:** `/dispatch.html` lists every active order on one map. It is staff-only, `noindex`, not linked
  from the site, and gated by `DISPATCH_TOKEN` (locally `dev-dispatch-token`).
- **API:** `GET /api/orders/:id/tracking`, `GET /api/orders/:id/tracking/stream` (Server-Sent Events),
  `GET /api/dispatch/orders` (bearer token), `GET /api/config`.

### How the rider moves

`trackOrder(order, now)` in `server/lib/tracking.js` is a **pure function**: the rider's position is
derived from how long ago the order was placed, along a route built from the delivery address. There
is no courier state anywhere. That is deliberate. Vercel runs many instances and `/tmp` is per
instance, so a stored moving courier would disagree with itself between requests; a pure function
gives every instance and every viewer the same answer for the same instant. Addresses resolve
through a table of ~70 Nairobi areas in `server/lib/geocode.js`, so tracking needs no network call.

Swapping in real riders means replacing position and stage with GPS pings and keeping the same
response shape. The browser never learns where the numbers came from.

The stream is closed by the server after about 45 seconds because a serverless function cannot hold a
socket open indefinitely; `EventSource` reconnects on its own, and `public/js/track-client.js` falls
back to polling if SSE never gets through.

### Turning on Google Maps

The map works without any key by drawing a simplified map itself. For the real thing:

```bash
vercel env add GOOGLE_MAPS_BROWSER_KEY production   # restrict it to your domains + Maps JavaScript API
vercel env add GOOGLE_MAPS_MAP_ID production        # optional, enables Advanced Markers
vercel env add DISPATCH_TOKEN production            # required for the dispatch board
vercel deploy --prod
```

See `.env.example`. The browser key is served to the page by `GET /api/config`, so it must be a
referrer-restricted browser key. The Content Security Policy in `server/lib/security.js` (mirrored in
`vercel.json`) already allows `maps.googleapis.com` and nothing else new.

## Security

- Every response carries a strict Content Security Policy (scripts only from this origin, no framing, no plugins),
  `nosniff`, a referrer policy and a permissions policy; HSTS over TLS. `server/lib/security.js` sets them in Express and
  `vercel.json` repeats them for files served by the CDN. Keep the two lists in sync.
- Per-IP rate limits: 20 order creations, 30 order lookups and 60 other writes per minute. They are per server instance
  (a slow-down, not a wall); for a real launch add a Vercel WAF rate-limit rule as well. `RATE_LIMIT=off` disables them for tests.
  The client address comes from `x-real-ip` only on Vercel (or with `TRUST_PROXY=1` behind a proxy that sets it);
  otherwise the socket address is used, so a caller cannot pick a fresh bucket by sending the header.
- Request bodies are capped at 100 KB, JSON only; every stored field has a maximum length; mobile-money providers are an
  allow-list; orders are capped at 20 per line and 60 units in total (`MAX_LINE_QTY` / `MAX_ORDER_UNITS` in `pricing.js`,
  shared by the cart UI and the server) so one order cannot drain the catalog. Everything is rendered with escaping.
- Still a demo: `GET /api/orders/:id` and `GET /api/orders/:id/tracking` return the order, and the
  delivery area's coordinates, to anyone who has the order number, and card details travel to the
  server (only the last four digits are kept). A real launch needs an order-access token or login, and client-side card
  tokenisation so the card number never reaches this server.

## Live deployment (Vercel)

Production URL: **https://mama-afrika-market.vercel.app**

- `api/index.js` wraps the Express app as a Vercel serverless function; `vercel.json` routes `/api/*` to it. Everything in `public/` is served from Vercel's CDN.
- Orders on Vercel are written to `/tmp`, which is per-instance and ephemeral. That's fine for the demo, but a real launch would swap `server/lib/orders-store.js` for a database (for example Neon Postgres or Upstash Redis from the Vercel Marketplace).
- Redeploy with `npx vercel deploy --prod` from the project folder (log in first with `npx vercel login`).
- Run the browser tests against the live site: `E2E_BASE_URL=https://mama-afrika-market.vercel.app npm run test:e2e`
