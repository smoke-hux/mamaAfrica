/**
 * Live order tracking.
 *
 * `trackOrder(order, now)` is a PURE function: same order + same instant => same rider position,
 * on every server instance. That matters because Vercel runs many instances and `/tmp` is per
 * instance, so there is nowhere to keep a moving courier. Instead the rider's position is derived
 * from how long ago the order was placed, along a route derived from the delivery address. No
 * timers, no background jobs, no shared state, and the customer's map and the dispatch board
 * always agree.
 *
 * Swapping in real riders later means replacing position/stage with GPS pings and keeping the
 * same shape; the client never learns where the numbers came from.
 */
import { HUB, geocodeAddress, haversineKm, bearingDeg, hashString } from './geocode.js';

export const STAGES = Object.freeze([
  'scheduled', 'confirmed', 'preparing', 'rider-assigned', 'picked-up', 'on-the-way', 'nearby', 'delivered', 'ready-for-pickup',
]);

const STAGE_LABELS = Object.freeze({
  scheduled: 'Scheduled for tomorrow',
  confirmed: 'Order confirmed',
  preparing: 'Packing your order',
  'rider-assigned': 'Rider assigned',
  'picked-up': 'Picked up from Westlands',
  'on-the-way': 'On the way to you',
  nearby: 'Arriving now',
  delivered: 'Delivered',
  'ready-for-pickup': 'Ready for collection',
});

/** Minutes spent packing before a rider leaves. */
const PREP_MINUTES = { express: 8, standard: 12, pickup: 10 };
/** Nairobi traffic. A boda averages well under the speed limit. */
const SPEED_KMH = 20;
const MIN_TRAVEL_MINUTES = 6;

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

/**
 * Major junctions. Bending a route through one or two of these makes it follow roughly the roads
 * people actually use instead of cutting a straight line across Nairobi National Park.
 */
const JUNCTIONS = Object.freeze([
  { name: 'Westlands roundabout', lat: -1.2665, lng: 36.8110 },
  { name: 'Museum Hill', lat: -1.2740, lng: 36.8170 },
  { name: 'University Way', lat: -1.2790, lng: 36.8180 },
  { name: 'Globe roundabout', lat: -1.2770, lng: 36.8280 },
  { name: 'Haile Selassie', lat: -1.2900, lng: 36.8270 },
  { name: 'Nyayo Stadium', lat: -1.3050, lng: 36.8290 },
  { name: 'Kenyatta Hospital', lat: -1.3010, lng: 36.8030 },
  { name: 'Yaya Centre', lat: -1.2930, lng: 36.7860 },
  { name: 'James Gichuru', lat: -1.2670, lng: 36.7770 },
  { name: 'Kangemi flyover', lat: -1.2660, lng: 36.7430 },
  { name: 'Muthaiga roundabout', lat: -1.2560, lng: 36.8330 },
  { name: 'Pangani', lat: -1.2700, lng: 36.8380 },
  { name: 'Allsops', lat: -1.2510, lng: 36.8680 },
  { name: 'Roysambu', lat: -1.2190, lng: 36.8880 },
  { name: 'Donholm', lat: -1.2950, lng: 36.8850 },
  { name: 'Cabanas', lat: -1.3300, lng: 36.8600 },
  { name: 'Bomas', lat: -1.3350, lng: 36.7530 },
  { name: 'Karen roundabout', lat: -1.3190, lng: 36.7080 },
]);

/** Pick the junctions that sit roughly on the way, cheapest detour first. */
function chooseJunctions(from, to) {
  const direct = haversineKm(from, to);
  if (direct < 1.5) return [];
  const scored = JUNCTIONS
    .map((j) => ({ j, detour: haversineKm(from, j) + haversineKm(j, to) - direct }))
    .filter(({ j, detour }) => detour < direct * 0.35 && haversineKm(from, j) > 0.4 && haversineKm(j, to) > 0.4)
    .sort((a, b) => a.detour - b.detour)
    .slice(0, 2)
    .map(({ j }) => j);

  // Put them in travel order: project each onto the straight line and sort along it.
  return scored.sort((a, b) => projection(from, to, a) - projection(from, to, b));
}

function projection(from, to, p) {
  const vx = to.lng - from.lng;
  const vy = to.lat - from.lat;
  const len2 = vx * vx + vy * vy || 1;
  return ((p.lng - from.lng) * vx + (p.lat - from.lat) * vy) / len2;
}

/** Catmull-Rom through the control points, so the path curves like a road instead of a dogleg. */
function spline(points, samplesPerSegment = 12) {
  if (points.length < 2) return points.slice();
  const pts = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        lat: round6(0.5 * ((2 * p1.lat) + (-p0.lat + p2.lat) * t + (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 + (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3)),
        lng: round6(0.5 * ((2 * p1.lng) + (-p0.lng + p2.lng) * t + (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2 + (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3)),
      });
    }
  }
  out.push({ lat: round6(points[points.length - 1].lat), lng: round6(points[points.length - 1].lng) });
  return out;
}

