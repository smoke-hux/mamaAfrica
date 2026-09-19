/**
 * Live tracking: the pure core.
 *
 * `trackOrder()` and `geocodeAddress()` are the whole feature. Vercel runs many instances with no
 * shared memory, so the rider's position has to be a pure function of (order, instant) — every
 * instance must compute the same answer or the customer's map and the dispatch board disagree.
 * These tests hold that property down, then walk an order through its whole life minute by minute.
 */
import { describe, it, expect } from 'vitest';
import { trackOrder, buildRoute, isActive, STAGES } from '../../server/lib/tracking.js';
import { geocodeAddress, HUB, NAIROBI_AREAS, haversineKm } from '../../server/lib/geocode.js';

const CREATED = '2026-09-19T08:00:00.000Z';
const T0 = Date.parse(CREATED);
/** An instant `minutes` after the order was placed. */
const at = (minutes) => new Date(T0 + minutes * 60_000);

function makeOrder(overrides = {}) {
  return {
    id: 'MAM-AB12CD',
    status: 'confirmed',
    createdAt: CREATED,
    shippingMethod: 'express',
    items: [{ id: 'p01', qty: 2 }],
    totals: { total: 2225 },
    customer: { firstName: 'Wanjiru', lastName: 'Kamau', email: 'wanjiru@example.com', phone: '+254 712 345 678' },
    address: { line1: '12 Ngong Road', line2: '', city: 'Nairobi', state: 'Nairobi', postalCode: '00100', country: 'KE' },
    estimatedDelivery: CREATED,
    ...overrides,
  };
}

/** Sample an order's tracking every `stepMin` minutes from 0 to `untilMin`. */
function walk(order, untilMin, stepMin = 1 / 6) {
  const out = [];
  for (let m = 0; m <= untilMin + 1e-9; m += stepMin) out.push(trackOrder(order, at(m)));
  return out;
}

const dedupe = (values) => values.filter((v, i) => i === 0 || v !== values[i - 1]);

/** Shortest distance in km from `p` to the polyline `route` (equirectangular is plenty at city scale). */
function distanceToRouteKm(p, route) {
  const KM_PER_DEG = 111.32;
  const toXY = (q) => ({ x: q.lng * KM_PER_DEG * Math.cos((p.lat * Math.PI) / 180), y: q.lat * KM_PER_DEG });
  const P = toXY(p);
  let best = Infinity;
  for (let i = 1; i < route.length; i++) {
    const A = toXY(route[i - 1]);
    const B = toXY(route[i]);
    const vx = B.x - A.x;
    const vy = B.y - A.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 ? Math.max(0, Math.min(1, ((P.x - A.x) * vx + (P.y - A.y) * vy) / len2)) : 0;
    best = Math.min(best, Math.hypot(P.x - (A.x + vx * t), P.y - (A.y + vy * t)));
  }
  return route.length === 1 ? haversineKm(p, route[0]) : best;
}

/* ------------------------------------------------------------------ */

