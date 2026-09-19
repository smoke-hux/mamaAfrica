/** Order confirmation — fetch by id (sessionStorage fallback), celebrate, then track it live. */
import { api } from '/js/api.js';
import { money, escapeHtml } from '/js/format.js';
import { SHIPPING_METHODS } from '/js/pricing.js';
import { MOBILE_MONEY_PROVIDERS } from '/js/validation.js';
import { trackOrderLive } from '/js/track-client.js';
import { createTrackingMap } from '/js/tracking-map.js';

const LAST_ORDER_KEY = 'mam.lastOrder';
const $ = (sel) => document.querySelector(sel);

const root = $('#confirmation');
const view = { loading: $('#confirm-loading'), ok: $('#confirm-view'), notFound: $('#confirm-notfound') };

const COUNTRY_NAMES = {
  KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda', ET: 'Ethiopia', ZA: 'South Africa',
  GB: 'United Kingdom', US: 'United States', AE: 'United Arab Emirates', CA: 'Canada', DE: 'Germany', FR: 'France',
  NL: 'Netherlands', IE: 'Ireland', AU: 'Australia',
};
const countryName = (code) => COUNTRY_NAMES[String(code || '').toUpperCase()] || code || '';

function fmtDate(iso, opts = { weekday: 'long', month: 'long', day: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

function readLastOrder() {
  try { return JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) || 'null'); } catch { return null; }
}

function show(which) {
  Object.entries(view).forEach(([k, el]) => { el.hidden = k !== which; });
  root.setAttribute('aria-busy', 'false');
}

function paymentLabel(p = {}) {
  if (p.method === 'card') return p.last4 ? `Card ending in ${escapeHtml(p.last4)}` : 'Card';
  if (p.method === 'mobile-money') {
    const prov = MOBILE_MONEY_PROVIDERS.find((x) => x.id === p.provider)?.label || p.provider || 'Mobile Money';
    return `Mobile Money · ${escapeHtml(prov)}`;
  }
  if (p.method === 'cash-on-delivery') return 'Cash on delivery';
  return escapeHtml(p.method || '—');
}

function render(order) {
  const c = order.customer || {};
  const a = order.address || {};
  const t = order.totals || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const count = items.reduce((n, it) => n + Number(it.qty || 0), 0);

  // Deliberately says nothing about progress: the tracking panel below owns the live status, and a
  // static "we're packing it now" would contradict it the moment the rider sets off.
  $('#confirm-lead').textContent = c.email
    ? `Thank you${c.firstName ? `, ${c.firstName}` : ''}. We've sent a receipt to ${c.email}.`
    : `Thank you${c.firstName ? `, ${c.firstName}` : ''}. Your order is confirmed.`;

  $('#order-id').textContent = order.id || '';
  $('#order-date').textContent = order.createdAt ? `Placed ${fmtDate(order.createdAt, { month: 'long', day: 'numeric', year: 'numeric' })}` : '';

  const method = t.shippingMethod || order.shippingMethod;
  const isPickup = method === 'pickup';
  $('#eta-label').textContent = isPickup ? 'Ready for pickup' : 'Estimated delivery';
  // Standard is next day; express and pickup are same day.
  $('#eta-date').textContent = order.estimatedDelivery ? fmtDate(order.estimatedDelivery) : (method === 'standard' ? 'Tomorrow' : 'Today');

  $('#confirm-items').innerHTML = items.length ? items.map((it) => `
    <div class="confirm-item">
      <span>
        <span class="confirm-item__name">${escapeHtml(it.name || it.slug || it.id)}</span>
        <span class="confirm-item__meta">${it.qty} × ${money(it.price)}</span>
      </span>
      <span class="confirm-item__total">${money(it.lineTotal ?? Number(it.price) * Number(it.qty))}</span>
    </div>`).join('') : '<p class="muted">No line items were recorded for this order.</p>';

  $('#sum-subtotal').textContent = money(t.subtotal);
  const disc = Number(t.discount || 0);
  $('#sum-discount-row').hidden = !(disc > 0);
  $('#sum-discount-label').textContent = t.promoCode ? `Discount (${t.promoCode})` : 'Discount';
  $('#sum-discount').textContent = `–${money(disc)}`;
  const shipMethod = SHIPPING_METHODS[t.shippingMethod]?.label || t.shippingMethod || 'Standard';
  $('#sum-shipping-label').textContent = 'Delivery';
  $('#sum-shipping').innerHTML = Number(t.shipping || 0) === 0 ? '<span class="summary__free">Free</span>' : money(t.shipping);
  $('#sum-tax').textContent = money(t.tax);
  $('#sum-total').textContent = money(t.total);

  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  $('#confirm-address').innerHTML = `
    ${name ? `<strong>${escapeHtml(name)}</strong>` : ''}
    ${a.line1 ? `${escapeHtml(a.line1)}<br>` : ''}
    ${a.line2 ? `${escapeHtml(a.line2)}<br>` : ''}
    ${[a.city, a.state, a.postalCode].filter(Boolean).map(escapeHtml).join(', ')}<br>
    ${escapeHtml(countryName(a.country))}`;

  $('#confirm-payment').innerHTML = paymentLabel(order.payment);
  $('#confirm-shipping').textContent = shipMethod;
  $('#confirm-contact').innerHTML = [c.email, c.phone].filter(Boolean).map(escapeHtml).join('<br>') || '—';
  const notes = String(order.notes || '').trim();
  $('#confirm-notes-wrap').hidden = !notes;
  $('#confirm-notes').textContent = notes;

  document.title = `Order ${order.id || ''} confirmed | Mama Afrika Market`;
  show('ok');
  if (order.id) startTracking(String(order.id));
}

