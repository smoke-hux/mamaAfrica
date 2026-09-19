/**
 * Live tracking, end to end.
 *
 * The customer page and the dispatch board are driven by the same pure `trackOrder()`, so the
 * only way to see a rider move in a few seconds is to move the clock. The server accepts `?at=`
 * only when TRACKING_TIME_TRAVEL=1 (set for this suite in playwright.config.js), and the page
 * itself has no idea about it — these tests rewrite the tracking requests the page makes.
 */
import { test, expect } from '@playwright/test';

const ORDER_PAYLOAD = {
  // p12 (sifted maize flour, stock 200) deliberately: these specs place a lot of orders, and
  // draining a low-stock product would break shopping-flow's per-line-cap test on the shared server.
  items: [{ id: 'p12', qty: 2 }],
  shippingMethod: 'express',
  promoCode: '',
  customer: { firstName: 'Wanjiru', lastName: 'Kamau', email: 'wanjiru@example.com', phone: '+254 712 345 678' },
  address: { line1: '12 Ngong Road', line2: '', city: 'Nairobi', state: 'Nairobi', postalCode: '00100', country: 'KE' },
  payment: { method: 'card', cardNumber: '4242 4242 4242 4242', cardName: 'Wanjiru Kamau', expiry: '12/39', cvc: '123' },
  notes: '',
};

const MAP_BACKEND = /^(google|fallback)$/;