describe('trackOrder determinism', () => {
  it('returns a byte-identical result for the same order at the same instant', () => {
    const order = makeOrder();
    const a = JSON.stringify(trackOrder(order, at(12)));
    const b = JSON.stringify(trackOrder(order, at(12)));
    expect(a).toBe(b);
    // A different object with the same values is the same order as far as tracking is concerned:
    // that is what makes two serverless instances agree.
    expect(JSON.stringify(trackOrder(makeOrder(), at(12)))).toBe(a);
    // The instant may arrive as a Date, an ISO string or epoch millis.
    expect(JSON.stringify(trackOrder(order, at(12).toISOString()))).toBe(a);
    expect(JSON.stringify(trackOrder(order, at(12).getTime()))).toBe(a);
  });

  it('never depends on the wall clock: repeated calls a real moment apart still match', async () => {
    const order = makeOrder();
    const first = JSON.stringify(trackOrder(order, at(9)));
    await new Promise((r) => setTimeout(r, 25));
    expect(JSON.stringify(trackOrder(order, at(9)))).toBe(first);
  });

  it('gives the same rider and the same route to the same order every time', () => {
    const a = trackOrder(makeOrder(), at(10));
    const b = trackOrder(makeOrder(), at(30));
    expect(b.rider).toEqual(a.rider);
    expect(b.route).toEqual(a.route);
    expect(b.destination).toEqual(a.destination);
  });

  it('geocodes two separate instances of the same address identically', () => {
    const addr = () => ({ line1: '12 Ngong Road', line2: 'Apt 4', city: 'Nairobi', state: 'Nairobi' });
    expect(geocodeAddress(addr())).toEqual(geocodeAddress(addr()));
    // ...and two different addresses in the same area do not land on the same pin.
    const one = geocodeAddress({ line1: '1 Rose Avenue', city: 'Kilimani' });
    const two = geocodeAddress({ line1: '99 Lenana Road', city: 'Kilimani' });
    expect(one.area).toBe('Kilimani');
    expect(two.area).toBe('Kilimani');
    expect(one).not.toEqual(two);
  });
});

describe('express order: stage progression over time', () => {
  const order = makeOrder();
  const samples = walk(order, 40);

  it('walks confirmed -> preparing -> rider-assigned -> picked-up -> on-the-way -> nearby -> delivered', () => {
    expect(dedupe(samples.map((s) => s.stage))).toEqual([
      'confirmed', 'preparing', 'rider-assigned', 'picked-up', 'on-the-way', 'nearby', 'delivered',
    ]);
    for (const s of samples) {
      expect(STAGES).toContain(s.stage);
      expect(s.stageLabel).toBeTruthy();
    }
  });

  it('keeps progress monotonically non-decreasing and clamped to [0,1]', () => {
    let previous = -Infinity;
    for (const s of samples) {
      expect(s.progress).toBeGreaterThanOrEqual(0);
      expect(s.progress).toBeLessThanOrEqual(1);
      expect(s.progress).toBeGreaterThanOrEqual(previous);
      previous = s.progress;
    }
    expect(samples[0].progress).toBe(0);
    expect(samples[samples.length - 1].progress).toBe(1);
    // Far past the ETA it stays clamped rather than running off the end of the route.
    expect(trackOrder(order, at(60 * 24)).progress).toBe(1);
  });

  it('starts at the hub, ends at the destination and never leaves the route', () => {
    const first = samples[0];
    const last = samples[samples.length - 1];
    expect(first.position).toEqual({ lat: HUB.lat, lng: HUB.lng });
    expect(first.origin).toMatchObject({ lat: HUB.lat, lng: HUB.lng, name: HUB.name });
    expect(last.stage).toBe('delivered');
    expect(last.position).toEqual({ lat: last.destination.lat, lng: last.destination.lng });

    expect(first.route.length).toBeGreaterThanOrEqual(20);
    expect(first.route[0]).toEqual({ lat: HUB.lat, lng: HUB.lng });
    expect(first.route[first.route.length - 1]).toEqual({ lat: first.destination.lat, lng: first.destination.lng });
    for (const s of samples) {
      expect(distanceToRouteKm(s.position, s.route), `off-route at ${s.updatedAt}`).toBeLessThan(0.005);
    }
  });

  it('counts remainingKm down monotonically to zero and keeps bearing in [0,360)', () => {
    let previous = Infinity;
    for (const s of samples) {
      expect(s.remainingKm).toBeGreaterThanOrEqual(0);
      expect(s.remainingKm).toBeLessThanOrEqual(s.distanceKm);
      expect(s.remainingKm, `remainingKm rose at ${s.updatedAt}`).toBeLessThanOrEqual(previous);
      previous = s.remainingKm;
      expect(Number.isFinite(s.bearing)).toBe(true);
      expect(s.bearing).toBeGreaterThanOrEqual(0);
      expect(s.bearing).toBeLessThan(360);
    }
    expect(samples[samples.length - 1].remainingKm).toBe(0);
    expect(samples[0].remainingKm).toBe(samples[0].distanceKm);
    expect(samples[0].distanceKm).toBeGreaterThan(0);
  });

  it('counts minutesRemaining down and reports deliveredAt only once delivered', () => {
    let previous = Infinity;
    for (const s of samples) {
      expect(s.minutesRemaining).toBeGreaterThanOrEqual(0);
      expect(s.minutesRemaining).toBeLessThanOrEqual(previous);
      previous = s.minutesRemaining;
      expect(s.deliveredAt === null || s.stage === 'delivered').toBe(true);
    }
    const last = samples[samples.length - 1];
    expect(last.minutesRemaining).toBe(0);
    expect(last.deliveredAt).toBe(last.etaAt);
    expect(new Date(last.etaAt).toISOString()).toBe(last.etaAt);
  });

  it('stops being live and stops being dispatch-worthy once delivered', () => {
    for (const s of samples) expect(s.live).toBe(s.stage !== 'delivered');
    expect(isActive(trackOrder(order, at(10)))).toBe(true);
    expect(isActive(trackOrder(order, at(40)))).toBe(false);
  });

  it('carries a stable masked rider that never exposes a real phone number', () => {
    const { rider } = trackOrder(order, at(10));
    expect(rider).toMatchObject({ name: expect.any(String), vehicle: expect.any(String), plate: expect.any(String) });
    expect(rider.phone).toMatch(/•/);
    expect(rider.phone.replace(/\D/g, '').length).toBeLessThan(10);
    expect(rider.rating).toBeGreaterThanOrEqual(4.5);
    expect(rider.rating).toBeLessThanOrEqual(5);
  });
});