/* ------------------------------------------------------------------ */
/* Live tracking                                                       */
/* ------------------------------------------------------------------ */

/**
 * The panel below the receipt: stage, ETA, progress, map, rider and timeline.
 *
 * Everything updates in place. The confirmation container is `aria-live="polite"`, so a wholesale
 * re-render on every tick would read the whole page out again; the panel is `aria-live="off"` and
 * the single `#tracking-summary` line (role="status") is what a screen reader actually hears.
 */

const EAT = 'Africa/Nairobi';
const CLOCK_EAT = new Intl.DateTimeFormat('en-GB', { timeZone: EAT, hour: '2-digit', minute: '2-digit', hour12: false });
const DAY_EAT = new Intl.DateTimeFormat('en-GB', { timeZone: EAT, weekday: 'long', day: 'numeric', month: 'long' });
const DAYKEY_EAT = new Intl.DateTimeFormat('en-CA', { timeZone: EAT, year: 'numeric', month: '2-digit', day: '2-digit' });

const toDate = (v) => {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
/** "12:41" in Nairobi time. */
const hhmm = (v) => { const d = toDate(v); return d ? CLOCK_EAT.format(d) : ''; };
/** "12:41 EAT". */
const clock = (v) => { const t = hhmm(v); return t ? `${t} EAT` : ''; };

/** "Today", "Tomorrow" or "Saturday, 19 September", judged in Nairobi time. */
function dayWord(v, now = new Date()) {
  const d = toDate(v);
  if (!d) return '';
  const key = DAYKEY_EAT.format(d);
  if (key === DAYKEY_EAT.format(now)) return 'Today';
  if (key === DAYKEY_EAT.format(new Date(now.getTime() + 86400000))) return 'Tomorrow';
  return DAY_EAT.format(d);
}

function km(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0 km';
  if (n < 1) return `${Math.max(50, Math.round((n * 1000) / 50) * 50)} m`;
  if (n >= 10) return `${Math.round(n)} km`;
  return `${Math.round(n * 10) / 10} km`;
}

function minutesPhrase(mins) {
  const m = Number(mins);
  if (!Number.isFinite(m) || m <= 0) return 'any moment now';
  if (m === 1) return 'about a minute';
  if (m < 90) return `about ${m} minutes`;
  const h = Math.round(m / 60);
  return h < 24 ? `about ${h} hours` : 'more than a day';
}

/** The big number in the ETA box. Long rides read as hours, not 1511 min. */
function minutesShort(mins) {
  const m = Number(mins);
  if (!Number.isFinite(m) || m <= 0) return 'Any moment';
  if (m < 90) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

const initials = (name) => String(name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';

const firstName = (name) => String(name || '').split(/\s+/)[0] || 'Your rider';

/** The three-hour window a standard order goes out in (10:00 to 13:00 EAT). */
function windowFor(tracking) {
  const start = toDate(tracking.dispatchAt) || toDate(tracking.etaAt);
  if (!start) return null;
  return { start, end: new Date(start.getTime() + 3 * 60 * 60 * 1000) };
}

const stageRow = (tracking, stage) => (tracking.timeline || []).find((r) => r.stage === stage);

/**
 * Turn a tracking payload into the words on screen. One place, so the states stay consistent.
 * @returns {{eyebrow: string, stage: string, summary: string, etaLabel: string, etaValue: string,
 *            etaClock: string, progress: number}}
 */
function describe(tracking) {
  const t = tracking || {};
  const now = toDate(t.updatedAt) || new Date();
  const area = t.destination?.area || 'your place';
  const mins = Number(t.minutesRemaining) || 0;
  const method = t.shippingMethod;
  const outOfZone = t.destination?.inZone === false;

  if (t.stage === 'delivered') {
    const at = t.deliveredAt || t.etaAt;
    return {
      eyebrow: 'Delivered',
      stage: 'Delivered',
      summary: `Handed over in ${area} at ${clock(at)}. Enjoy the cooking.`,
      etaLabel: 'Delivered at',
      etaValue: hhmm(at),
      etaClock: `${dayWord(at, now)} · ${km(t.distanceKm)} from Westlands`,
      progress: 1,
    };
  }

  if (t.stage === 'ready-for-pickup') {
    const readyAt = stageRow(t, 'ready-for-pickup')?.at;
    return {
      eyebrow: 'Pickup in Westlands',
      stage: 'Ready for collection',
      summary: `Your order is packed and waiting at ${t.origin?.name || 'the market in Westlands'}. Bring your order number and we will hand it over.`,
      etaLabel: 'Collect from',
      etaValue: 'Westlands',
      etaClock: readyAt ? `Ready since ${clock(readyAt)}` : 'Ready now',
      progress: 1,
    };
  }

  if (t.stage === 'scheduled') {
    const w = windowFor(t);
    const when = dayWord(w?.start, now);
    // "today" / "tomorrow" read as adverbs; a named day needs an "on".
    const whenPhrase = when === 'Today' || when === 'Tomorrow' ? when.toLowerCase() : `on ${when}`;
    return {
      eyebrow: 'Scheduled delivery',
      stage: `Going out ${whenPhrase}`,
      summary: w
        ? `Your rider leaves Westlands ${whenPhrase} between ${hhmm(w.start)} and ${hhmm(w.end)} EAT. The map goes live the moment they set off.`
        : 'Your rider sets off in tomorrow morning’s delivery window.',
      etaLabel: 'Delivery window',
      etaValue: when,
      etaClock: w ? `${hhmm(w.start)} to ${hhmm(w.end)} EAT` : '',
      progress: 0,
    };
  }

  if (method === 'pickup') {
    return {
      eyebrow: 'Pickup in Westlands',
      stage: t.stageLabel || 'Packing your order',
      summary: `We are packing your order now. It will be ready to collect in Westlands ${minutesPhrase(mins)}.`,
      etaLabel: 'Ready in',
      etaValue: minutesShort(mins),
      etaClock: `Westlands · ${clock(t.etaAt)}`,
      progress: 0,
    };
  }

  // An address we cannot place inside Nairobi gets no ETA promise at all.
  if (outOfZone) {
    return {
      eyebrow: 'Checking your address',
      stage: 'Confirming the drop with you',
      summary: 'This address looks to be outside our Nairobi delivery area, so we are not putting a time on it yet.',
      etaLabel: 'Delivery area',
      etaValue: 'Outside Nairobi',
      etaClock: 'We will call you',
      progress: Number(t.progress) || 0,
    };
  }

  const etaBlock = {
    etaLabel: 'Arriving in',
    etaValue: minutesShort(mins),
    etaClock: `About ${clock(t.etaAt)}`,
  };

  if (t.stage === 'nearby') {
    return {
      eyebrow: 'Live tracking',
      stage: 'Arriving now',
      summary: `Arriving in ${minutesPhrase(mins)}, ${km(t.remainingKm)} away. Your rider is nearly at your gate.`,
      ...etaBlock,
      progress: Number(t.progress) || 0,
    };
  }

  if (t.stage === 'on-the-way' || t.stage === 'picked-up') {
    return {
      eyebrow: 'Live tracking',
      // Only name the area when the geocoder actually placed it; otherwise "to you".
      stage: t.stage === 'picked-up'
        ? 'Picked up from Westlands'
        : `On the way to ${t.destination?.precise === false ? 'you' : area}`,
      summary: `Arriving in ${minutesPhrase(mins)}, ${km(t.remainingKm)} away.`,
      ...etaBlock,
      progress: Number(t.progress) || 0,
    };
  }

  // confirmed, preparing, rider-assigned: still at the hub.
  const packing = t.stage === 'rider-assigned'
    ? `${firstName(t.rider?.name)} is at the shop picking it up.`
    : 'We are packing your order in Westlands.';
  return {
    eyebrow: 'Live tracking',
    stage: t.stageLabel || 'Order confirmed',
    summary: `${packing} Arriving in ${minutesPhrase(mins)}, ${km(t.remainingKm || t.distanceKm)} to ride.`,
    ...etaBlock,
    progress: 0,
  };
}

/** The one extra line under the header, when the address needs a word of explanation. */
function noteFor(tracking) {
  const d = tracking?.destination || {};
  if (d.inZone === false) {
    return `This address reads as ${d.area || 'outside Nairobi'}, which looks to be outside our Nairobi delivery area. We will call you to agree on the drop before the rider sets off.`;
  }
  if (d.precise === false) {
    return `The pin is approximate to ${d.area || 'the area'} rather than your door. Your rider will call when they are close.`;
  }
  return '';
}

/** Calm words for the feed. Never an error object. */
function connectionFor(state, tracking) {
  if (state === 'offline') return { label: 'Reconnecting…', state: 'offline' };
  if (!tracking) return { label: 'Connecting…', state: 'idle' };
  if (tracking.stage === 'delivered' || tracking.stage === 'ready-for-pickup') return { label: 'Updates finished', state: 'idle' };
  if (tracking.stage === 'scheduled') return { label: 'Live once it sets off', state: 'idle' };
  if (state === 'live') return { label: 'Live', state: 'live' };
  return { label: 'Updating…', state: 'polling' };
}

function startTracking(orderId) {
  const panel = $('#tracking-panel');
  const mapEl = $('#tracking-map');
  if (!panel || !orderId) return;

  const el = {
    eyebrow: $('#tracking-eyebrow'),
    stage: $('#tracking-stage'),
    summary: $('#tracking-summary'),
    etaLabel: $('#tracking-eta-label'),
    etaValue: $('#tracking-eta-value'),
    etaClock: $('#tracking-eta-clock'),
    bar: $('#tracking-progress'),
    fill: $('#tracking-progress-fill'),
    note: $('#tracking-note'),
    noteText: $('#tracking-note-text'),
    rider: $('#tracking-rider'),
    riderInitials: $('#tracking-rider-initials'),
    riderName: $('#tracking-rider-name'),
    riderVehicle: $('#tracking-rider-vehicle'),
    riderRating: $('#tracking-rider-rating-value'),
    riderPlate: $('#tracking-rider-plate'),
    riderPhone: $('#tracking-rider-phone'),
    riderDemo: $('#tracking-rider-demo'),
    riderTitle: $('#tracking-rider-title'),
    pickup: $('#tracking-pickup'),
    pickupPlace: $('#tracking-pickup-place'),
    pickupWhen: $('#tracking-pickup-when'),
    timeline: $('#tracking-timeline'),
    conn: $('#tracking-connection'),
    connText: $('#tracking-connection-text'),
  };

  let map = null;
  let rows = [];
  let rowsKey = '';
  let lastState = 'idle';
  let latest = null;
  let misses = 0;

  function setText(node, value) {
    const next = String(value ?? '');
    if (node && node.textContent !== next) node.textContent = next;
  }

  function paintConnection() {
    const { label, state } = connectionFor(lastState, latest);
    setText(el.connText, label);
    if (el.conn.dataset.state !== state) el.conn.dataset.state = state;
  }

  function paintRider(t) {
    const r = t.rider;
    const isPickup = t.shippingMethod === 'pickup';

    // Pickup has no rider: the side column carries the collection point instead.
    el.pickup.hidden = !isPickup;
    if (isPickup) {
      setText(el.pickupPlace, t.origin?.name || 'Mama Afrika Market, Westlands');
      const readyAt = stageRow(t, 'ready-for-pickup')?.at;
      setText(el.pickupWhen, t.stage === 'ready-for-pickup'
        ? `Waiting for you since ${clock(readyAt)}`
        : `Ready from about ${clock(readyAt || t.etaAt)}`);
    }

    if (!r || isPickup) { el.rider.hidden = true; return; }
    el.rider.hidden = false;
    setText(el.riderTitle, t.stage === 'delivered' ? 'Delivered by' : t.stage === 'scheduled' ? 'Your rider tomorrow' : 'Your rider');
    setText(el.riderInitials, initials(r.name));
    setText(el.riderName, r.name || 'Your rider');
    setText(el.riderVehicle, r.vehicle ? `${r.vehicle} rider` : 'Rider');
    setText(el.riderRating, Number(r.rating) ? Number(r.rating).toFixed(1) : '—');
    setText(el.riderPlate, r.plate || '—');
    setText(el.riderPhone, r.phone || '—');
    setText(el.riderDemo, t.stage === 'scheduled'
      ? 'Assigned for tomorrow. Demo rider on a demo route, no real order is on the road.'
      : 'Demo rider on a demo route. No real order is on the road.');
  }

  function paintTimeline(t) {
    const list = Array.isArray(t.timeline) ? t.timeline : [];
    const key = list.map((r) => r.stage).join('|');
    if (key !== rowsKey) {
      rowsKey = key;
      el.timeline.textContent = '';
      rows = list.map(() => {
        const li = document.createElement('li');
        li.className = 'trk__tl-item';
        const label = document.createElement('span');
        label.className = 'trk__tl-label';
        const time = document.createElement('span');
        time.className = 'trk__tl-time';
        li.append(label, time);
        el.timeline.append(li);
        return { li, label, time };
      });
    }
    // A scheduled order has not "reached" the confirmed stage as far as the stage order goes, but
    // the order was confirmed all the same, so anything already past counts as done. Only for
    // scheduled: everywhere else the server's own flags are the truth.
    const now = toDate(t.updatedAt) || new Date();
    const done = list.map((r) => r.done
      || (t.stage === 'scheduled' && (toDate(r.at)?.getTime() ?? Infinity) <= now.getTime()));
    // Once it is delivered every step is simply done; nothing is "current" any more.
    let current = -1;
    if (t.stage !== 'delivered') done.forEach((isDone, i) => { if (isDone) current = i; });
    list.forEach((r, i) => {
      const row = rows[i];
      if (!row) return;
      const cls = `trk__tl-item${done[i] ? ' is-done' : ''}${i === current ? ' is-current' : ''}`;
      if (row.li.className !== cls) row.li.className = cls;
      setText(row.label, r.label);
      const day = dayWord(r.at, now);
      const when = day === 'Today' ? clock(r.at) : `${day}, ${clock(r.at)}`;
      setText(row.time, done[i] ? when : `Expected ${when}`);
    });
  }

  // The static hero promises "on its way". Once tracking knows better, stop contradicting the
  // panel directly beneath it. The first call records the server-rendered copy as the default.
  const heroCopy = { title: null, lead: null };

  function paintHero(t) {
    const title = document.querySelector('#confirm-view .hero-title');
    const lead = document.getElementById('confirm-lead');
    const eyebrow = document.getElementById('confirm-eyebrow');
    if (!title || !lead) return;
    if (heroCopy.title === null) { heroCopy.title = title.innerHTML; heroCopy.lead = lead.textContent; }
    if (eyebrow) {
      eyebrow.textContent = t.stage === 'delivered' ? 'Delivered'
        : t.stage === 'ready-for-pickup' ? 'Ready to collect'
          : 'Order confirmed';
    }

    if (t.stage === 'delivered') {
      title.innerHTML = 'Asante! Your order has <em class="italic-accent">arrived.</em>';
      lead.textContent = `Delivered at ${clock(t.deliveredAt || t.etaAt)}. Thank you for shopping with us.`;
    } else if (t.stage === 'ready-for-pickup') {
      title.innerHTML = 'Asante! Your order is <em class="italic-accent">ready to collect.</em>';
      lead.textContent = `Waiting for you at ${t.origin?.name || 'our Westlands shop'}.`;
    } else if (t.stage === 'scheduled') {
      title.innerHTML = 'Asante! Your order is <em class="italic-accent">booked in.</em>';
      lead.textContent = heroCopy.lead;
    } else {
      title.innerHTML = heroCopy.title;
      lead.textContent = heroCopy.lead;
    }
  }

  function paint(t) {
    latest = t;
    const d = describe(t);

    panel.hidden = false;
    if (panel.dataset.stage !== t.stage) panel.dataset.stage = t.stage;

    setText(el.eyebrow, d.eyebrow);
    setText(el.stage, d.stage);
    setText(el.summary, d.summary);
    setText(el.etaLabel, d.etaLabel);
    setText(el.etaValue, d.etaValue);
    setText(el.etaClock, d.etaClock);

    const pct = Math.round(Math.max(0, Math.min(1, d.progress)) * 100);
    // Nothing has started on a scheduled order, so an empty track would just be a stray rule.
    el.bar.hidden = t.stage === 'scheduled';
    el.bar.setAttribute('aria-valuenow', String(pct));
    el.bar.setAttribute('aria-valuetext', d.summary);
    // A hair of fill so a freshly packed order does not look like an empty bar.
    el.fill.style.width = `${t.live && pct === 0 ? 3 : pct}%`;

    const note = noteFor(t);
    el.note.hidden = !note;
    if (note) setText(el.noteText, note);

    paintHero(t);
    paintRider(t);
    paintTimeline(t);
    paintConnection();

    if (!map) map = createTrackingMap(mapEl, { mode: 'customer' });
    map.setTracking(t);
  }

  let feed = null;
  function connect() {
    feed = trackOrderLive(orderId, {
      onUpdate(tracking) {
        if (!tracking) return;
        misses = 0;
        try { paint(tracking); } catch { /* a bad tick must never break the receipt */ }
      },
      onError() {
        // Never surface the error itself: the connection chip says everything the customer needs.
        misses += 1;
        // Nothing has ever arrived (no such order, or tracking is off): stop asking.
        if (!latest && misses >= 3) { feed?.stop(); paintConnection(); }
      },
      onState(state) {
        lastState = state;
        if (latest) paintConnection();
      },
    });
  }
  connect();

  // Leaving the page must stop the feed, but a bfcache "leave" is a pause, not an end: the DOM is
  // frozen exactly as it stands, so destroying the map here would strand the customer on an empty
  // box when they press Back. Keep the map, drop it only on a real unload, and reconnect on return.
  window.addEventListener('pagehide', (e) => {
    try { feed?.stop(); } catch { /* already stopped */ }
    feed = null;
    if (e.persisted) return;
    try { map?.destroy(); } catch { /* already gone */ }
    map = null;
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && !feed) { misses = 0; connect(); }
  });
}

async function boot() {
  const id = new URLSearchParams(window.location.search).get('id')?.trim();
  const last = readLastOrder();

  if (!id) {
    if (last?.id) { render(last); return; }
    $('#notfound-text').textContent = 'There is no order number in this link. If you just placed an order, check your confirmation email.';
    show('notFound');
    return;
  }

  try {
    const res = await api.order(id);
    if (res?.order) { render(res.order); return; }
    throw Object.assign(new Error('Order not found'), { status: 404 });
  } catch (err) {
    if (last && String(last.id).toUpperCase() === id.toUpperCase()) { render(last); return; }
    if (err.status === 404) {
      $('#notfound-text').textContent = `We couldn't find an order with the number ${id}. Check the link in your confirmation email, or head back to the shop.`;
    } else {
      $('#notfound-title').textContent = "We couldn't load your order";
      $('#notfound-text').textContent = 'The store is having trouble right now. Your order is safe, please try again in a moment.';
    }
    show('notFound');
  }
}

boot();
