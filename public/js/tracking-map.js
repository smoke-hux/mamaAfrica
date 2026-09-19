/**
 * Shared live-tracking map.
 *
 *   createTrackingMap(el, opts) -> handle
 *
 * Two interchangeable backends behind one API, so callers never branch:
 *   • 'google'   — Maps JS API v3 (loading=async, libraries=marker,geometry), warm brand styling,
 *                  AdvancedMarkerElement when a Map ID is configured, classic Marker otherwise.
 *   • 'fallback' — a hand-drawn inline SVG map of Nairobi (equirectangular projection of the very
 *                  same coordinates) used when no key is configured or the API fails to load.
 *                  Deliberately stylised, and labelled "Simplified map" so nobody thinks Google
 *                  Maps broke silently.
 *
 * Nothing here ever throws into the caller: a missing container, a blocked key, a quota error or a
 * script failure all end up on the fallback. Every method is safe to call before the map is ready —
 * the last value is queued and applied on ready.
 *
 * Styling lives in /css/tracking.css and uses the base.css glass tokens.
 */

import { escapeHtml } from '/js/format.js';
import { loadGoogleMaps } from '/js/maps-loader.js';

/* --------------------------------------------------------------------------
   Brand constants
   -------------------------------------------------------------------------- */
const CLAY = '#C8552F';
const CREAM = '#FFF9EF';
const SAFFRON = '#F2A93B';
const COCOA = '#2A1A11';

/** server/lib/geocode.js HUB — the dispatch board always shows it, even with nothing selected. */
const HUB_DEFAULT = Object.freeze({ lat: -1.2673, lng: 36.8065, name: 'Mama Afrika Market, Westlands' });

const DEFAULT_ANIM_MS = 1200;
const MAX_ANIM_MS = 4000;
/** Beyond this jump (~2.2 km) we teleport instead of sliding across the city. */
const TELEPORT_DEG = 0.02;

let seq = 0;

/* --------------------------------------------------------------------------
   Google map styling — warm brand palette. Illegal alongside a Map ID, so it is
   only ever passed when no mapId is configured (see createGoogleBackend).
   -------------------------------------------------------------------------- */
const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#F6EBD7' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5C4436' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFF9EF' }, { weight: 2 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#DCC9A6' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#F3E5CD' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#F8EEDC' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D9E8CB' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3E6B3A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FCEFD3' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#EBD7AE' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6E5546' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#F7CB80' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F2A93B' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#D98E1C' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E6BFC9' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8E1B3A' }] },
];

/* --------------------------------------------------------------------------
   Nairobi arterial sketch for the fallback map. Approximate on purpose: this is
   a stylised road *impression* behind the route, not a survey.
   -------------------------------------------------------------------------- */
const ROADS = [
  // Waiyaki Way -> Uhuru Highway -> Mombasa Road spine
  { w: 2.4, pts: [[-1.2648, 36.7395], [-1.2660, 36.7690], [-1.2662, 36.8005], [-1.2708, 36.8118], [-1.2792, 36.8180], [-1.2900, 36.8218], [-1.3085, 36.8285], [-1.3320, 36.8560]] },
  // Thika Superhighway
  { w: 2.2, pts: [[-1.2798, 36.8296], [-1.2618, 36.8402], [-1.2400, 36.8555], [-1.2160, 36.8830]] },
  // Ngong Road
  { w: 1.9, pts: [[-1.2895, 36.8205], [-1.2930, 36.8040], [-1.2968, 36.7890], [-1.3040, 36.7620], [-1.3120, 36.7380]] },
  // Langata Road
  { w: 1.8, pts: [[-1.3080, 36.8215], [-1.3190, 36.8010], [-1.3288, 36.7860], [-1.3420, 36.7640]] },
  // Argwings Kodhek Road (Westlands -> Kilimani)
  { w: 1.6, pts: [[-1.2742, 36.8090], [-1.2820, 36.8020], [-1.2896, 36.7912], [-1.2968, 36.7808], [-1.3010, 36.7720]] },
  // Limuru Road
  { w: 1.6, pts: [[-1.2662, 36.8082], [-1.2520, 36.8030], [-1.2340, 36.7965], [-1.2170, 36.7890]] },
  // Riverside Drive
  { w: 1.4, pts: [[-1.2688, 36.8038], [-1.2760, 36.7960], [-1.2836, 36.7902], [-1.2898, 36.7876]] },
  // James Gichuru / Gitanga
  { w: 1.4, pts: [[-1.2636, 36.7768], [-1.2790, 36.7742], [-1.2926, 36.7706], [-1.3036, 36.7688]] },
  // Ring Road Kilimani
  { w: 1.3, pts: [[-1.2862, 36.7846], [-1.2918, 36.7882], [-1.2952, 36.7960], [-1.2938, 36.8046]] },
  // Lenana Road
  { w: 1.3, pts: [[-1.2906, 36.8004], [-1.2962, 36.7930], [-1.3008, 36.7866]] },
  // Valley Road
  { w: 1.5, pts: [[-1.2884, 36.8168], [-1.2918, 36.8062], [-1.2934, 36.7982]] },
  // Jogoo Road east
  { w: 1.5, pts: [[-1.2890, 36.8340], [-1.2948, 36.8560], [-1.3010, 36.8790]] },
  // Kileleshwa loop
  { w: 1.2, pts: [[-1.2770, 36.7852], [-1.2828, 36.7796], [-1.2900, 36.7790], [-1.2946, 36.7842]] },
  // Parklands / Ojijo
  { w: 1.2, pts: [[-1.2648, 36.8140], [-1.2596, 36.8256], [-1.2612, 36.8380]] },
];

const PARKS = [
  // Uhuru / Central Park
  [[-1.2862, 36.8140], [-1.2862, 36.8206], [-1.2938, 36.8212], [-1.2944, 36.8138]],
  // Nairobi Arboretum
  [[-1.2716, 36.8010], [-1.2708, 36.8082], [-1.2782, 36.8090], [-1.2790, 36.8016]],
  // City Park
  [[-1.2500, 36.8270], [-1.2482, 36.8368], [-1.2576, 36.8382], [-1.2588, 36.8286]],
  // Nairobi National Park shoulder
  [[-1.3230, 36.8180], [-1.3210, 36.8560], [-1.3560, 36.8600], [-1.3600, 36.8180]],
];

