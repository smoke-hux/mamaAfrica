/**
 * Tracking HTTP surface: the customer poll and stream, the ops dispatch board, and the browser
 * config endpoint.
 *
 * Two of these are security controls rather than features, so they are asserted rather than
 * trusted: `?at=` time travel must be inert unless TRACKING_TIME_TRAVEL=1, and /api/config must
 * never hand the browser a server-side Maps key.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { rmSync } from 'node:fs';
import http from 'node:http';
import { loadApp, validOrder } from './helpers.js';

let app, dir;
beforeAll(async () => ({ app, dir } = await loadApp()));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const DEV_TOKEN = 'dev-dispatch-token';

/** Set env vars for one test; returns a restore function that puts the old values back. */
function withEnv(vars) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

async function placeOrder(overrides = {}) {
  const res = await request(app).post('/api/orders').send(validOrder(overrides));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.order;
}

/** An ISO instant `hours` after the order was placed. */
const after = (order, hours) => new Date(Date.parse(order.createdAt) + hours * 3600_000).toISOString();

const TRACKING_KEYS = [
  'orderId', 'stage', 'stageLabel', 'live', 'progress', 'position', 'bearing', 'origin',
  'destination', 'route', 'distanceKm', 'remainingKm', 'etaAt', 'minutesRemaining',
  'deliveredAt', 'rider', 'timeline', 'updatedAt', 'pollAfterMs',
];

/* ------------------------------------------------------------------ */

describe('GET /api/orders/:id/tracking', () => {
  it('returns the full tracking shape for a real order', async () => {
    const order = await placeOrder({ shippingMethod: 'express' });
    const res = await request(app).get(`/api/orders/${order.id}/tracking`);

    expect(res.status).toBe(200);
    const t = res.body.tracking;
    expect(t).toBeTruthy();
    for (const key of TRACKING_KEYS) expect(t, `missing ${key}`).toHaveProperty(key);
    expect(t.orderId).toBe(order.id);
    expect(typeof t.stage).toBe('string');
    expect(typeof t.live).toBe('boolean');
    expect(Number.isFinite(t.position.lat)).toBe(true);
    expect(Number.isFinite(t.position.lng)).toBe(true);
    expect(Array.isArray(t.route)).toBe(true);
    expect(t.route.length).toBeGreaterThan(1);
    expect(Array.isArray(t.timeline)).toBe(true);
    expect(t.rider).toMatchObject({ name: expect.any(String), plate: expect.any(String) });
  });

  it('404s for an unknown order without leaking whether the id is plausible', async () => {
    for (const id of ['MAM-NOPE00', 'not-an-id', 'MAM-AB12CD']) {
      const res = await request(app).get(`/api/orders/${id}/tracking`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Order not found' });
    }
  });

  it('matches the order id case-insensitively, like the order lookup does', async () => {
    const order = await placeOrder();
    const lower = await request(app).get(`/api/orders/${order.id.toLowerCase()}/tracking`);
    expect(lower.status).toBe(200);
    expect(lower.body.tracking.orderId).toBe(order.id);
    const spaced = await request(app).get(`/api/orders/${encodeURIComponent(` ${order.id} `)}/tracking`);
    expect(spaced.status).toBe(200);
  });

  it('is never cached: the payload carries the customer\'s address', async () => {
    const order = await placeOrder();
    const res = await request(app).get(`/api/orders/${order.id}/tracking`);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.etag).toBeUndefined();
  });
});