/**
 * Build the route the rider takes from the hub to a destination.
 * @returns {{points: Array<{lat:number,lng:number}>, cumulativeKm: number[], distanceKm: number}}
 */
export function buildRoute(from, to) {
  const control = [from, ...chooseJunctions(from, to), to];
  const points = spline(control);
  const cumulativeKm = [0];
  for (let i = 1; i < points.length; i++) {
    cumulativeKm.push(cumulativeKm[i - 1] + haversineKm(points[i - 1], points[i]));
  }
  return { points, cumulativeKm, distanceKm: cumulativeKm[cumulativeKm.length - 1] };
}

/** Where along the route the rider is after `traveledKm`, plus the direction they are facing. */
function pointAt(route, traveledKm) {
  const { points, cumulativeKm, distanceKm } = route;
  const d = Math.max(0, Math.min(distanceKm, traveledKm));
  let i = 1;
  while (i < cumulativeKm.length - 1 && cumulativeKm[i] < d) i++;
  const segStart = cumulativeKm[i - 1];
  const segLen = cumulativeKm[i] - segStart || 1;
  const t = Math.max(0, Math.min(1, (d - segStart) / segLen));
  const a = points[i - 1];
  const b = points[i];
  return {
    position: { lat: round6(a.lat + (b.lat - a.lat) * t), lng: round6(a.lng + (b.lng - a.lng) * t) },
    bearing: Math.round(bearingDeg(a, b) * 10) / 10,
  };
}

/* ------------------------------------------------------------------ */
/* Rider                                                               */
/* ------------------------------------------------------------------ */

const RIDER_NAMES = ['Otieno M.', 'Wanjiru K.', 'Kipchoge R.', 'Njeri W.', 'Mwangi G.', 'Achieng O.', 'Kamau N.', 'Wafula S.', 'Chebet J.', 'Omondi B.', 'Mutiso D.', 'Nyambura P.', 'Kiprono E.', 'Atieno L.', 'Barasa T.', 'Wambui A.'];
const PLATE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** The same order always gets the same rider, without storing one. */
function riderFor(orderId, itemCount) {
  const h = hashString(`rider:${orderId}`);
  const plate = `K${PLATE_LETTERS[h % 24]}${PLATE_LETTERS[(h >>> 5) % 24]}${PLATE_LETTERS[(h >>> 10) % 24]} ${String((h >>> 15) % 900 + 100)}${PLATE_LETTERS[(h >>> 24) % 24]}`;
  const digits = String((h >>> 3) % 900 + 100);
  return {
    name: RIDER_NAMES[h % RIDER_NAMES.length],
    vehicle: itemCount > 12 ? 'Van' : h % 7 === 0 ? 'Tuk-tuk' : 'Boda',
    plate,
    // Masked: enough to recognise the rider who calls, not enough to be a phone number we leaked.
    phone: `+254 7•• ••• ${digits}`,
    rating: Math.round((4.5 + ((h >>> 8) % 50) / 100) * 10) / 10,
  };
}

/* ------------------------------------------------------------------ */
/* Schedule                                                            */
/* ------------------------------------------------------------------ */

/** Standard orders go out in tomorrow's 10:00-13:00 window (EAT = UTC+3). */
function standardDispatchAt(order) {
  const base = new Date(order?.estimatedDelivery || order?.createdAt);
  const day = Number.isNaN(base.getTime()) ? new Date(order?.createdAt) : base;
  const at = new Date(day);
  at.setUTCHours(7, 0, 0, 0); // 10:00 EAT
  return at;
}

