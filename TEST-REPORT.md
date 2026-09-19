# Test Report — Mama Afrika Market

Run date: 2026-09-19 · Node v22.14.0 · Chrome 153 (Playwright 1.63) · Kenyan catalogue (20 products, prices in KSh)

| Suite | Command | Files | Tests | Result |
|-------|---------|-------|-------|--------|
| Unit (cart store, pricing, formatting, checkout validation, live tracking + geocoding) | `npm run test:unit` | 5 | 101 | ✅ all pass |
| API (products, categories, promo, quotes, orders, newsletter, persistence, security headers, rate limits, tracking/dispatch/config/SSE) | `npm run test:api` | 5 | 99 | ✅ all pass |
| End-to-end, desktop Chrome + mobile Chrome (Pixel 7) | `npm run test:e2e` | 4 | 62 | ✅ all pass |
| **Total** | `npm test` | 14 | **262** | ✅ |

### Defects these tests found, now fixed

The tracking suites were written against the implementation and caught five real defects before the
feature shipped, all fixed in the same change:

- `geocodeAddress(null)` threw: a default parameter does not cover an explicit `null`.
- `trackOrder(null)` threw in the schedule helpers, though the rest of the function already guarded.
- The SSE handler leaked two intervals and a timeout **per request** for any order that was not live,
  because the first `send()` stopped the stream before the timers it needed to clear existed. Proven
  fixed out of band: five delivered-order streams now leave zero `Timeout` handles behind.
- `track-client.js` never fell back to polling when a stream was refused or blocked, because
  `EventSource` stays in `CONNECTING` and retries silently; the panel froze on its last frame.
  A watchdog now drops to polling if the stream produces nothing at all.
- A bearing of 359.96 rounded to exactly `360`, outside the documented `[0,360)`.

## What the unit and API suites prove
- Pricing: KSh 3,000 free-delivery threshold, 16% VAT, delivery KSh 250 (standard, next day) / KSh 450 (express, same day) / free pickup in Westlands; `KARIBU10`, `PILAU20` and `FREESHIP` behave as advertised (FREESHIP only on standard; a percent discount can drop a basket back under the threshold).
- VAT is charged per line: zero-rated staples (`sifted-maize-flour`, `mwea-pishori-rice`, `chapati-flour`) carry `vatExempt: true` and no VAT, and a percent discount scales the vatable share (Pilau Kit x2 + Pishori Rice x1: subtotal 1,990, VAT 272, total 2,512; with `KARIBU10`: VAT 244.80, total 2,285.80).
- Catalogue API: 20 products in six categories (Meal Kits 3, Restaurant Picks 5, Spices & Sauces 3, Staples & Flours 3, Snacks & Bites 3, Tea, Coffee & Drinks 3); search covers name, description, origin and tags (`pilau`, `kericho`, `grill`); product detail returns up to four related items from the same category.
- Orders: quotes and stored totals come from the shared `computeTotals`; standard delivery is next day, express and pickup same day; stock is reserved atomically (no oversell under concurrent orders, nothing touched when validation fails); only the last four card digits or the mobile money provider (`mpesa`) are stored.