describe('?at= time travel', () => {
  it('moves the clock when TRACKING_TIME_TRAVEL=1', async () => {
    const order = await placeOrder({ shippingMethod: 'express' });
    const restore = withEnv({ TRACKING_TIME_TRAVEL: '1' });
    try {
      const now = await request(app).get(`/api/orders/${order.id}/tracking`);
      expect(now.body.tracking.stage).toBe('confirmed');

      const later = await request(app).get(`/api/orders/${order.id}/tracking`).query({ at: after(order, 3) });
      expect(later.body.tracking.stage).toBe('delivered');
      expect(later.body.tracking.live).toBe(false);
      expect(later.body.tracking.pollAfterMs).toBe(0);

      // Garbage in the parameter falls back to the real clock instead of erroring or NaN-ing.
      const junk = await request(app).get(`/api/orders/${order.id}/tracking`).query({ at: 'yesterday-ish' });
      expect(junk.status).toBe(200);
      expect(junk.body.tracking.stage).toBe('confirmed');
    } finally { restore(); }
  });

  it('IGNORES ?at= when the switch is not set, so nobody can fake a delivery', async () => {
    const order = await placeOrder({ shippingMethod: 'express' });
    for (const value of [undefined, '0', 'true', 'yes']) {
      const restore = withEnv({ TRACKING_TIME_TRAVEL: value });
      try {
        const res = await request(app).get(`/api/orders/${order.id}/tracking`).query({ at: after(order, 5) });
        expect(res.status).toBe(200);
        expect(res.body.tracking.stage, `TRACKING_TIME_TRAVEL=${value}`).toBe('confirmed');
        expect(res.body.tracking.deliveredAt).toBeNull();
        // ...and the returned "now" really is now, not the requested instant.
        expect(Math.abs(Date.parse(res.body.tracking.updatedAt) - Date.now())).toBeLessThan(30_000);
      } finally { restore(); }
    }
  });

  it('ignores ?at= on the dispatch board too when the switch is off', async () => {
    const order = await placeOrder({ shippingMethod: 'express' });
    const restore = withEnv({ TRACKING_TIME_TRAVEL: undefined });
    try {
      const res = await request(app).get('/api/dispatch/orders')
        .query({ at: after(order, 5), include: 'all' })
        .set('Authorization', `Bearer ${DEV_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.orders.find((o) => o.id === order.id).stage).not.toBe('delivered');
    } finally { restore(); }
  });
});

describe('GET /api/config', () => {
  it('reports maps as unavailable when no browser key is configured', async () => {
    const restore = withEnv({ GOOGLE_MAPS_BROWSER_KEY: undefined, GOOGLE_MAPS_MAP_ID: undefined });
    try {
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(200);
      expect(res.body.maps).toEqual({ available: false, apiKey: null, mapId: null });
      expect(res.body.hub).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number), name: expect.any(String) });
    } finally { restore(); }
  });

  it('never leaks the server-side key, whatever else is set', async () => {
    const SERVER_KEY = 'AIza-SERVER-ONLY-do-not-ship-to-browsers';
    const restore = withEnv({
      GOOGLE_MAPS_SERVER_KEY: SERVER_KEY,
      GEOCODER: 'google',
      GOOGLE_MAPS_BROWSER_KEY: undefined,
    });
    try {
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(200);
      expect(res.text).not.toContain(SERVER_KEY);
      expect(JSON.stringify(res.body)).not.toContain('SERVER-ONLY');
      expect(res.body.maps.apiKey).toBeNull();
      expect(res.body.maps.available).toBe(false);
    } finally { restore(); }
  });

  it('hands over only the referrer-restricted browser key when there is one', async () => {
    const restore = withEnv({
      GOOGLE_MAPS_BROWSER_KEY: 'AIza-browser-key',
      GOOGLE_MAPS_MAP_ID: 'map-abc',
      GOOGLE_MAPS_SERVER_KEY: 'AIza-SERVER-ONLY',
    });
    try {
      const res = await request(app).get('/api/config');
      expect(res.body.maps).toEqual({ available: true, apiKey: 'AIza-browser-key', mapId: 'map-abc' });
      expect(res.text).not.toContain('SERVER-ONLY');
    } finally { restore(); }
  });
});

describe('GET /api/dispatch/orders', () => {
  it('401s with no token and with a wrong token, and the refusal carries no customer data', async () => {
    const order = await placeOrder();
    const customer = validOrder().customer;

    for (const req of [
      request(app).get('/api/dispatch/orders'),
      request(app).get('/api/dispatch/orders').set('Authorization', 'Bearer nope'),
      request(app).get('/api/dispatch/orders').set('Authorization', DEV_TOKEN), // no "Bearer " prefix
      request(app).get('/api/dispatch/orders').set('Authorization', `Bearer ${DEV_TOKEN}x`),
      request(app).get('/api/dispatch/orders').query({ token: 'nope' }),
    ]) {
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Dispatch token required' });
      expect(res.body.orders).toBeUndefined();
      for (const secret of [order.id, customer.firstName, customer.lastName, customer.email, customer.phone, 'Muthithi']) {
        expect(res.text, `401 body leaked ${secret}`).not.toContain(secret);
      }
    }
  });

  it('200s with the right token and returns the ops rows', async () => {
    const order = await placeOrder({ shippingMethod: 'express' });
    const res = await request(app).get('/api/dispatch/orders').set('Authorization', `Bearer ${DEV_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.counts).toMatchObject({ total: expect.any(Number), live: expect.any(Number), delivered: expect.any(Number) });
    expect(res.body.hub).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });

    const row = res.body.orders.find((o) => o.id === order.id);
    expect(row).toBeTruthy();
    expect(row).toMatchObject({
      stage: expect.any(String),
      customerName: 'Wanjiru Kamau',
      area: expect.any(String),
      shippingMethod: 'express',
      minutesRemaining: expect.any(Number),
    });
    expect(Number.isFinite(row.position.lat)).toBe(true);
    expect(row.total).toBeGreaterThan(0);
    expect(row.itemCount).toBeGreaterThan(0);
  });

  it('hides delivered orders unless include=all asks for them', async () => {
    const restore = withEnv({ TRACKING_TIME_TRAVEL: '1' });
    try {
      const order = await placeOrder({ shippingMethod: 'express' });
      const at = after(order, 4);
      const auth = (r) => r.set('Authorization', `Bearer ${DEV_TOKEN}`);

      const active = await auth(request(app).get('/api/dispatch/orders').query({ at }));
      const all = await auth(request(app).get('/api/dispatch/orders').query({ at, include: 'all' }));

      expect(all.body.orders.find((o) => o.id === order.id).stage).toBe('delivered');
      expect(active.body.orders.find((o) => o.id === order.id)).toBeUndefined();
      expect(active.body.orders.every((o) => o.stage !== 'delivered')).toBe(true);
      expect(all.body.orders.length).toBeGreaterThan(active.body.orders.length);

      // The counters describe every order, not just the visible ones.
      expect(all.body.counts.total).toBe(active.body.counts.total);
      expect(all.body.counts.delivered).toBeGreaterThanOrEqual(1);
      expect(all.body.orders.length).toBe(all.body.counts.total);

      // Live orders sort ahead of settled ones so the board reads top-down.
      const live = all.body.orders.map((o) => o.live);
      expect(live).toEqual([...live].sort((a, b) => Number(b) - Number(a)));
    } finally { restore(); }
  });

  it('503s and returns no data when DISPATCH_TOKEN is unset on Vercel', async () => {
    await placeOrder();
    const restore = withEnv({ DISPATCH_TOKEN: undefined, VERCEL: '1' });
    try {
      for (const req of [
        request(app).get('/api/dispatch/orders'),
        request(app).get('/api/dispatch/orders').set('Authorization', `Bearer ${DEV_TOKEN}`),
      ]) {
        const res = await req;
        expect(res.status).toBe(503);
        expect(res.body.orders).toBeUndefined();
        expect(res.body.error).toMatch(/DISPATCH_TOKEN/);
        expect(res.text).not.toContain('Wanjiru');
      }
    } finally { restore(); }
    // The env really is back: the dev token works again.
    expect((await request(app).get('/api/dispatch/orders').set('Authorization', `Bearer ${DEV_TOKEN}`)).status).toBe(200);
  });

  it('accepts a configured DISPATCH_TOKEN and rejects the dev default once one is set', async () => {
    const restore = withEnv({ DISPATCH_TOKEN: 'a-real-secret-token' });
    try {
      expect((await request(app).get('/api/dispatch/orders').set('Authorization', 'Bearer a-real-secret-token')).status).toBe(200);
      expect((await request(app).get('/api/dispatch/orders').set('Authorization', `Bearer ${DEV_TOKEN}`)).status).toBe(401);
    } finally { restore(); }
  });
});

