# Test Report — Mama Afrika Market

Run date: 2026-09-18 · Node v22.14.0 · Chrome 153 (Playwright 1.63) · Kenyan catalogue (20 products, prices in KSh)

| Suite | Command | Files | Tests | Result |
|-------|---------|-------|-------|--------|
| Unit (cart store, pricing, formatting, checkout validation) | `npm run test:unit` | 4 | 55 | ✅ all pass |
| API (products, categories, promo, quotes, orders, newsletter, persistence, security headers, rate limits) | `npm run test:api` | 4 | 80 | ✅ all pass |
| End-to-end, desktop Chrome + mobile Chrome (Pixel 7) | `npm run test:e2e` | 3 | 48 | ✅ all pass |
| **Total** | `npm test` | 11 | **183** | ✅ |

## What the unit and API suites prove
- Pricing: KSh 3,000 free-delivery threshold, 16% VAT, delivery KSh 250 (standard, next day) / KSh 450 (express, same day) / free pickup in Westlands; `KARIBU10`, `PILAU20` and `FREESHIP` behave as advertised (FREESHIP only on standard; a percent discount can drop a basket back under the threshold).
- VAT is charged per line: zero-rated staples (`sifted-maize-flour`, `mwea-pishori-rice`, `chapati-flour`) carry `vatExempt: true` and no VAT, and a percent discount scales the vatable share (Pilau Kit x2 + Pishori Rice x1: subtotal 1,990, VAT 272, total 2,512; with `KARIBU10`: VAT 244.80, total 2,285.80).
- Catalogue API: 20 products in six categories (Meal Kits 3, Restaurant Picks 5, Spices & Sauces 3, Staples & Flours 3, Snacks & Bites 3, Tea, Coffee & Drinks 3); search covers name, description, origin and tags (`pilau`, `kericho`, `grill`); product detail returns up to four related items from the same category.
- Orders: quotes and stored totals come from the shared `computeTotals`; standard delivery is next day, express and pickup same day; stock is reserved atomically (no oversell under concurrent orders, nothing touched when validation fails); only the last four card digits or the mobile money provider (`mpesa`) are stored.

## What the end-to-end suite proves
- Full journey: home → shop (20 products) → add two products → cart (increase qty, apply `KARIBU10`, total shown as "KSh 1,234" / "KSh 1,234.50") → checkout as a Nairobi customer (country Kenya), choosing Card over the default M-Pesa option → confirmation page shows order id and total; order is retrievable from the API with only the last four card digits stored.
- Mobile Money checkout path (M-Pesa selected from the provider list) completes an order and the API stores only `{ method: 'mobile-money', provider: 'mpesa' }`.
- Shipping radios keep keyboard focus across re-renders; Standard reads "Free" for a qualifying basket (Pilau Kit x4 = KSh 3,400) even while Express is selected; adding beyond the per-line cap (20) does not claim success; closing the drawer opened from a toast returns focus to the basket button.
- Checkout validation blocks a bad email, a card that fails the Luhn check, and an expired card, with inline field errors (the Card option must be chosen explicitly now that M-Pesa is the default).
- Empty cart redirects checkout back to the cart page.
- Category chip (Meal Kits → 3 products), search (`tilapia` → 1, `pilau` → 4) and price sort update the grid and the URL; empty search shows an empty state.
- Product page (Nyama Choma Rub, KSh 320) renders details, accessible tabs (ingredients list) and related products; unknown slug shows a not-found state.
- Cart persists across reloads; drawer quantity controls and removal work.
- A stale saved cart (old price, 99 units of the Mukimo Kit, a delisted product) is corrected from the live catalogue on the cart page (qty clamped to the per-line cap of 20, price back to KSh 520), and checkout names the product that ran short instead of showing "Validation failed".
- If that refresh empties the cart during checkout, the shopper is sent to the cart page and still told why (the notice is carried across the redirect).
- Every page (home, shop, Pilau Kit product page, about, cart, confirmation) loads with no JavaScript errors and no horizontal overflow on desktop and phone widths.
- Skip link is the first tab stop; cart drawer is a keyboard-accessible dialog closed by Escape.
- Unknown API routes return JSON 404; unknown pages return the styled 404 page.

## Viewing results
- `npm run test:e2e:report` opens the Playwright HTML report (traces and screenshots are kept for any failure).
- Vitest prints per-test results in the terminal.