## What the live tracking tests prove
- **Determinism, the property the serverless design rests on**: the same order at the same instant serialises byte-for-byte identically, whether the instant arrives as a `Date`, an ISO string or epoch millis, and whether the order is the same object or a fresh one with the same values. Two separate instances of the same address geocode to the same point (and two different addresses in one area do not collide). Nothing reads the wall clock, so any Vercel instance draws the same rider in the same place.
- **A whole express journey, minute by minute**: `confirmed → preparing → rider-assigned → picked-up → on-the-way → nearby → delivered`, sampled every 10 seconds of simulated time. `progress` only ever rises and stays inside [0,1] (still 1, not 1.4, a day later); `remainingKm` and `minutesRemaining` only ever fall; `bearing` stays in [0,360); the rider starts exactly on the Westlands hub, finishes exactly on the destination pin, and is never more than 5 m off the drawn route.
- **The other two shipping methods**: a standard order reads `scheduled` / `live:false` until tomorrow's 10:00 EAT window, then rides and delivers; a pickup order reaches `ready-for-pickup` with `rider: null` and the hub as its own destination, and never pretends to be on the road.
- **`pollAfterMs` is 0 exactly when nothing more will change** (delivered, ready for collection) and non-zero everywhere else — checked across several hundred sampled instants, which is what stops the browser polling a finished order forever.
- **The timeline** is in chronological order with `done` flipping in step with the stage and never un-completing a later step before an earlier one.
- **Geocoding** puts Westlands, the CBD, Karen, Kilimani, Lavington and Embakasi within 2 km of their published centres; aliases people actually type resolve ("Yaya" → Kilimani, "Sarit" → Westlands, "Taj Mall" → Imara Daima, "Ngong Rd" → Adams Arcade); Mombasa, Kisumu and Nakuru come back `inZone: false` instead of being guessed into Nairobi; an unrecognisable address falls back to `confidence: 'default'` with finite coordinates still inside the city.
- **Time travel is a security control, so it is asserted rather than trusted**: `?at=` moves the clock only when `TRACKING_TIME_TRAVEL=1`, and with the switch off (or set to `0`, `true`, `yes`) the server answers from the real clock — nobody can ask it to declare an order delivered. The same applies to the dispatch board.
- **`/api/config` never leaks a server-side key**: with `GOOGLE_MAPS_SERVER_KEY` and `GEOCODER=google` set, the response still reports `available: false, apiKey: null` and the key appears nowhere in the body. Only the referrer-restricted browser key is ever handed over.
- **Dispatch is closed by default**: 401 with no token, a wrong token, a missing `Bearer ` prefix and a one-character-longer token, and the refusal body carries no order id, name, email, phone or address. 503 with no data when `DISPATCH_TOKEN` is unset and the app believes it is on Vercel. Delivered orders drop off the board unless `include=all` asks for them, live orders sort first, and the counters describe the whole board rather than the filtered view.
- **SSE** answers `text/event-stream`, emits a valid `event: tracking` frame, ends immediately for a delivered order and 404s for an unknown one; a live stream delivers its first frame and survives the client hanging up.
- **Rate limiting and caching**: the tracking endpoint 429s the 61st lookup from one client within a minute while other clients are unaffected, and every tracking response carries `Cache-Control: no-store` with no ETag, because the payload is the customer's address.
- **Robustness**: a missing, null or empty address, a bad, missing or numeric `createdAt`, an unknown or missing shipping method, junk `items`, an out-of-zone address and an empty object all return a usable, JSON-serialisable tracking object instead of throwing.

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
- Live tracking on the confirmation page: a real order placed through the API renders the tracking panel with a stage, an ETA and a map that reports a working backend (`google` or `fallback`), plus the masked rider card and the journey timeline.
- The panel really is live: with the clock driven at 45x (the suite rewrites the page's own tracking requests to carry `?at=`, which the e2e server honours via `TRACKING_TIME_TRAVEL=1`), the progress bar climbs, the ETA counts down and the stage wording keeps up with the rider.
- A delivered order shows the delivered state, says "Updates finished" and issues no further tracking requests for the next nine seconds — it stops polling rather than hammering a finished order.
- A pickup order says "Ready for collection" and shows no rider.
- The dispatch board is shut until a token is entered: the gate is on screen, the board is hidden and no customer name, email, phone or order id is anywhere in the DOM. `dev-dispatch-token` opens it; the board then lists the orders with their customers, renders its map, and the search box narrows the list to one order. A wrong token leaves the board shut and shows an error.
- Both new pages (`order-confirmation.html` with the tracking panel, and `dispatch.html` locked and unlocked) load with no console errors and no horizontal overflow at 390px.

## Viewing results
- `npm run test:e2e:report` opens the Playwright HTML report (traces and screenshots are kept for any failure).
- Vitest prints per-test results in the terminal.
