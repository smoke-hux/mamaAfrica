# Test Report — Mama Afrika Market

Run date: 2026-09-12 · Node v22.14.0 · Chrome 153 (Playwright 1.63)

| Suite | Command | Files | Tests | Result |
|-------|---------|-------|-------|--------|
| Unit (cart store, pricing, formatting, checkout validation) | `npm run test:unit` | 4 | 46 | ✅ all pass |
| API (products, categories, promo, quotes, orders, newsletter, persistence) | `npm run test:api` | 3 | 68 | ✅ all pass |
| End-to-end, desktop Chrome + mobile Chrome (Pixel 7) | `npm run test:e2e` | 3 | 34 | ✅ all pass |
| **Total** | `npm test` | 10 | **148** | ✅ |

## What the end-to-end suite proves
- Full journey: home → shop → add two products → cart (increase qty, apply `KARIBU10`) → checkout with card → confirmation page shows order id and total; order is retrievable from the API with only the last four card digits stored.
- Checkout validation blocks a bad email, a card that fails the Luhn check, and an expired card, with inline field errors.
- Mobile Money checkout path completes an order.
- Empty cart redirects checkout back to the cart page.
- Category filter, search, and price sort update the grid and the URL; empty search shows an empty state.
- Product page renders details, accessible tabs, and related products; unknown slug shows a not-found state.
- Cart persists across reloads; drawer quantity controls and removal work.
- Every page loads with no JavaScript errors and no horizontal overflow on desktop and phone widths.
- Skip link is the first tab stop; cart drawer is a keyboard-accessible dialog closed by Escape.
- Unknown API routes return JSON 404; unknown pages return the styled 404 page.

## Viewing results
- `npm run test:e2e:report` opens the Playwright HTML report (traces and screenshots are kept for any failure).
- Vitest prints per-test results in the terminal.