const WATER = [
  // Nairobi Dam
  [[-1.3096, 36.7986], [-1.3068, 36.8078], [-1.3132, 36.8110], [-1.3152, 36.8020]],
];

/* --------------------------------------------------------------------------
   Small helpers
   -------------------------------------------------------------------------- */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function lerp(a, b, t) { return a + (b - a) * t; }

/** Interpolate degrees along the short way round. */
function lerpAngle(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

function isLatLng(p) {
  return Boolean(p) && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
}

function toLatLng(p) {
  return { lat: Number(p.lat), lng: Number(p.lng) };
}

function cleanRoute(route) {
  return Array.isArray(route) ? route.filter(isLatLng).map(toLatLng) : [];
}

/** ~1 cm — anything closer is the same place as far as a map is concerned. */
const SAME_POINT_EPS = 1e-7;
function samePoint(a, b) {
  return Math.abs(a.lat - b.lat) < SAME_POINT_EPS && Math.abs(a.lng - b.lng) < SAME_POINT_EPS;
}

/**
 * The drawable journey for a Tracking: at least two DISTINCT points, else `[]`.
 * A pickup order has no journey — `trackOrder()` gives it a single-point route and a
 * destination equal to the origin — so callers must draw the hub alone, with no route
 * line and no rider, instead of choking on a degenerate path.
 */
function journeyPath(t) {
  if (!t) return [];
  const raw = (t.route && t.route.length >= 2) ? t.route : [t.origin, t.destination].filter(Boolean);
  const out = [];
  raw.forEach((p) => { if (!out.length || !samePoint(out[out.length - 1], p)) out.push(p); });
  if (out.length < 2) return [];
  // Every point identical (a route that never leaves the hub) is still no journey.
  return out.some((p) => !samePoint(p, out[0])) ? out : [];
}

function formatKm(km) {
  const n = num(km, 0);
  if (n < 1) return `${Math.round(n * 1000)} m`;
  return `${n.toFixed(1)} km`;
}

function formatMinutes(min) {
  const n = Math.max(0, Math.round(num(min, 0)));
  if (n === 0) return 'less than a minute';
  return `${n} minute${n === 1 ? '' : 's'}`;
}

/** The screen-reader sentence, e.g. "On the way to you. Rider is 3.7 km away, about 14 minutes." */
function summaryText(t, mode) {
  if (!t) return mode === 'dispatch' ? 'No active orders on the map yet.' : 'Waiting for tracking information.';
  const parts = [];
  const inZone = !(t.destination && t.destination.inZone === false);
  if (t.stageLabel) parts.push(`${String(t.stageLabel).replace(/\.$/, '')}.`);
  if (!inZone) {
    const where = t.destination && t.destination.area;
    if (where) parts.push(`Delivering to ${where}.`);
    return parts.join(' ');
  }
  if (t.stage === 'delivered') {
    parts.push('Your order has been delivered.');
  } else if (t.live && Number.isFinite(Number(t.remainingKm))) {
    const km = formatKm(t.remainingKm);
    parts.push(Number.isFinite(Number(t.minutesRemaining))
      ? `Rider is ${km} away, about ${formatMinutes(t.minutesRemaining)}.`
      : `Rider is ${km} away.`);
  } else if (Number.isFinite(Number(t.minutesRemaining))) {
    parts.push(`Estimated arrival in about ${formatMinutes(t.minutesRemaining)}.`);
  }
  const area = t.destination && (t.destination.area || t.destination.name);
  if (area) parts.push(`Delivering to ${area}.`);
  return parts.join(' ');
}

function ordersSummary(list) {
  const n = Array.isArray(list) ? list.length : 0;
  if (!n) return 'No active orders on the map.';
  return `${n} active order${n === 1 ? '' : 's'} on the map.`;
}

/* --------------------------------------------------------------------------
   Rider animator — shared by both backends.
   A "pose" is { lat, lng, bearing, progress }. Linear position interpolation keeps
   the speed constant (Uber-style); the bearing eases the short way round.
   -------------------------------------------------------------------------- */
function createAnimator(apply, isReduced) {
  let current = null;
  let from = null;
  let to = null;
  let start = 0;
  let duration = 0;
  let raf = 0;

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    from = null; to = null;
  }

  function jump(pose) {
    stop();
    current = pose;
    apply(pose);
  }

  function frame() {
    raf = 0;
    if (!to) return;
    const t = duration > 0 ? clamp((nowMs() - start) / duration, 0, 1) : 1;
    current = {
      lat: lerp(from.lat, to.lat, t),
      lng: lerp(from.lng, to.lng, t),
      bearing: lerpAngle(from.bearing, to.bearing, t),
      progress: lerp(from.progress, to.progress, t),
    };
    apply(current);
    if (t < 1) raf = requestAnimationFrame(frame);
    else { from = null; to = null; }
  }

  return {
    get current() { return current; },
    /** Move to `pose`, sliding there over `ms` unless motion is reduced or the jump is huge. */
    to(pose, ms) {
      if (!pose) return;
      const far = current
        && (Math.abs(pose.lat - current.lat) > TELEPORT_DEG || Math.abs(pose.lng - current.lng) > TELEPORT_DEG);
      if (!current || far || isReduced() || !(ms > 0) || typeof requestAnimationFrame !== 'function') {
        jump(pose);
        return;
      }
      from = current;
      to = pose;
      start = nowMs();
      duration = ms;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    jump,
    destroy: stop,
  };
}

/* --------------------------------------------------------------------------
   Shell DOM
   -------------------------------------------------------------------------- */
const LEGEND_HTML = `
  <li class="tmap__legend-item"><span class="tmap__swatch tmap__swatch--hub"></span>Market hub</li>
  <li class="tmap__legend-item"><span class="tmap__swatch tmap__swatch--route"></span>Route</li>
  <li class="tmap__legend-item"><span class="tmap__swatch tmap__swatch--rider"></span>Rider</li>
  <li class="tmap__legend-item"><span class="tmap__swatch tmap__swatch--dest"></span>You</li>
`;

const LEGEND_HTML_DISPATCH = `
  <li class="tmap__legend-item"><span class="tmap__swatch tmap__swatch--hub"></span>Market hub</li>
  <li class="tmap__legend-item"><span class="tmap__swatch tmap__swatch--rider"></span>Active order</li>
`;

function buildShell(el, mode, label, announce) {
  el.classList.add('tmap', 'tmap--loading', mode === 'dispatch' ? 'tmap--dispatch' : 'tmap--customer');
  el.dataset.backend = 'pending';
  el.innerHTML = `
    <div class="tmap__canvas" data-tmap="canvas"></div>
    <div class="tmap__pins" data-tmap="pins" hidden></div>
    <div class="tmap__overlay">
      <div class="tmap__top">
        <div class="tmap__stage" data-tmap="stage" hidden>
          <span class="tmap__stage-dot" aria-hidden="true"></span>
          <span class="tmap__stage-label" data-tmap="stage-label"></span>
          <span class="tmap__stage-meta" data-tmap="stage-meta"></span>
        </div>
        <p class="tmap__badge" data-tmap="badge" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          Simplified map
        </p>
      </div>
      <ul class="tmap__legend" data-tmap="legend" hidden>${mode === 'dispatch' ? LEGEND_HTML_DISPATCH : LEGEND_HTML}</ul>
    </div>
    <div class="tmap__skeleton" data-tmap="skeleton">
      <span class="tmap__skeleton-shimmer" aria-hidden="true"></span>
      <span class="tmap__skeleton-label">${mode === 'dispatch' ? 'Loading the delivery map…' : 'Finding the rider…'}</span>
    </div>
    <div class="tmap__error" data-tmap="error" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      <p class="tmap__error-text" data-tmap="error-text">The map could not be drawn. Your order is still on its way.</p>
    </div>
    ${announce ? '<p class="visually-hidden" data-tmap="live" role="status" aria-live="polite"></p>' : ''}
  `;
  const q = (name) => el.querySelector(`[data-tmap="${name}"]`);
  const canvas = q('canvas');
  canvas.setAttribute('aria-label', label);
  return {
    canvas,
    pins: q('pins'),
    stage: q('stage'),
    stageLabel: q('stage-label'),
    stageMeta: q('stage-meta'),
    badge: q('badge'),
    legend: q('legend'),
    skeleton: q('skeleton'),
    error: q('error'),
    errorText: q('error-text'),
    // Absent unless opts.announce is true: both consumer pages render their own summary,
    // and two live regions make a screen reader announce every update twice.
    live: q('live'),
  };
}

/* --------------------------------------------------------------------------
   Public factory
   -------------------------------------------------------------------------- */

/**
 * @param {HTMLElement} el container; gets the `.tmap` class and its own inner DOM
 * @param {{mode?:'customer'|'dispatch', onReady?:Function, onSelect?:Function,
 *          announce?:boolean, reducedMotion?:boolean, forceFallback?:boolean,
 *          animationMs?:number, label?:string, zoom?:number, pointZoom?:number,
 *          hub?:{lat:number,lng:number,name?:string}}} [opts]
 *   announce — opt in to the component's own visually-hidden aria-live summary.
 *              OFF by default: both consumer pages already render one, and two live
 *              regions make a screen reader read every update twice.
 * @returns {object} handle
 */
export function createTrackingMap(el, opts = {}) {
  const options = opts || {};
  const mode = options.mode === 'dispatch' ? 'dispatch' : 'customer';

  if (!el || typeof el !== 'object' || el.nodeType !== 1) {
    return inertHandle(mode, options);
  }

  const id = ++seq;
  const label = options.label
    || (mode === 'dispatch'
      ? 'Map of active deliveries around Nairobi'
      : 'Map of your delivery: the market hub, the route and the rider’s live position');

  let dom;
  try {
    dom = buildShell(el, mode, label, options.announce === true);
  } catch {
    return inertHandle(mode, options);
  }

  const state = {
    id,
    mode,
    backend: 'fallback',
    impl: null,
    destroyed: false,
    ready: false,
    tracking: null,
    orders: null,
    gotData: false,
    selectedId: null,
    wantFit: false,
  };

  /* prefers-reduced-motion, live-tracked unless the caller pins it. */
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let mqReduced = mq ? mq.matches : false;
  const onMq = (e) => { mqReduced = e.matches; };
  if (mq && typeof mq.addEventListener === 'function') mq.addEventListener('change', onMq);
  const isReduced = () => (typeof options.reducedMotion === 'boolean' ? options.reducedMotion : mqReduced);

  const animMs = () => {
    if (Number.isFinite(Number(options.animationMs))) return Math.max(0, Number(options.animationMs));
    const poll = Number(state.tracking && state.tracking.pollAfterMs);
    if (Number.isFinite(poll) && poll > 0) return clamp(poll, 300, MAX_ANIM_MS);
    return DEFAULT_ANIM_MS;
  };

  const hub = isLatLng(options.hub)
    ? { ...toLatLng(options.hub), name: options.hub.name || HUB_DEFAULT.name }
    : HUB_DEFAULT;

  const ctx = {
    id, mode, dom, options, isReduced, animMs, hub,
    selected: () => state.selectedId,
    onSelect: (orderId) => {
      handle.setSelected(orderId);
      if (typeof handle.onSelect === 'function') handle.onSelect(orderId);
    },
  };

  const handle = {
    mode,
    onSelect: typeof options.onSelect === 'function' ? options.onSelect : null,
    get backend() { return state.backend; },
    get isReady() { return state.ready; },
    /** `null` clears the route, destination and rider (the dispatch hub always stays). */
    setTracking(tracking) {
      if (state.destroyed) return;
      const t = normaliseTracking(tracking);
      state.tracking = t;
      state.gotData = true;
      if (t && t.orderId) state.selectedId = t.orderId;
      else if (!t) state.selectedId = null;
      paintChrome(t);
      // Always forwarded, including null — the backend needs the clear.
      if (state.impl) safely(() => state.impl.setTracking(t));
    },
    setOrders(list) {
      if (state.destroyed) return;
      const orders = normaliseOrders(list);
      state.orders = orders;
      state.gotData = true;
      if (!state.tracking) setLive(ordersSummary(orders));
      // An empty list is an answer, not a pending state — but only once a map is behind it.
      if (state.ready) hideSkeleton();
      if (state.impl) safely(() => state.impl.setOrders(orders));
    },
    /** Highlight one order pin on the dispatch board (`null` clears the highlight). */
    setSelected(orderId) {
      if (state.destroyed) return;
      state.selectedId = orderId ? String(orderId) : null;
      if (state.impl && typeof state.impl.setSelected === 'function') safely(() => state.impl.setSelected(state.selectedId));
    },
    get selectedId() { return state.selectedId; },
    fit() {
      if (state.destroyed) return;
      if (state.impl) safely(() => state.impl.fit());
      else state.wantFit = true;
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      if (mq && typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onMq);
      if (state.impl) safely(() => state.impl.destroy());
      state.impl = null;
      try {
        el.innerHTML = '';
        el.classList.remove('tmap', 'tmap--loading', 'tmap--customer', 'tmap--dispatch', 'tmap--google', 'tmap--fallback', 'tmap--error');
        delete el.dataset.backend;
      } catch { /* detached node */ }
    },
  };

  /** Resolves with the handle once a backend is mounted (or immediately after a failure). */
  handle.ready = start();

  return handle;

  /* ---- internals ---- */

  function safely(fn) {
    try { return fn(); } catch { return undefined; }
  }

  function setLive(text) {
    if (dom.live) dom.live.textContent = text;
  }

  function hideSkeleton() {
    dom.skeleton.hidden = true;
    el.classList.remove('tmap--loading');
  }

  function paintChrome(t) {
    if (!t) {
      // Deselected / cleared: drop the pill, keep whatever the map still shows.
      dom.stage.hidden = true;
      dom.stageMeta.hidden = true;
      setLive(mode === 'dispatch' ? ordersSummary(state.orders) : summaryText(null, mode));
      dom.canvas.setAttribute('aria-label', label);
      return;
    }
    setLive(summaryText(t, mode));
    hideSkeleton();
    if (t.stageLabel) {
      dom.stage.hidden = false;
      dom.stageLabel.textContent = t.stageLabel;
      const meta = [];
      if (t.destination && t.destination.inZone === false) {
        // Out of the delivery zone: never print a duration or a distance, just the place.
        if (t.destination.area) meta.push(t.destination.area);
      } else {
        if (t.live && Number.isFinite(t.minutesRemaining)) meta.push(`${Math.max(0, Math.round(t.minutesRemaining))} min`);
        // A pickup order has no distance to travel — "0 m" would read as a glitch.
        if (Number.isFinite(t.remainingKm) && t.remainingKm > 0 && t.stage !== 'delivered') meta.push(formatKm(t.remainingKm));
      }
      dom.stageMeta.textContent = meta.join(' · ');
      dom.stageMeta.hidden = meta.length === 0;
      dom.stage.classList.toggle('is-live', t.live === true);
    }
    dom.canvas.setAttribute('aria-label', `${label}. ${summaryText(t, mode)}`);
  }

  async function start() {
    let impl = null;

    if (options.forceFallback !== true) {
      let maps = null;
      try { maps = await loadGoogleMaps(); } catch { maps = null; }
      if (state.destroyed) return handle;
      if (maps && maps.available && maps.google && maps.google.maps) {
        try {
          impl = createGoogleBackend(ctx, maps.google, maps.mapId || null);
        } catch {
          impl = null;
        }
      }
    }

    if (state.destroyed) return handle;

    if (!impl) {
      try {
        impl = createFallbackBackend(ctx);
      } catch {
        // Truly nothing worked — show the inert error card rather than an empty box.
        el.classList.add('tmap--error');
        el.classList.remove('tmap--loading');
        dom.error.hidden = false;
        dom.skeleton.hidden = true;
        state.ready = true;
        return handle;
      }
    }

    state.impl = impl;
    state.backend = impl.kind;
    state.ready = true;
    // A mounted backend has already drawn the city; the skeleton has nothing left to hide,
    // including on a dispatch board whose order list came back empty.
    if (state.gotData) hideSkeleton();
    el.dataset.backend = impl.kind;
    el.classList.add(impl.kind === 'google' ? 'tmap--google' : 'tmap--fallback');
    dom.badge.hidden = impl.kind !== 'fallback';
    dom.legend.hidden = false;

    // Flush whatever the caller queued before we were ready.
    if (state.tracking) safely(() => impl.setTracking(state.tracking));
    if (state.orders) safely(() => impl.setOrders(state.orders));
    if (state.selectedId && typeof impl.setSelected === 'function') safely(() => impl.setSelected(state.selectedId));
    if (state.wantFit) { state.wantFit = false; safely(() => impl.fit()); }

    if (typeof options.onReady === 'function') safely(() => options.onReady(handle));
    return handle;
  }
}

/** A handle that satisfies the API but draws nothing (missing/invalid container). */
function inertHandle(mode, options) {
  const handle = {
    mode,
    backend: 'fallback',
    isReady: false,
    onSelect: typeof options.onSelect === 'function' ? options.onSelect : null,
    selectedId: null,
    setTracking() {},
    setOrders() {},
    setSelected() {},
    fit() {},
    destroy() {},
  };
  handle.ready = Promise.resolve(handle);
  return handle;
}

/* --------------------------------------------------------------------------
   Normalisation — the component trusts nothing about its input.
   -------------------------------------------------------------------------- */
function normaliseTracking(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const route = cleanRoute(raw.route);
  const origin = isLatLng(raw.origin) ? { ...toLatLng(raw.origin), name: raw.origin.name || 'Market hub' } : null;
  const destination = isLatLng(raw.destination)
    ? {
      ...toLatLng(raw.destination),
      area: raw.destination.area || raw.destination.name || 'Your address',
      // Outside the delivery zone the server refuses to promise a time, and so do we.
      inZone: raw.destination.inZone !== false,
    }
    : null;
  const position = isLatLng(raw.position) ? toLatLng(raw.position) : (route.length ? route[0] : origin);
  return {
    orderId: raw.orderId ? String(raw.orderId) : '',
    stage: raw.stage ? String(raw.stage) : '',
    stageLabel: raw.stageLabel ? String(raw.stageLabel) : '',
    live: raw.live === true,
    progress: clamp(num(raw.progress, 0), 0, 1),
    position,
    bearing: num(raw.bearing, 0),
    origin,
    destination,
    route,
    distanceKm: Number.isFinite(Number(raw.distanceKm)) ? Number(raw.distanceKm) : null,
    remainingKm: Number.isFinite(Number(raw.remainingKm)) ? Number(raw.remainingKm) : null,
    minutesRemaining: Number.isFinite(Number(raw.minutesRemaining)) ? Number(raw.minutesRemaining) : null,
    pollAfterMs: Number.isFinite(Number(raw.pollAfterMs)) ? Number(raw.pollAfterMs) : null,
  };
}

function normaliseOrders(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((o) => o && isLatLng(o.position))
    .map((o) => ({
      id: o.id ? String(o.id) : '',
      position: toLatLng(o.position),
      stage: o.stage ? String(o.stage) : '',
      area: o.area ? String(o.area) : (o.destination && o.destination.area) ? String(o.destination.area) : '',
      customerName: o.customerName ? String(o.customerName) : '',
      minutesRemaining: Number.isFinite(Number(o.minutesRemaining)) ? Number(o.minutesRemaining) : null,
      progress: clamp(num(o.progress, 0), 0, 1),
      destination: isLatLng(o.destination) ? toLatLng(o.destination) : null,
    }));
}

function orderTitle(o) {
  const bits = [o.id || 'Order'];
  if (o.area) bits.push(o.area);
  if (Number.isFinite(o.minutesRemaining)) bits.push(`${Math.round(o.minutesRemaining)} min`);
  return bits.join(' · ');
}

/* ==========================================================================
   Backend 1 — Google Maps
   ========================================================================== */
function createGoogleBackend(ctx, g, mapId) {
  const maps = g.maps;
  const { dom, mode } = ctx;

  const useAdvanced = Boolean(mapId && maps.marker && maps.marker.AdvancedMarkerElement);

  const mapOptions = {
    center: { lat: -1.2673, lng: 36.8065 },
    zoom: Number.isFinite(Number(ctx.options.zoom)) ? Number(ctx.options.zoom) : 13,
    backgroundColor: '#F8EEDC',
    disableDefaultUI: true,
    zoomControl: true,
    keyboardShortcuts: true,      // arrow-key panning, +/- zoom
    clickableIcons: false,
    gestureHandling: 'cooperative',
  };
  // A Map ID moves styling server-side and makes a `styles` array illegal, so the two are
  // mutually exclusive — never send both.
  if (mapId) mapOptions.mapId = mapId;
  else mapOptions.styles = MAP_STYLES;

  const map = new maps.Map(dom.canvas, mapOptions);
  dom.canvas.setAttribute('role', 'application');

  let casing = null;
  let line = null;
  let hubMarker = null;
  let destMarker = null;
  let rider = null;
  let riderRotator = null;     // element to rotate (advanced) or null (classic symbol)
  let riderBearing = 0;
  const orderMarkers = new Map();
  let lastOrders = [];
  let bounds = null;
  let boundsPts = [];

  const animator = createAnimator(applyRiderPose, ctx.isReduced);

  function latLng(p) { return { lat: p.lat, lng: p.lng }; }

  function setMarkerPosition(m, p) {
    if (!m) return;
    if (typeof m.setPosition === 'function') m.setPosition(latLng(p));
    else m.position = latLng(p);
  }

  function detach(m) {
    if (!m) return;
    try {
      if (typeof m.setMap === 'function') m.setMap(null);
      else m.map = null;
    } catch { /* already gone */ }
  }

  function point(x, y) {
    return maps.Point ? new maps.Point(x, y) : { x, y };
  }

  function size(w, h) {
    return maps.Size ? new maps.Size(w, h) : { width: w, height: h };
  }

  function svgIcon(svg, w, h, ax, ay) {
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: size(w, h),
      anchor: point(ax, ay),
    };
  }

  function makePin(kind, position, title, zIndex) {
    if (useAdvanced) {
      const content = document.createElement('div');
      content.className = `tmap__gpin tmap__gpin--${kind}`;
      content.innerHTML = PIN_MARKUP[kind];
      return new maps.marker.AdvancedMarkerElement({
        map, position: latLng(position), title, content, zIndex,
      });
    }
    return new maps.Marker({
      map, position: latLng(position), title, zIndex, icon: svgIcon(...PIN_ICON[kind]()),
    });
  }

  function makeRider(position, bearing) {
    if (useAdvanced) {
      const content = document.createElement('div');
      content.className = 'tmap__gpin tmap__gpin--rider';
      content.innerHTML = `<span class="tmap__rider-halo" aria-hidden="true"></span><span class="tmap__rider-arrow" aria-hidden="true">${RIDER_ARROW_SVG}</span>`;
      riderRotator = content.querySelector('.tmap__rider-arrow');
      if (riderRotator) riderRotator.style.transform = `rotate(${bearing}deg)`;
      return new maps.marker.AdvancedMarkerElement({
        map, position: latLng(position), title: 'Rider', content, zIndex: 40,
      });
    }
    riderRotator = null;
    return new maps.Marker({
      map, position: latLng(position), title: 'Rider', zIndex: 40, icon: riderSymbol(bearing),
    });
  }

  /** Classic-marker rider: an SVG path Symbol, which is the only icon form Google can rotate. */
  function riderSymbol(bearing) {
    return {
      path: 'M0,-12 L8.2,9 L0,3.6 L-8.2,9 Z',
      fillColor: CLAY,
      fillOpacity: 1,
      strokeColor: CREAM,
      strokeWeight: 2.5,
      strokeOpacity: 1,
      scale: 1.5,
      rotation: bearing,
      anchor: point(0, 0),
    };
  }

  function applyRiderPose(pose) {
    if (!rider) return;
    setMarkerPosition(rider, pose);
    if (riderRotator) {
      riderRotator.style.transform = `rotate(${pose.bearing.toFixed(1)}deg)`;
    } else if (Math.abs(pose.bearing - riderBearing) >= 2 && typeof rider.setIcon === 'function') {
      riderBearing = pose.bearing;
      rider.setIcon(riderSymbol(pose.bearing));
    }
  }

  function resetBounds() { bounds = maps.LatLngBounds ? new maps.LatLngBounds() : null; boundsPts = []; }
  function extend(p) {
    if (!p) return;
    if (bounds) { try { bounds.extend(latLng(p)); } catch { /* stub without extend */ } }
    // Track DISTINCT points separately: a pickup order extends the same coordinate several
    // times, and fitBounds() on a zero-size bounds zooms to the maximum.
    if (!boundsPts.some((q) => samePoint(q, p))) boundsPts.push(toLatLng(p));
  }

  function fit() {
    if (!boundsPts.length) return;
    try {
      if (boundsPts.length === 1) {
        map.setCenter(latLng(boundsPts[0]));
        map.setZoom(Number.isFinite(Number(ctx.options.pointZoom)) ? Number(ctx.options.pointZoom) : 15);
        return;
      }
      if (bounds) map.fitBounds(bounds, { top: 56, right: 40, bottom: 76, left: 40 });
    } catch { /* fit is best-effort */ }
  }

  function ensureHub(origin) {
    const o = origin || (mode === 'dispatch' ? ctx.hub : null);
    if (!o) return null;
    if (!hubMarker) hubMarker = makePin('hub', o, o.name || 'Market hub', 20);
    else setMarkerPosition(hubMarker, o);
    return o;
  }

  function dropRider() {
    animator.destroy();
    if (rider) { detach(rider); rider = null; riderRotator = null; }
  }

  /** Remove route + destination + rider. The dispatch hub survives a deselection. */
  function clearJourney() {
    [casing, line].forEach((p) => { if (p && typeof p.setMap === 'function') { try { p.setMap(null); } catch { /* */ } } });
    casing = null; line = null;
    if (destMarker) { detach(destMarker); destMarker = null; }
    dropRider();
    if (mode !== 'dispatch' && hubMarker) { detach(hubMarker); hubMarker = null; }
  }

  function setTracking(t) {
    if (!t) {
      clearJourney();
      resetBounds();
      if (mode === 'dispatch') { extend(ensureHub()); lastOrders.forEach((o) => extend(o.position)); fit(); }
      return;
    }

    resetBounds();

    // Pickup orders have no journey (destination === origin, single-point route): hub only.
    const path = journeyPath(t);
    if (path.length >= 2) {
      const gPath = path.map(latLng);
      if (!line) {
        casing = new maps.Polyline({
          map, path: gPath, strokeColor: CREAM, strokeOpacity: 0.95, strokeWeight: 9, zIndex: 10,
          clickable: false,
        });
        line = new maps.Polyline({
          map, path: gPath, strokeColor: CLAY, strokeOpacity: 1, strokeWeight: 5, zIndex: 11,
          clickable: false,
        });
      } else {
        if (typeof casing.setPath === 'function') casing.setPath(gPath);
        if (typeof line.setPath === 'function') line.setPath(gPath);
      }
      path.forEach(extend);
    } else if (line) {
      [casing, line].forEach((p) => { if (typeof p.setMap === 'function') { try { p.setMap(null); } catch { /* */ } } });
      casing = null; line = null;
    }

    const origin = ensureHub(t.origin);
    if (origin) extend(origin);

    if (path.length >= 2 && t.destination) {
      if (!destMarker) destMarker = makePin('dest', t.destination, t.destination.area || 'Your address', 30);
      else setMarkerPosition(destMarker, t.destination);
      extend(t.destination);
    } else if (destMarker) {
      detach(destMarker); destMarker = null;
    }

    // A rider only appears for a live ride: not for a scheduled order waiting for its
    // window, not for a pickup, not once delivered.
    if (path.length >= 2 && t.live && t.position && t.stage !== 'delivered') {
      const pose = { lat: t.position.lat, lng: t.position.lng, bearing: t.bearing, progress: t.progress };
      if (!rider) {
        riderBearing = t.bearing;
        rider = makeRider(t.position, t.bearing);
        animator.jump(pose);
      } else {
        animator.to(pose, ctx.animMs());
      }
      extend(t.position);
    } else {
      dropRider();
    }

    if (mode === 'dispatch') lastOrders.forEach((o) => extend(o.position));
    fit();
  }

  function paintSelection() {
    const sel = ctx.selected();
    orderMarkers.forEach((m, key) => {
      const on = key === sel;
      if (useAdvanced) {
        if (m.content) m.content.classList.toggle('is-selected', on);
        m.zIndex = on ? 35 : 25;
      } else if (typeof m.setIcon === 'function') {
        m.setIcon(svgIcon(...PIN_ICON.order(on)));
      }
    });
  }

  function setOrders(list) {
    lastOrders = list || [];
    const seen = new Set();
    lastOrders.forEach((o) => {
      seen.add(o.id);
      let m = orderMarkers.get(o.id);
      if (!m) {
        m = makePin('order', o.position, orderTitle(o), 25);
        if (typeof m.addListener === 'function') {
          m.addListener(useAdvanced ? 'gmp-click' : 'click', () => ctx.onSelect(o.id));
        }
        orderMarkers.set(o.id, m);
      } else {
        setMarkerPosition(m, o.position);
        if (typeof m.setTitle === 'function') m.setTitle(orderTitle(o));
        else m.title = orderTitle(o);
      }
    });
    orderMarkers.forEach((m, key) => {
      if (!seen.has(key)) { detach(m); orderMarkers.delete(key); }
    });
    paintSelection();

    if (mode === 'dispatch') {
      resetBounds();
      extend(ensureHub());
      lastOrders.forEach((o) => extend(o.position));
      if (destMarker) extend(destMarker.position || null);
      fit();
    }
  }

  function destroy() {
    animator.destroy();
    [casing, line].forEach((p) => { if (p && typeof p.setMap === 'function') { try { p.setMap(null); } catch { /* */ } } });
    [hubMarker, destMarker, rider].forEach(detach);
    orderMarkers.forEach(detach);
    orderMarkers.clear();
    try { if (maps.event && typeof maps.event.clearInstanceListeners === 'function') maps.event.clearInstanceListeners(map); } catch { /* */ }
  }

  resetBounds();
  if (mode === 'dispatch') { extend(ensureHub()); fit(); }

  return { kind: 'google', map, setTracking, setOrders, setSelected: paintSelection, fit, destroy };
}