describe('standard and pickup orders', () => {
  const standard = makeOrder({ shippingMethod: 'standard', estimatedDelivery: '2026-09-20T08:00:00.000Z' });

  it('is scheduled and not live before its delivery window', () => {
    const t = trackOrder(standard, at(30));
    expect(t.stage).toBe('scheduled');
    expect(t.live).toBe(false);
    expect(t.progress).toBe(0);
    expect(t.position).toEqual({ lat: HUB.lat, lng: HUB.lng });
    expect(t.pollAfterMs).toBeGreaterThan(0); // it will change tomorrow, so keep checking (slowly)
    expect(new Date(t.dispatchAt).getTime()).toBeGreaterThan(Date.parse(CREATED));
  });

  it('rides during its window and finishes delivered', () => {
    const dispatchAt = Date.parse(trackOrder(standard).dispatchAt);
    const riding = trackOrder(standard, new Date(dispatchAt + 20 * 60_000));
    expect(riding.live).toBe(true);
    expect(['picked-up', 'on-the-way', 'nearby']).toContain(riding.stage);
    expect(riding.progress).toBeGreaterThan(0);
    const later = trackOrder(standard, new Date(dispatchAt + 6 * 3600_000));
    expect(later.stage).toBe('delivered');
    expect(later.live).toBe(false);
  });

  it('pickup reaches ready-for-pickup with no rider and the hub as the destination', () => {
    const pickup = makeOrder({ shippingMethod: 'pickup' });
    const early = trackOrder(pickup, at(2));
    expect(early.stage).toBe('confirmed');
    expect(early.rider).toBeNull();

    const ready = trackOrder(pickup, at(30));
    expect(ready.stage).toBe('ready-for-pickup');
    expect(ready.stageLabel).toMatch(/collection/i);
    expect(ready.live).toBe(false);
    expect(ready.rider).toBeNull();
    expect(ready.destination).toMatchObject({ lat: HUB.lat, lng: HUB.lng });
    expect(ready.position).toEqual({ lat: HUB.lat, lng: HUB.lng });
    expect(ready.distanceKm).toBe(0);
    expect(ready.remainingKm).toBe(0);
    expect(ready.minutesRemaining).toBe(0);
  });
});

