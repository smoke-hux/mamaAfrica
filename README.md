# Mama Afrika Market

An online store for authentic African food: spices, sauces, staples, snacks, drinks and meal kits from nine countries.
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

1. **Home** `/` — hero, category tiles, featured products.
2. **Shop** `/shop.html` — filter by *Meal Kits*, search "suya", sort by price. Add a couple of items; the cart badge bumps and the drawer slides in.
3. **Product** `/product.html?slug=shito-sauce` — tabs, quantity stepper, related products.
4. **Cart** `/cart.html` — change quantities, apply promo `KARIBU10` (10%), `JOLLOF20` (20%) or `FREESHIP`; watch the free-shipping bar (free over $60).
5. **Checkout** `/checkout.html` — pay by card (demo card `4242 4242 4242 4242`, any future expiry, any CVC), Mobile Money, or cash on delivery. Try an invalid card to show inline validation.
6. **Confirmation** — order id `MAM-XXXXXX`, estimated delivery, receipt. Orders persist in `server/data/orders.json` and are retrievable at `/api/orders/:id`.

## Architecture

```
server/            Express app (index.js exports `app`; routes/ for products, orders, promo, newsletter)
server/data/       products.json (catalog) · orders.json (created at runtime)
public/            static storefront
  css/base.css     design tokens + primitives (Fraunces + Karla, clay/saffron/cocoa/cream palette)
  css/site.css     header, footer, cart drawer, home/shop/product/about
  css/checkout.css cart, checkout, confirmation
  js/pricing.js    computeTotals() — imported by BOTH browser and server (single source of truth)
  js/cart.js       localStorage-backed cart store with subscriptions
  js/api.js        fetch client
  js/layout.js     injects header/footer/cart drawer/toasts into every page
  js/pages/*.js    one module per page
  img/*.svg        hand-drawn product illustrations, logo, favicon
tests/unit · tests/api · tests/e2e
```

Pricing rules live in one shared module so the browser preview and the server-computed order total can never disagree.
Card numbers are never stored; only the last four digits are kept on the order.

## Live deployment (Vercel)

Production URL: **https://mama-afrika-market.vercel.app**

- `api/index.js` wraps the Express app as a Vercel serverless function; `vercel.json` routes `/api/*` to it. Everything in `public/` is served from Vercel's CDN.
- Orders on Vercel are written to `/tmp`, which is per-instance and ephemeral. That's fine for the demo, but a real launch would swap `server/lib/orders-store.js` for a database (for example Neon Postgres or Upstash Redis from the Vercel Marketplace).
- Redeploy with `npx vercel deploy --prod` from the project folder (log in first with `npx vercel login`).
- Run the browser tests against the live site: `E2E_BASE_URL=https://mama-afrika-market.vercel.app npm run test:e2e`