/* An Uber-style puck: clay disc, cream chevron. Rotating the whole disc is safe — it is round. */
const RIDER_ARROW_SVG = '<svg viewBox="-18 -18 36 36" width="36" height="36" aria-hidden="true">'
  + '<circle r="14.5" fill="#C8552F" stroke="#FFF9EF" stroke-width="3"/>'
  + '<path d="M0,-8 L5.9,6.4 L0,2.8 L-5.9,6.4 Z" fill="#FFF9EF" stroke-linejoin="round"/></svg>';

const PIN_MARKUP = {
  hub: '<span class="tmap__gpin-dot tmap__gpin-dot--hub" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></span>',
  dest: '<span class="tmap__gpin-dot tmap__gpin-dot--dest" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>',
  order: '<span class="tmap__gpin-dot tmap__gpin-dot--order" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg></span>',
};

const PIN_ICON = {
  hub: () => [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="${SAFFRON}" stroke="${CREAM}" stroke-width="3.5"/><g fill="none" stroke="${COCOA}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(8 8) scale(1)"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></g></svg>`,
    40, 40, 20, 20,
  ],
  dest: () => [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48"><path d="M18 47C18 47 33 30 33 18A15 15 0 0 0 3 18C3 30 18 47 18 47Z" fill="${COCOA}" stroke="${CREAM}" stroke-width="3"/><circle cx="18" cy="18" r="6" fill="${CREAM}"/></svg>`,
    30, 40, 15, 40,
  ],
  order: (selected = false) => (selected
    ? [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="${SAFFRON}" fill-opacity="0.35"/><circle cx="22" cy="22" r="13" fill="${CLAY}" stroke="${SAFFRON}" stroke-width="4"/><circle cx="22" cy="22" r="4.5" fill="${CREAM}"/></svg>`,
      42, 42, 21, 21,
    ]
    : [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="${CLAY}" stroke="${CREAM}" stroke-width="3.5"/><circle cx="16" cy="16" r="4" fill="${CREAM}"/></svg>`,
      30, 30, 15, 15,
    ]),
};