function dispatchAtFor(order, createdAt) {
  if (order?.shippingMethod === 'standard') {
    const at = standardDispatchAt(order);
    return Number.isNaN(at.getTime()) ? createdAt : at.getTime() > createdAt.getTime() ? at : new Date(createdAt.getTime() + 60 * 60 * 1000);
  }
  return createdAt;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

/**
 * @param {object} order a stored order (see server/routes/orders.js)
 * @param {Date|string|number} [now]
 * @returns {object} Tracking (see the contract in the README / docs)
 */
export function trackOrder(order, now = new Date()) {
  const at = toDate(now) || new Date();
  const createdAt = toDate(order?.createdAt) || at;
  const method = ['standard', 'express', 'pickup'].includes(order?.shippingMethod) ? order.shippingMethod : 'standard';
  const itemCount = Array.isArray(order?.items) ? order.items.reduce((n, i) => n + (Number(i.qty) || 0), 0) : 0;

  const dest = method === 'pickup'
    ? { lat: HUB.lat, lng: HUB.lng, area: HUB.area, confidence: 'area', inZone: true }
    : geocodeAddress(order?.address || {});

  const route = method === 'pickup' ? { points: [{ lat: HUB.lat, lng: HUB.lng }], cumulativeKm: [0], distanceKm: 0 } : buildRoute(HUB, dest);

  const prepMinutes = PREP_MINUTES[method];
  const travelMinutes = method === 'pickup' ? 0 : Math.max(MIN_TRAVEL_MINUTES, (route.distanceKm / SPEED_KMH) * 60);
  const dispatchAt = dispatchAtFor(order, createdAt);
  const pickupAt = new Date(dispatchAt.getTime() + prepMinutes * 60000);
  const etaAt = new Date(pickupAt.getTime() + travelMinutes * 60000);

  const elapsedMs = at.getTime() - dispatchAt.getTime();
  const prepMs = prepMinutes * 60000;
  const travelMs = travelMinutes * 60000;

  let stage;
  let progress = 0;
  let live = true;

  if (elapsedMs < 0) {
    // Placed, but the delivery window has not opened yet.
    stage = method === 'standard' ? 'scheduled' : 'confirmed';
    live = false;
  } else if (elapsedMs < prepMs) {
    const p = elapsedMs / prepMs;
    stage = p < 0.35 ? 'confirmed' : p < 0.75 ? 'preparing' : 'rider-assigned';
  } else if (method === 'pickup') {
    stage = 'ready-for-pickup';
    live = false;
  } else {
    progress = Math.max(0, Math.min(1, (elapsedMs - prepMs) / (travelMs || 1)));
    if (progress >= 1) { stage = 'delivered'; live = false; }
    else if (progress < 0.06) stage = 'picked-up';
    else if (progress < 0.85) stage = 'on-the-way';
    else stage = 'nearby';
  }

  const traveledKm = route.distanceKm * progress;
  const here = stage === 'delivered'
    ? { position: { lat: dest.lat, lng: dest.lng }, bearing: 0 }
    : progress > 0
      ? pointAt(route, traveledKm)
      : { position: { lat: HUB.lat, lng: HUB.lng }, bearing: route.points[1] ? bearingDeg(route.points[0], route.points[1]) : 0 };

  const minutesRemaining = stage === 'delivered' || stage === 'ready-for-pickup'
    ? 0
    : Math.max(0, Math.ceil((etaAt.getTime() - at.getTime()) / 60000));

  return {
    orderId: order?.id || null,
    stage,
    stageLabel: STAGE_LABELS[stage],
    live,
    shippingMethod: method,
    progress: Math.round(progress * 1000) / 1000,
    position: here.position,
    bearing: Math.round((((here.bearing % 360) + 360) % 360) * 10) / 10 % 360,
    origin: { lat: HUB.lat, lng: HUB.lng, name: HUB.name, area: HUB.area },
    destination: { lat: dest.lat, lng: dest.lng, area: dest.area, precise: dest.confidence === 'area', inZone: dest.inZone },
    route: route.points,
    distanceKm: Math.round(route.distanceKm * 100) / 100,
    remainingKm: Math.round(Math.max(0, route.distanceKm - traveledKm) * 100) / 100,
    dispatchAt: dispatchAt.toISOString(),
    etaAt: etaAt.toISOString(),
    minutesRemaining,
    deliveredAt: stage === 'delivered' ? etaAt.toISOString() : null,
    rider: method === 'pickup' ? null : riderFor(order?.id || 'unknown', itemCount),
    timeline: buildTimeline({ method, stage, createdAt, dispatchAt, pickupAt, etaAt }),
    updatedAt: at.toISOString(),
    // How soon the client should ask again: often while moving, rarely while waiting, never when done.
    pollAfterMs: live ? (stage === 'nearby' ? 4000 : 6000) : stage === 'scheduled' ? 120000 : 0,
  };
}

function buildTimeline({ method, stage, createdAt, dispatchAt, pickupAt, etaAt }) {
  const reached = STAGE_ORDER[stage] ?? 0;
  const rows = method === 'pickup'
    ? [
      ['confirmed', 'Order confirmed', createdAt],
      ['preparing', 'Packing your order', dispatchAt],
      ['ready-for-pickup', 'Ready for collection in Westlands', pickupAt],
    ]
    : [
      ['confirmed', 'Order confirmed', createdAt],
      ['preparing', 'Packing your order', dispatchAt],
      ['picked-up', 'Rider picked it up', pickupAt],
      ['on-the-way', 'On the way to you', new Date(pickupAt.getTime() + (etaAt - pickupAt) * 0.1)],
      ['delivered', 'Delivered', etaAt],
    ];
  return rows.map(([key, label, when]) => ({
    stage: key,
    label,
    at: new Date(when).toISOString(),
    done: (STAGE_ORDER[key] ?? 0) <= reached,
  }));
}

const STAGE_ORDER = Object.freeze({
  // `scheduled` ranks level with `confirmed`: the order IS confirmed, it just has not been dispatched yet.
  scheduled: 1, confirmed: 1, preparing: 2, 'rider-assigned': 3, 'picked-up': 4,
  'on-the-way': 5, nearby: 6, 'ready-for-pickup': 7, delivered: 8,
});

/** Is this order still worth showing on the dispatch board? */
export function isActive(tracking) {
  return tracking.stage !== 'delivered';
}

function toDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (v == null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;
