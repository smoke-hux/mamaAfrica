/**
 * Live tracking endpoints.
 *
 * Customer side: `/api/orders/:id/tracking` (poll) and `.../stream` (Server-Sent Events).
 * Ops side: `/api/dispatch/orders`, which returns customer names and addresses and is therefore
 * behind a bearer token rather than open like the rest of the demo API.
 */
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { getOrder, allOrders } from '../lib/orders-store.js';
import { trackOrder, isActive } from '../lib/tracking.js';
import { HUB } from '../lib/geocode.js';
import { rateLimit } from '../lib/security.js';

export const trackingRouter = Router();

/** How much of the delivered tail an ops board is actually interested in. */
const DELIVERED_WINDOW_MS = 12 * 60 * 60 * 1000;
const MAX_DELIVERED_ROWS = 50;

/** SSE is cut short by the platform's function timeout, so close first and let EventSource reconnect. */
const STREAM_MS = 45_000;
const TICK_MS = 5_000;
const HEARTBEAT_MS = 20_000;

/**
 * "now" can be overridden for tests and screenshots, but only where it is explicitly switched on.
 * Without this guard anyone could ask the server to claim an order was delivered.
 */
function resolveNow(req) {
  if (process.env.TRACKING_TIME_TRAVEL !== '1') return new Date();
  const at = new Date(String(req.query.at || ''));
  return Number.isNaN(at.getTime()) ? new Date() : at;
}

/** Browser-side config. Only ever the referrer-restricted browser key, never the server key. */
trackingRouter.get('/config', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_BROWSER_KEY || null;
  res.json({
    maps: { available: Boolean(apiKey), apiKey, mapId: process.env.GOOGLE_MAPS_MAP_ID || null },
    hub: { lat: HUB.lat, lng: HUB.lng, name: HUB.name, area: HUB.area },
  });
});

/** GET /api/orders/:id/tracking */
trackingRouter.get('/orders/:id/tracking', rateLimit({ max: 60, name: 'tracking requests' }), (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ tracking: trackOrder(order, resolveNow(req)) });
});

/** GET /api/orders/:id/tracking/stream — SSE. */
trackingRouter.get('/orders/:id/tracking/stream', rateLimit({ max: 30, name: 'tracking streams' }), (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let closed = false;
  const timers = [];
  const stop = () => {
    if (closed) return;
    closed = true;
    timers.forEach(clearInterval);
    timers.forEach(clearTimeout);
    res.end();
  };

  let toldRetry = false;
  const send = () => {
    if (closed) return;
    const tracking = trackOrder(order, resolveNow(req));
    // EventSource reconnects on its own after every close, at ~3s unless we say otherwise. An order
    // that is not moving yet (a standard order waiting for tomorrow's window) would then reconnect
    // hundreds of times an hour and trip the stream rate limit, so hand it the server's own cadence.
    let retry = '';
    if (!toldRetry && tracking.pollAfterMs > 0) {
      toldRetry = true;
      // A field of this same frame, not a frame of its own: one `\n\n` per update.
      retry = `retry: ${Math.max(1000, Math.round(tracking.pollAfterMs))}\n`;
    }
    res.write(`${retry}event: tracking\ndata: ${JSON.stringify(tracking)}\n\n`);
    // `pollAfterMs === 0` is the contract for "nothing further will change" (delivered, collected).
    // `live === false` is NOT the same thing: a scheduled order still has a dispatch to report.
    if (tracking.pollAfterMs === 0) stop();
  };

  // Register the timers BEFORE the first send(): a delivered order stops inside that first call,
  // and anything created afterwards could never be cleared, leaking an interval per request.
  timers.push(setInterval(send, TICK_MS));
  timers.push(setInterval(() => { if (!closed) res.write(': keep-alive\n\n'); }, HEARTBEAT_MS));
  timers.push(setTimeout(stop, STREAM_MS));
  send();
  req.on('close', stop);
  req.on('aborted', stop);
});

/* ------------------------------------------------------------------ */
/* Dispatch (ops)                                                      */
/* ------------------------------------------------------------------ */

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * The dispatch board shows every live order with the customer's name and area, so it needs a
 * token. There is deliberately no default in production: an unset token fails closed.
 */
export function requireDispatchToken(req, res, next) {
  const configured = process.env.DISPATCH_TOKEN
    || (!process.env.VERCEL && process.env.NODE_ENV !== 'production' ? 'dev-dispatch-token' : null);

  if (!configured) {
    return res.status(503).json({ error: 'Dispatch is not configured. Set DISPATCH_TOKEN to enable it.' });
  }
  // Header only. A `?token=` would end up in CDN access logs, browser history and any Referer the
  // page sends, which is exactly what the board's own copy promises never happens.
  const header = String(req.get('authorization') || '');
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!presented || !safeEqual(presented, configured)) {
    return res.status(401).json({ error: 'Dispatch token required' });
  }
  return next();
}

/** GET /api/dispatch/orders */
trackingRouter.get('/dispatch/orders', rateLimit({ max: 120, name: 'dispatch requests' }), requireDispatchToken, (req, res) => {
  const now = resolveNow(req);
  const includeDelivered = String(req.query.include || '') === 'all';

  const rows = allOrders().map((order) => {
    const t = trackOrder(order, now);
    return {
      id: order.id,
      stage: t.stage,
      stageLabel: t.stageLabel,
      live: t.live,
      progress: t.progress,
      position: t.position,
      destination: t.destination,
      origin: t.origin,
      route: t.route,
      minutesRemaining: t.minutesRemaining,
      etaAt: t.etaAt,
      rider: t.rider,
      shippingMethod: t.shippingMethod,
      createdAt: order.createdAt,
      customerName: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' '),
      customerPhone: order.customer?.phone || '',
      area: t.destination.area,
      addressLine: [order.address?.line1, order.address?.line2].filter(Boolean).join(', '),
      total: order.totals?.total ?? 0,
      itemCount: Array.isArray(order.items) ? order.items.reduce((n, i) => n + (Number(i.qty) || 0), 0) : 0,
    };
  });

  const active = rows.filter(isActive);
  // Delivered orders are only useful to ops for a while, and the store never forgets an order,
  // so cap the tail by age and count rather than growing the payload forever.
  const recentlyDelivered = rows
    .filter((r) => !isActive(r) && now.getTime() - new Date(r.etaAt).getTime() < DELIVERED_WINDOW_MS);
  const delivered = includeDelivered
    ? recentlyDelivered
      .slice()
      .sort((a, b) => new Date(b.etaAt) - new Date(a.etaAt))
      .slice(0, MAX_DELIVERED_ROWS)
    : [];

  const orders = [...active, ...delivered]
    .sort((a, b) => (b.live === a.live ? new Date(b.createdAt) - new Date(a.createdAt) : Number(b.live) - Number(a.live)));

  res.json({
    orders,
    hub: { lat: HUB.lat, lng: HUB.lng, name: HUB.name },
    counts: {
      total: rows.length,
      live: rows.filter((r) => r.live).length,
      // The board labels this "Delivered today", so count the same recent window the rows use
      // rather than every order the store has ever finished.
      delivered: recentlyDelivered.length,
    },
    updatedAt: now.toISOString(),
  });
});

export default trackingRouter;