async function placeOrder(page, overrides = {}) {
  const res = await page.request.post('/api/orders', { data: { ...ORDER_PAYLOAD, ...overrides } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).order;
}

/**
 * Intercept the page's tracking requests and stamp a virtual "now" on them, so an order that is
 * really seconds old reads as one mid-journey. SSE is refused so the client falls back to polling,
 * which is the path we can rewrite.
 * @returns {{ requests: () => number }}
 */
async function driveClock(page, { from, speed = 0 }) {
  const started = Date.now();
  let requests = 0;
  // Refuse SSE the way a proxy that strips streams would: a plain non-event-stream response.
  // EventSource reports that as CLOSED, which is what makes track-client.js drop to polling.
  await page.route(/\/tracking\/stream/, (route) => route.fulfill({
    status: 503, contentType: 'text/plain', headers: { 'cache-control': 'no-store' }, body: 'no streams here',
  }));
  await page.route(/\/api\/orders\/[^/]+\/tracking(\?.*)?$/, async (route) => {
    requests += 1;
    const url = new URL(route.request().url());
    url.searchParams.set('at', new Date(from + (Date.now() - started) * speed).toISOString());
    await route.continue({ url: url.toString() });
  });
  return { requests: () => requests };
}

const minutesAfter = (order, minutes) => Date.parse(order.createdAt) + minutes * 60_000;
const progressNow = (page) => page.locator('#tracking-progress').getAttribute('aria-valuenow').then(Number);

/* ------------------------------------------------------------------ */

test('the confirmation page renders the live tracking panel with a working map', async ({ page }) => {
  const order = await placeOrder(page);
  await page.goto(`/order-confirmation.html?id=${order.id}`);

  const panel = page.getByTestId('tracking-panel');
  await expect(panel).toBeVisible();

  await expect(page.getByTestId('tracking-stage')).not.toBeEmpty();
  await expect(page.getByTestId('tracking-eta')).toContainText(/\S/);
  await expect(page.getByTestId('tracking-connection')).toContainText(/\S/);

  const map = page.getByTestId('tracking-map');
  await expect(map).toBeVisible();
  // Whether or not a Maps key is configured, the panel must end up with a real backend.
  await expect(map).toHaveAttribute('data-backend', MAP_BACKEND);
  const box = await map.boundingBox();
  expect(box.height, 'the map must reserve real space').toBeGreaterThan(120);

  // A delivery order has a rider and a journey.
  await expect(page.getByTestId('tracking-rider')).toBeVisible();
  await expect(page.getByTestId('tracking-rider')).toContainText(/•/); // masked phone, never a real one
  await expect(page.getByTestId('tracking-timeline').locator('li').first()).toBeVisible();
});

test('the panel advances on its own as the rider rides', async ({ page }) => {
  const order = await placeOrder(page);
  // 45x: every four-second poll is three minutes of the journey.
  await driveClock(page, { from: minutesAfter(order, 9), speed: 45 });
  await page.goto(`/order-confirmation.html?id=${order.id}`);

  await expect(page.getByTestId('tracking-panel')).toBeVisible();
  await expect.poll(() => progressNow(page), { timeout: 15_000 }).toBeGreaterThan(0);

  const firstProgress = await progressNow(page);
  const firstStage = await page.getByTestId('tracking-stage').innerText();
  const firstEta = await page.getByTestId('tracking-eta').innerText();

  await expect.poll(() => progressNow(page), {
    timeout: 25_000,
    message: 'the progress bar never moved: the page is not updating live',
  }).toBeGreaterThan(firstProgress);

  const laterEta = await page.getByTestId('tracking-eta').innerText();
  expect(laterEta, 'the ETA never changed').not.toBe(firstEta);

  // ...and the wording keeps up with the journey rather than sticking on the first frame.
  await expect.poll(async () => page.getByTestId('tracking-stage').innerText(), { timeout: 25_000 }).not.toBe(firstStage);
});

test('a delivered order shows the delivered state and stops polling', async ({ page }) => {
  const order = await placeOrder(page);
  const clock = await driveClock(page, { from: minutesAfter(order, 240), speed: 0 });
  await page.goto(`/order-confirmation.html?id=${order.id}`);

  await expect(page.getByTestId('tracking-stage')).toHaveText(/delivered/i);
  await expect(page.getByTestId('tracking-connection')).toContainText(/finished/i);
  await expect(page.getByTestId('tracking-eta')).toContainText(/delivered/i);
  await expect(page.locator('#tracking-progress')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('tracking-map')).toHaveAttribute('data-backend', MAP_BACKEND);

  const after = clock.requests();
  await page.waitForTimeout(9_000);
  expect(clock.requests(), 'the page kept polling a delivered order').toBe(after);
});

test('a pickup order says collection rather than inventing a rider', async ({ page }) => {
  const order = await placeOrder(page, { shippingMethod: 'pickup' });
  await driveClock(page, { from: minutesAfter(order, 30), speed: 0 });
  await page.goto(`/order-confirmation.html?id=${order.id}`);

  await expect(page.getByTestId('tracking-stage')).toHaveText(/collection/i);
  await expect(page.getByTestId('tracking-rider')).toBeHidden();
});

/* ------------------------------------------------------------------ */

test('the dispatch board is gated, then lists live orders on a map', async ({ page }) => {
  const orders = [];
  for (const city of [{ line1: '12 Ngong Road' }, { line1: '4 Bogani Road, Karen' }, { line1: '9 Limuru Road, Gigiri' }]) {
    orders.push(await placeOrder(page, { address: { ...ORDER_PAYLOAD.address, ...city } }));
  }

  await page.goto('/dispatch.html');
  await expect(page.getByTestId('dispatch-gate')).toBeVisible();
  await expect(page.getByTestId('dispatch-board')).toBeHidden();
  await expect(page.getByTestId('dispatch-order-row')).toHaveCount(0);

  // Nothing about a customer reaches the DOM before the token does.
  const locked = await page.locator('body').innerText();
  for (const secret of ['Wanjiru', 'wanjiru@example.com', '+254 712 345 678', orders[0].id]) {
    expect(locked, `the locked board leaked ${secret}`).not.toContain(secret);
  }

  await page.fill('#dispatch-token', 'dev-dispatch-token');
  await page.getByRole('button', { name: /open the board/i }).click();

  await expect(page.getByTestId('dispatch-board')).toBeVisible();
  await expect(page.getByTestId('dispatch-gate')).toBeHidden();
  await expect(page.getByTestId('dispatch-counters')).toBeVisible();
  await expect(page.getByTestId('dispatch-map')).toHaveAttribute('data-backend', MAP_BACKEND);

  const rows = page.getByTestId('dispatch-order-row');
  await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
  await expect(rows.filter({ hasText: orders[0].id })).toHaveCount(1);
  await expect(rows.first()).toContainText('Wanjiru Kamau');

  // Filtering is local and narrows the list to the one order.
  const before = await rows.count();
  await page.getByTestId('dispatch-filter').fill(orders[1].id);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(orders[1].id);
  expect(before).toBeGreaterThan(1);

  await page.getByTestId('dispatch-filter').fill('');
  await expect.poll(() => rows.count()).toBe(before);
});

test('a wrong dispatch token keeps the board shut', async ({ page }) => {
  await placeOrder(page);
  await page.goto('/dispatch.html');
  await page.fill('#dispatch-token', 'not-the-token');
  await page.getByRole('button', { name: /open the board/i }).click();

  await expect(page.getByTestId('dispatch-gate')).toBeVisible();
  await expect(page.getByTestId('dispatch-board')).toBeHidden();
  await expect(page.locator('[data-gate-error]')).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain('Wanjiru');
});

/* ------------------------------------------------------------------ */

test('both new pages are clean: no console errors and no sideways scroll at 390px', async ({ page }) => {
  const order = await placeOrder(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() !== 'error' || /favicon|fonts\.g/i.test(text)) return;
    errors.push(`console: ${text}`);
  });

  await page.setViewportSize({ width: 390, height: 844 });

  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.goto(`/order-confirmation.html?id=${order.id}`);
  await expect(page.getByTestId('tracking-panel')).toBeVisible();
  await expect(page.getByTestId('tracking-map')).toHaveAttribute('data-backend', MAP_BACKEND);
  expect(await overflow(), 'order-confirmation.html overflows at 390px').toBeLessThanOrEqual(1);

  await page.goto('/dispatch.html');
  await expect(page.getByTestId('dispatch-gate')).toBeVisible();
  expect(await overflow(), 'dispatch.html (locked) overflows at 390px').toBeLessThanOrEqual(1);

  await page.fill('#dispatch-token', 'dev-dispatch-token');
  await page.getByRole('button', { name: /open the board/i }).click();
  await expect(page.getByTestId('dispatch-board')).toBeVisible();
  await expect(page.getByTestId('dispatch-order-row').first()).toBeVisible();
  expect(await overflow(), 'dispatch.html (unlocked) overflows at 390px').toBeLessThanOrEqual(1);

  expect(errors, errors.join('\n')).toEqual([]);
});