describe('GET /api/orders/:id/tracking/stream (SSE)', () => {
  it('streams an event and closes straight away for a delivered order', async () => {
    const restore = withEnv({ TRACKING_TIME_TRAVEL: '1' });
    try {
      const order = await placeOrder({ shippingMethod: 'express' });
      const started = Date.now();
      // A delivered order has nothing left to say, so the server ends the stream after one event —
      // which keeps this test in milliseconds rather than the 45s the stream otherwise runs for.
      const res = await request(app)
        .get(`/api/orders/${order.id}/tracking/stream`)
        .query({ at: after(order, 4) });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^text\/event-stream/);
      expect(res.headers['cache-control']).toMatch(/no-store/);
      expect(Date.now() - started, 'a delivered stream should end immediately').toBeLessThan(5_000);

      const frames = res.text.split('\n\n').filter((f) => f.startsWith('event: tracking'));
      expect(frames.length).toBeGreaterThanOrEqual(1);
      const payload = JSON.parse(frames[0].split('\n').find((l) => l.startsWith('data: ')).slice(6));
      expect(payload.orderId).toBe(order.id);
      expect(payload.stage).toBe('delivered');
      expect(payload.live).toBe(false);
      expect(payload.pollAfterMs).toBe(0);
    } finally { restore(); }
  }, 20_000);

  it('sends a first frame for a live order, then lets the client walk away', async () => {
    const order = await placeOrder({ shippingMethod: 'express' });
    // A live stream stays open for ~45s, so drive it with a raw socket we can hang up on the
    // first frame instead of waiting for the server to close it.
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const { port } = server.address();
    let headers = null;
    try {
      const text = await new Promise((resolve) => {
        const req = http.get({ port, path: `/api/orders/${order.id}/tracking/stream` }, (res) => {
          headers = { status: res.statusCode, ...res.headers };
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk;
            if (buffer.includes('\n\n')) { req.destroy(); resolve(buffer); }
          });
          res.on('error', () => resolve(buffer));
          res.on('end', () => resolve(buffer));
        });
        req.on('error', () => {}); // hanging up on ourselves is the point
        setTimeout(() => { req.destroy(); resolve(''); }, 8_000).unref?.();
      });

      expect(headers?.status).toBe(200);
      expect(headers['content-type']).toMatch(/^text\/event-stream/);
      expect(text, 'no SSE frame arrived').toContain('event: tracking');
      const payload = JSON.parse(text.split('\n').find((l) => l.startsWith('data: ')).slice(6));
      expect(payload.orderId).toBe(order.id);
      expect(payload.live).toBe(true);
      expect(payload.pollAfterMs).toBeGreaterThan(0);
    } finally {
      await new Promise((r) => server.close(r));
    }
  }, 20_000);

  it('404s for an unknown order rather than opening a stream', async () => {
    const res = await request(app).get('/api/orders/MAM-NOPE00/tracking/stream');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Order not found' });
  });
});

describe('rate limiting', () => {
  it('throttles tracking lookups', async () => {
    // The suites run with RATE_LIMIT=off (see helpers.js); switch the limiter on for this test only.
    const restore = withEnv({ RATE_LIMIT: undefined, TRUST_PROXY: '1' });
    try {
      const order = await placeOrder();
      const ip = '203.0.113.7';
      let last;
      for (let i = 0; i < 61; i++) {
        last = await request(app).get(`/api/orders/${order.id}/tracking`).set('x-real-ip', ip);
      }
      expect(last.status).toBe(429);
      expect(last.body.error).toMatch(/Too many tracking requests/);
      expect(last.headers['retry-after']).toBeTruthy();
      // A different client is unaffected.
      expect((await request(app).get(`/api/orders/${order.id}/tracking`).set('x-real-ip', '203.0.113.9')).status).toBe(200);
    } finally { restore(); }
  }, 30_000);
});