/* ==========================================================================
   Backend 2 — inline SVG fallback map
   ========================================================================== */
function createFallbackBackend(ctx) {
  const { dom, mode, id } = ctx;
  const canvas = dom.canvas;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('tabindex', '0');

  const uid = `tmap${id}`;
  let tracking = null;
  let orders = [];
  let project = null;
  let size = { w: 0, h: 0 };
  let refs = null;
  let frame = 0;

  const animator = createAnimator(applyRiderPose, ctx.isReduced);

  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => scheduleRender())
    : null;
  if (ro) ro.observe(canvas);
  const onWinResize = () => scheduleRender();
  if (!ro && typeof addEventListener === 'function') addEventListener('resize', onWinResize);

  function scheduleRender() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  }

  /* ---- projection ---- */
  function buildProjection(w, h) {
    const pad = Math.max(26, Math.min(w, h) * 0.12);
    // Never zoom past this much ground, or a single point (hub only, one order, a pickup
    // order) fills the frame with empty land. An ops board needs more city context.
    const minSpan = mode === 'dispatch' ? 0.05 : 0.02;
    const pts = [];
    if (tracking) {
      if (tracking.route.length) pts.push(...tracking.route);
      if (tracking.origin) pts.push(tracking.origin);
      if (tracking.destination) pts.push(tracking.destination);
      if (tracking.position) pts.push(tracking.position);
    }
    if (mode === 'dispatch') pts.push(ctx.hub);
    orders.forEach((o) => { pts.push(o.position); if (o.destination) pts.push(o.destination); });
    if (!pts.length) pts.push(ctx.hub);

    let minLat = Infinity; let maxLat = -Infinity; let minLng = Infinity; let maxLng = -Infinity;
    pts.forEach((p) => {
      minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
    });

    const lat0 = (minLat + maxLat) / 2;
    const k = Math.cos((lat0 * Math.PI) / 180) || 1;

    // equirectangular: x grows east, y grows south
    const x0 = minLng * k; const x1 = maxLng * k;
    const y0 = -maxLat; const y1 = -minLat;
    const spanX = Math.max(x1 - x0, minSpan);
    const spanY = Math.max(y1 - y0, minSpan);
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;

    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);

    return (p) => ({
      x: (p.lng * k - cx) * scale + w / 2,
      y: (-p.lat - cy) * scale + h / 2,
    });
  }

  const toPath = (pts) => pts.map((p, i) => {
    const q = project(p);
    return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join(' ');

  const toPoly = (pairs) => toPath(pairs.map(([lat, lng]) => ({ lat, lng })));

  /**
   * Cut a polyline at a 0..1 fraction of its projected length; returns [travelled, remaining]
   * as arrays of PROJECTED {x,y} points. A degenerate input (fewer than two points, or zero
   * total length) yields empty arrays — xyPath() then produces an empty `d`, which draws nothing.
   */
  function splitAt(pts, frac) {
    if (!Array.isArray(pts) || pts.length < 2) return [[], []];
    const xy = pts.map(project);
    const segs = [];
    let total = 0;
    for (let i = 1; i < xy.length; i += 1) {
      const d = Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y);
      segs.push(d); total += d;
    }
    if (total <= 0) return [[], []];
    const target = clamp(frac, 0, 1) * total;
    let acc = 0;
    for (let i = 0; i < segs.length; i += 1) {
      if (acc + segs[i] >= target) {
        const t = segs[i] > 0 ? (target - acc) / segs[i] : 0;
        const cut = {
          x: lerp(xy[i].x, xy[i + 1].x, t),
          y: lerp(xy[i].y, xy[i + 1].y, t),
        };
        const head = xy.slice(0, i + 1).concat([cut]);
        const tail = [cut].concat(xy.slice(i + 1));
        return [head, tail];
      }
      acc += segs[i];
    }
    return [xy, [xy[xy.length - 1]]];
  }

  const xyPath = (xy) => (Array.isArray(xy) ? xy : [])
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  /* ---- render ---- */
  function render() {
    const w = Math.round(canvas.clientWidth || 0);
    const h = Math.round(canvas.clientHeight || 0);
    if (w < 40 || h < 40) return;   // not laid out yet; ResizeObserver will call us back
    size = { w, h };
    project = buildProjection(w, h);

    const roads = ROADS.map((r) => `<path d="${toPoly(r.pts)}" stroke-width="${(r.w * 2.6).toFixed(1)}"/>`).join('');
    const roadCore = ROADS.map((r) => `<path d="${toPoly(r.pts)}" stroke-width="${(r.w * 1.4).toFixed(1)}"/>`).join('');
    const parks = PARKS.map((p) => `<path d="${toPoly(p)}Z"/>`).join('');
    const water = WATER.map((p) => `<path d="${toPoly(p)}Z"/>`).join('');

    let routeMarkup = '';
    let hubMarkup = '';
    let destMarkup = '';
    let riderMarkup = '';

    // A pickup order (or any order still at the hub) has no journey: hub only, no line, no rider.
    // Dispatch draws the same journey for whatever order is selected, with the pins on top.
    const path = journeyPath(tracking);
    const hubPoint = (tracking && tracking.origin) || (mode === 'dispatch' ? ctx.hub : null);

    if (path.length >= 2) {
      const [head, tail] = splitAt(path, tracking.progress);
      routeMarkup = `
          <path class="tmapsvg__route-casing" d="${toPath(path)}"/>
          <path class="tmapsvg__route-remaining" d="${xyPath(tail)}"/>
          <path class="tmapsvg__route-done" d="${xyPath(head)}"/>`;
    }
    if (hubPoint) {
      const p = project(hubPoint);
      hubMarkup = `<g class="tmapsvg__hub" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})">
            <circle class="tmapsvg__hub-ring" r="13"/>
            <circle class="tmapsvg__hub-dot" r="6.5"/>
          </g>`;
    }
    if (path.length >= 2 && tracking.destination) {
      const p = project(tracking.destination);
      destMarkup = `<g class="tmapsvg__dest" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})">
            <path class="tmapsvg__dest-pin" d="M0,2 C0,2 11,-9 11,-17 A11,11 0 0 0 -11,-17 C-11,-9 0,2 0,2 Z"/>
            <circle class="tmapsvg__dest-eye" cy="-17" r="4.2"/>
          </g>`;
    }
    if (path.length >= 2 && tracking.live && tracking.position && tracking.stage !== 'delivered') {
      riderMarkup = `<g class="tmapsvg__rider" data-tmap="rider">
            <circle class="tmapsvg__rider-halo" r="21"/>
            <g class="tmapsvg__rider-body" data-tmap="rider-body">
              <circle class="tmapsvg__rider-disc" r="13.5"/>
              <path class="tmapsvg__rider-arrow" d="M0,-7.6 L5.6,6.1 L0,2.6 L-5.6,6.1 Z"/>
            </g>
          </g>`;
    }

    canvas.innerHTML = `
      <svg class="tmap__svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
           preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="${uid}-land" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stop-color="#FFF6E6"/>
            <stop offset="1" stop-color="#F2E3C6"/>
          </linearGradient>
          <pattern id="${uid}-grain" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="#DCC9A6" opacity="0.5"/>
            <circle cx="10" cy="9" r="0.7" fill="#DCC9A6" opacity="0.38"/>
          </pattern>
          <clipPath id="${uid}-clip"><rect x="0" y="0" width="${w}" height="${h}"/></clipPath>
        </defs>
        <rect width="${w}" height="${h}" fill="url(#${uid}-land)"/>
        <rect width="${w}" height="${h}" fill="url(#${uid}-grain)"/>
        <g clip-path="url(#${uid}-clip)">
          <g class="tmapsvg__parks">${parks}</g>
          <g class="tmapsvg__water">${water}</g>
          <g class="tmapsvg__roads-casing">${roads}</g>
          <g class="tmapsvg__roads">${roadCore}</g>
          <g class="tmapsvg__route">${routeMarkup}</g>
          ${hubMarkup}
          ${destMarkup}
          ${riderMarkup}
        </g>
      </svg>`;

    refs = {
      rider: canvas.querySelector('[data-tmap="rider"]'),
      riderBody: canvas.querySelector('[data-tmap="rider-body"]'),
      routeDone: canvas.querySelector('.tmapsvg__route-done'),
      routeRemaining: canvas.querySelector('.tmapsvg__route-remaining'),
    };

    if (animator.current) applyRiderPose(animator.current);
    renderPins();
  }

  /** Dispatch pins are real HTML buttons so they are clickable *and* keyboard reachable. */
  function renderPins() {
    if (mode !== 'dispatch') { dom.pins.hidden = true; dom.pins.innerHTML = ''; return; }
    if (!project || !orders.length) { dom.pins.hidden = true; dom.pins.innerHTML = ''; return; }
    const sel = ctx.selected();
    dom.pins.hidden = false;
    dom.pins.innerHTML = orders.map((o) => {
      const p = project(o.position);
      const on = o.id && o.id === sel;
      return `<button type="button" class="tmap__pin${on ? ' is-selected' : ''}" data-order-id="${escapeHtml(o.id)}"
        aria-pressed="${on ? 'true' : 'false'}"
        style="left:${((p.x / size.w) * 100).toFixed(3)}%;top:${((p.y / size.h) * 100).toFixed(3)}%"
        title="${escapeHtml(orderTitle(o))}"><span class="visually-hidden">${escapeHtml(orderTitle(o))}</span>
        <span class="tmap__pin-dot" aria-hidden="true"></span></button>`;
    }).join('');
  }

  function onPinClick(e) {
    const btn = e.target.closest('[data-order-id]');
    if (btn) ctx.onSelect(btn.getAttribute('data-order-id'));
  }
  dom.pins.addEventListener('click', onPinClick);

  function applyRiderPose(pose) {
    if (!refs || !refs.rider || !project) return;
    const p = project(pose);
    refs.rider.setAttribute('transform', `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`);
    if (refs.riderBody) refs.riderBody.setAttribute('transform', `rotate(${pose.bearing.toFixed(1)})`);
    if (refs.routeDone && refs.routeRemaining && tracking) {
      const path = journeyPath(tracking);
      if (path.length >= 2) {
        const [head, tail] = splitAt(path, pose.progress);
        refs.routeDone.setAttribute('d', xyPath(head));
        refs.routeRemaining.setAttribute('d', xyPath(tail));
      }
    }
  }

  /** `null` clears the journey; in dispatch mode the hub and the order pins stay. */
  function setTracking(t) {
    const first = !tracking;
    tracking = t;
    const rides = Boolean(t && t.live && t.position && t.stage !== 'delivered' && journeyPath(t).length >= 2);
    if (!rides) animator.destroy();
    render();
    if (!rides) return;
    const pose = { lat: t.position.lat, lng: t.position.lng, bearing: t.bearing, progress: t.progress };
    if (first) animator.jump(pose);
    else animator.to(pose, ctx.animMs());
  }

  function setOrders(list) {
    orders = list || [];
    render();
  }

  function setSelected() { renderPins(); }

  function fit() { render(); }

  function destroy() {
    animator.destroy();
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (ro) ro.disconnect();
    else if (typeof removeEventListener === 'function') removeEventListener('resize', onWinResize);
    dom.pins.removeEventListener('click', onPinClick);
  }

  render();
  return { kind: 'fallback', setTracking, setOrders, setSelected, fit, destroy };
}

export default createTrackingMap;