describe('pollAfterMs', () => {
  it('is 0 exactly when nothing more will change', () => {
    const cases = [
      ...walk(makeOrder(), 45, 0.5),
      ...walk(makeOrder({ shippingMethod: 'pickup' }), 45, 0.5),
      ...walk(makeOrder({ shippingMethod: 'standard', estimatedDelivery: '2026-09-20T08:00:00.000Z' }), 60 * 30, 7),
    ];
    expect(cases.length).toBeGreaterThan(100);
    for (const t of cases) {
      const settled = t.stage === 'delivered' || t.stage === 'ready-for-pickup';
      expect(t.pollAfterMs === 0, `${t.stage} -> pollAfterMs ${t.pollAfterMs}`).toBe(settled);
      expect(Number.isFinite(t.pollAfterMs)).toBe(true);
      expect(t.pollAfterMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('asks for updates more often when the rider is nearly there', () => {
    const nearby = walk(makeOrder(), 40).find((t) => t.stage === 'nearby');
    const moving = walk(makeOrder(), 40).find((t) => t.stage === 'on-the-way');
    expect(nearby.pollAfterMs).toBeLessThan(moving.pollAfterMs);
  });
});

describe('timeline', () => {
  const ORDER_OF = { confirmed: 1, preparing: 2, 'rider-assigned': 3, 'picked-up': 4, 'on-the-way': 5, nearby: 6, 'ready-for-pickup': 7, delivered: 8 };

  it('is in chronological order with `done` flipping in step with the stage', () => {
    for (const t of walk(makeOrder(), 40, 0.5)) {
      expect(t.timeline.length).toBeGreaterThanOrEqual(3);
      let previous = -Infinity;
      for (const row of t.timeline) {
        const when = Date.parse(row.at);
        expect(Number.isNaN(when)).toBe(false);
        expect(when, `timeline out of order in ${t.stage}`).toBeGreaterThanOrEqual(previous);
        previous = when;
        expect(row.label).toBeTruthy();
        expect(row.done).toBe(ORDER_OF[row.stage] <= ORDER_OF[t.stage]);
      }
      // Once a step is not done, nothing after it is done either.
      const flags = t.timeline.map((r) => r.done);
      expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    }
  });

  it('completes every step once delivered, and uses the pickup wording for a collection', () => {
    const delivered = trackOrder(makeOrder(), at(60));
    expect(delivered.timeline.every((r) => r.done)).toBe(true);
    expect(delivered.timeline[delivered.timeline.length - 1].stage).toBe('delivered');

    const pickup = trackOrder(makeOrder({ shippingMethod: 'pickup' }), at(30));
    expect(pickup.timeline.map((r) => r.stage)).toEqual(['confirmed', 'preparing', 'ready-for-pickup']);
    expect(pickup.timeline.every((r) => r.done)).toBe(true);
  });
});

describe('buildRoute', () => {
  it('runs hub -> destination with cumulative distances that only grow', () => {
    const dest = geocodeAddress({ line1: 'Hardy', city: 'Karen' });
    const route = buildRoute(HUB, dest);
    expect(route.points.length).toBeGreaterThanOrEqual(20);
    expect(route.points.length).toBeLessThanOrEqual(80);
    expect(route.points[0]).toEqual({ lat: HUB.lat, lng: HUB.lng });
    expect(route.points[route.points.length - 1]).toEqual({ lat: dest.lat, lng: dest.lng });
    for (let i = 1; i < route.cumulativeKm.length; i++) {
      expect(route.cumulativeKm[i]).toBeGreaterThanOrEqual(route.cumulativeKm[i - 1]);
    }
    // A road route is longer than the crow flies, but not absurdly so.
    const direct = haversineKm(HUB, dest);
    expect(route.distanceKm).toBeGreaterThanOrEqual(direct * 0.95);
    expect(route.distanceKm).toBeLessThan(direct * 1.6);
  });
});

/* ------------------------------------------------------------------ */

describe('geocodeAddress', () => {
  /** Published centres, so a wrong table entry is caught rather than a self-fulfilling one. */
  const KNOWN = [
    ['Westlands', { line1: '12 Muthithi Road, Westlands', city: 'Nairobi' }, -1.2673, 36.8065],
    ['Nairobi CBD', { line1: 'Kimathi Street', city: 'Nairobi' }, -1.2841, 36.8233],
    ['Karen', { line1: '5 Bogani Road', city: 'Karen' }, -1.3190, 36.7080],
    ['Kilimani', { line1: 'Rose Avenue', city: 'Kilimani' }, -1.2900, 36.7850],
    ['Lavington', { line1: 'Muthangari Drive', city: 'Lavington' }, -1.2795, 36.7660],
    ['Embakasi', { line1: 'Pipeline', city: 'Nairobi' }, -1.3210, 36.8940],
  ];

  it.each(KNOWN)('puts %s within a couple of km of its real centre', (area, address, lat, lng) => {
    const got = geocodeAddress(address);
    expect(got.area).toBe(area);
    expect(got.confidence).toBe('area');
    expect(got.inZone).toBe(true);
    expect(haversineKm(got, { lat, lng })).toBeLessThan(2);
  });

  it('resolves aliases people actually type', () => {
    expect(geocodeAddress({ line1: 'Yaya Centre', city: 'Nairobi' }).area).toBe('Kilimani');
    expect(geocodeAddress({ line1: 'Sarit Centre', city: 'Nairobi' }).area).toBe('Westlands');
    expect(geocodeAddress({ line1: 'Village Market', city: 'Nairobi' }).area).toBe('Gigiri');
    expect(geocodeAddress({ line1: 'Taj Mall', city: 'Nairobi' }).area).toBe('Imara Daima');
    expect(geocodeAddress({ line1: 'off Ngong Rd', city: 'Nairobi' }).area).toBe('Adams Arcade');
  });

  it('is case- and punctuation-insensitive', () => {
    const a = geocodeAddress({ line1: 'KAREN', city: 'NAIROBI' });
    const b = geocodeAddress({ line1: 'karen.', city: 'nairobi' });
    expect(a.area).toBe('Karen');
    expect(b.area).toBe('Karen');
  });

  it('flags an out-of-town city as out of zone', () => {
    const mombasa = geocodeAddress({ line1: 'Nyali Bridge', city: 'Mombasa' });
    expect(mombasa.area).toBe('Mombasa');
    expect(mombasa.confidence).toBe('city');
    expect(mombasa.inZone).toBe(false);
    expect(haversineKm(mombasa, { lat: -4.0435, lng: 39.6682 })).toBeLessThan(3);
    for (const city of ['Kisumu', 'Nakuru', 'Eldoret']) {
      expect(geocodeAddress({ city }).inZone).toBe(false);
    }
  });

  it('falls back to a default pin with finite coordinates for an unrecognisable address', () => {
    const got = geocodeAddress({ line1: 'Plot 7, behind the big tree', city: 'Wakanda' });
    expect(got.confidence).toBe('default');
    expect(Number.isFinite(got.lat)).toBe(true);
    expect(Number.isFinite(got.lng)).toBe(true);
    // Still somewhere in Nairobi, so the map does not jump to the middle of the ocean.
    expect(haversineKm(got, HUB)).toBeLessThan(25);
  });

  it('never throws on junk input', () => {
    const junk = [
      null, undefined, 0, 42, 'Kilimani', [], true, NaN,
      {}, { line1: null, city: undefined }, { line1: 12345, city: 678 },
      { line1: 'x'.repeat(20_000) }, { line1: '🚴🏽‍♀️ 😀', city: '😀' },
      { line1: '(((', city: '[a-z]+' }, { line1: '../../etc/passwd' },
      { line1: { nested: true }, city: ['array'] },
    ];
    for (const input of junk) {
      let got;
      expect(() => { got = geocodeAddress(input); }, `geocodeAddress(${JSON.stringify(input)}) threw`).not.toThrow();
      expect(Number.isFinite(got.lat), `lat for ${JSON.stringify(input)}`).toBe(true);
      expect(Number.isFinite(got.lng), `lng for ${JSON.stringify(input)}`).toBe(true);
      expect(['area', 'city', 'default']).toContain(got.confidence);
    }
  });

  it('keeps every table entry inside a plausible Nairobi bounding box', () => {
    for (const area of NAIROBI_AREAS) {
      expect(area.lat, area.name).toBeGreaterThan(-1.5);
      expect(area.lat, area.name).toBeLessThan(-1.0);
      expect(area.lng, area.name).toBeGreaterThan(36.5);
      expect(area.lng, area.name).toBeLessThan(37.2);
    }
  });
});

describe('trackOrder robustness', () => {
  const broken = {
    'a missing address': makeOrder({ address: undefined }),
    'a null address': makeOrder({ address: null }),
    'an empty address': makeOrder({ address: {} }),
    'a bad createdAt': makeOrder({ createdAt: 'not-a-date' }),
    'a missing createdAt': makeOrder({ createdAt: undefined }),
    'a numeric createdAt': makeOrder({ createdAt: 0 }),
    'an unknown shippingMethod': makeOrder({ shippingMethod: 'teleport' }),
    'a missing shippingMethod': makeOrder({ shippingMethod: undefined }),
    'a missing id': makeOrder({ id: undefined }),
    'junk items': makeOrder({ items: 'a lot' }),
    'an out-of-zone address': makeOrder({ address: { line1: 'Nyali', city: 'Mombasa' } }),
    'nothing at all': {},
  };

  it.each(Object.entries(broken))('survives %s and still returns a usable shape', (_label, order) => {
    for (const when of [at(0), at(10), at(500), 'not-a-date', undefined]) {
      let t;
      expect(() => { t = trackOrder(order, when); }).not.toThrow();
      expect(STAGES).toContain(t.stage);
      expect(t.stageLabel).toBeTruthy();
      expect(Number.isFinite(t.position.lat)).toBe(true);
      expect(Number.isFinite(t.position.lng)).toBe(true);
      expect(Number.isFinite(t.progress)).toBe(true);
      expect(t.progress).toBeGreaterThanOrEqual(0);
      expect(t.progress).toBeLessThanOrEqual(1);
      expect(Number.isFinite(t.distanceKm)).toBe(true);
      expect(Number.isFinite(t.remainingKm)).toBe(true);
      expect(t.bearing).toBeGreaterThanOrEqual(0);
      expect(t.bearing).toBeLessThan(360);
      expect(Array.isArray(t.route)).toBe(true);
      expect(Array.isArray(t.timeline)).toBe(true);
      expect(new Date(t.etaAt).toISOString()).toBe(t.etaAt);
      expect(new Date(t.updatedAt).toISOString()).toBe(t.updatedAt);
      expect(typeof t.live).toBe('boolean');
      expect(() => JSON.stringify(t)).not.toThrow();
    }
  });

  it('survives no order at all, because a route handler can always hand it a null', () => {
    for (const order of [null, undefined]) {
      expect(() => trackOrder(order, at(0)), `trackOrder(${order}) threw`).not.toThrow();
    }
  });

  it('falls back to standard for an unknown shipping method', () => {
    expect(trackOrder(makeOrder({ shippingMethod: 'teleport' }), at(0)).shippingMethod).toBe('standard');
    expect(trackOrder(makeOrder({ shippingMethod: undefined }), at(0)).shippingMethod).toBe('standard');
  });

  it('reports a null orderId rather than inventing one', () => {
    expect(trackOrder(makeOrder({ id: undefined }), at(0)).orderId).toBeNull();
  });
});
