/**
 * Dispatch board — the shop's own view of every live order.
 *
 * Staff facing: the feed carries customer names and areas, so nothing renders until the server has
 * accepted a bearer token. The token lives in sessionStorage for this tab only: never localStorage,
 * never the address bar, and it is wiped from the DOM and memory on sign out.
 *
 * Data comes from pollDispatch() in track-client.js (5s). A failed poll never blanks the board:
 * the last good payload stays on screen behind a "stale" badge until a fresh one lands.
 */
import { money } from '/js/format.js';
import { pollDispatch } from '/js/track-client.js';
import { createTrackingMap } from '/js/tracking-map.js';

const TOKEN_KEY = 'mam.dispatchToken';
const POLL_MS = 5000;
const HUB_FALLBACK = { lat: -1.2673, lng: 36.8065, name: 'Mama Afrika Market, Westlands' };

/* Five operational buckets over the server's nine stages. The row pill always shows the true
   stage label; these groups only drive the filter chips. */
const STAGE_GROUPS = {
  preparing: ['scheduled', 'confirmed', 'preparing', 'rider-assigned', 'ready-for-pickup'],
  'on-the-way': ['picked-up', 'on-the-way'],
  nearby: ['nearby'],
  delivered: ['delivered'],
};

/* Sort the board the way a dispatcher reads it: whoever is closest to a doorstep first. */
const URGENCY = {
  nearby: 0, 'on-the-way': 1, 'picked-up': 1, 'rider-assigned': 2, preparing: 2,
  confirmed: 3, 'ready-for-pickup': 4, scheduled: 5, delivered: 6,
};

const $ = (sel, root = document) => root.querySelector(sel);

const el = {
  gate: $('#dispatch-gate'),
  gateForm: $('[data-gate-form]'),
  gateInput: $('[data-gate-input]'),
  gateSubmit: $('[data-gate-submit]'),
  gateError: $('[data-gate-error]'),
  gateLead: $('[data-gate-lead]'),
  gate503: $('[data-gate-503]'),
  gateRetry: $('[data-gate-retry]'),
  board: $('#dispatch-board'),
  mapHost: $('#dispatch-map'),
  mapWrap: $('.ops-map-wrap'),
  mapNote: $('[data-map-note]'),
  list: $('[data-list]'),
  empty: $('[data-empty]'),
  search: $('[data-search]'),
  stageFilter: $('[data-stage-filter]'),
  visibleCount: $('[data-visible-count]'),
  summary: $('[data-board-summary]'),
  stale: $('[data-stale]'),
  staleText: $('[data-stale-text]'),
  signout: $('[data-signout]'),
  freshness: $('[data-freshness]'),
  freshnessText: $('[data-freshness-text]'),
  countLive: $('[data-count-live]'),
  countScheduled: $('[data-count-scheduled]'),
  countDelivered: $('[data-count-delivered]'),
  countUpdated: $('[data-count-updated]'),
};

const state = {
  token: readToken(),
  data: null,          // last good payload, kept through network wobbles
  departed: new Map(), // orders that left the live feed (the server drops delivered ones)
  selectedId: null,
  stage: 'all',
  query: '',
  lastGoodAt: null,
  stale: false,
  feed: null,
  map: null,
  rows: new Map(),     // id -> <li>, so a poll updates rows in place instead of rebuilding them
  ticker: null,
};

/* ------------------------------------------------------------------ */
/* Token handling                                                      */
/* ------------------------------------------------------------------ */

function readToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function writeToken(value) {
  state.token = value || '';
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode: the token simply will not survive a reload */ }
}

/* ------------------------------------------------------------------ */
/* Views: gate vs board                                                */
/* ------------------------------------------------------------------ */

function showGate({ message = '', notConfigured = false, tone = 'error' } = {}) {
  stopFeed();
  clearBoard();
  el.board.hidden = true;
  el.gate.hidden = false;
  el.signout.hidden = true;
  el.freshness.hidden = true;
  el.gate503.hidden = !notConfigured;
  el.gateForm.hidden = notConfigured;
  el.gateLead.hidden = notConfigured;
  el.gateError.hidden = !message;
  el.gateError.textContent = message || '';
  // Signing out is not a failure: say it calmly and do not interrupt a screen reader with an alert.
  el.gateError.classList.toggle('alert--danger', tone !== 'info');
  el.gateError.classList.toggle('ops-gate__note', tone === 'info');
  el.gateError.setAttribute('role', tone === 'info' ? 'status' : 'alert');
  el.gateSubmit.classList.remove('is-loading');
  el.gateSubmit.disabled = false;
  if (!notConfigured) {
    el.gateInput.value = '';
    el.gateInput.focus({ preventScroll: true });
  }
}

function showBoard() {
  el.gate.hidden = true;
  el.gateError.hidden = true;
  el.board.hidden = false;
  el.signout.hidden = false;
  el.freshness.hidden = false;
  el.gateInput.value = '';
  ensureMap();
}

/** Leave nothing behind: no customer name, area or total may survive a sign out. */
function clearBoard() {
  state.data = null;
  state.departed.clear();
  state.selectedId = null;
  state.lastGoodAt = null;
  state.stale = false;
  state.rows.clear();
  el.list.textContent = '';
  el.empty.hidden = true;
  el.stale.hidden = true;
  el.summary.textContent = '';
  el.visibleCount.textContent = '0 shown';
  [el.countLive, el.countScheduled, el.countDelivered].forEach((n) => { n.textContent = '0'; });
  el.countUpdated.textContent = '—';
  if (state.map) { state.map.destroy(); state.map = null; }
}

function ensureMap() {
  if (state.map || !el.mapHost) return;
  state.map = createTrackingMap(el.mapHost, { mode: 'dispatch' });
  state.map.onSelect = (id) => select(id, { scrollIntoView: true });
  paintMap();
}

/* ------------------------------------------------------------------ */
/* Feed                                                                */
/* ------------------------------------------------------------------ */

function startFeed() {
  stopFeed();
  state.feed = pollDispatch(() => state.token, {
    intervalMs: POLL_MS,
    onUpdate: (payload) => {
      const first = state.data === null;
      state.data = normalise(payload);
      state.lastGoodAt = new Date();
      state.stale = false;
      if (first) showBoard();
      render();
    },
    onError: (err) => {
      if (err && err.status === 401) {
        writeToken('');
        showGate({ message: 'That token was not accepted. Check it with the duty manager and try again.' });
        return;
      }
      if (err && err.status === 503) {
        showGate({ notConfigured: true });
        return;
      }
      // Anything else is a wobble, not a lock-out: keep the last good board and flag it.
      state.stale = true;
      if (state.data) render();
      else showGate({ message: 'We could not reach the dispatch feed. Check the connection and try again.' });
    },
  });
}

function stopFeed() {
  if (state.feed) { state.feed.stop(); state.feed = null; }
}

/** Trust nothing about the payload: the board must render even if a field is missing. */
function normalise(payload) {
  const raw = payload && typeof payload === 'object' ? payload : {};
  const orders = Array.isArray(raw.orders) ? raw.orders.filter((o) => o && o.id) : [];
  const counts = raw.counts && typeof raw.counts === 'object' ? raw.counts : {};
  const hub = raw.hub && Number.isFinite(Number(raw.hub.lat)) ? raw.hub : HUB_FALLBACK;

  // The feed only carries active orders. An id that disappears has been delivered, so keep the last
  // thing we knew about it rather than letting it drop off the board without a word.
  if (state.data) {
    const live = new Set(orders.map((o) => o.id));
    state.data.orders.forEach((prev) => {
      if (live.has(prev.id) || state.departed.has(prev.id)) return;
      state.departed.set(prev.id, {
        ...prev, stage: 'delivered', stageLabel: 'Delivered', live: false, minutesRemaining: 0, progress: 1, departed: true,
      });
    });
  }
  orders.forEach((o) => state.departed.delete(o.id)); // it came back: the server knows best

  return { orders, hub, counts, updatedAt: raw.updatedAt || null };
}

/* ------------------------------------------------------------------ */
/* Filtering (pure, instant, never refetches)                          */
/* ------------------------------------------------------------------ */

function allRows() {
  if (!state.data) return [];
  const rows = state.data.orders.concat([...state.departed.values()]);
  return rows.sort((a, b) => {
    const rank = (URGENCY[a.stage] ?? 9) - (URGENCY[b.stage] ?? 9);
    if (rank) return rank;
    const am = Number.isFinite(Number(a.minutesRemaining)) ? Number(a.minutesRemaining) : 1e9;
    const bm = Number.isFinite(Number(b.minutesRemaining)) ? Number(b.minutesRemaining) : 1e9;
    return am - bm;
  });
}

function matchesStage(order) {
  if (state.stage === 'all') return true;
  return (STAGE_GROUPS[state.stage] || []).includes(order.stage);
}

function matchesQuery(order) {
  if (!state.query) return true;
  const hay = `${order.id} ${order.customerName || ''} ${order.area || ''}`.toLowerCase();
  return hay.includes(state.query);
}

function visibleRows() {
  return allRows().filter((o) => matchesStage(o) && matchesQuery(o));
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function render() {
  const rows = visibleRows();
  // A selection the filter has hidden is stale state: let it go rather than keeping a ghost route.
  if (state.selectedId && !rows.some((o) => o.id === state.selectedId)) state.selectedId = null;
  renderCounters();
  renderList(rows);
  renderStale();
  renderSummary(rows);
  paintMap(rows);
}

function renderCounters() {
  const all = allRows();
  const counts = (state.data && state.data.counts) || {};
  const live = all.filter((o) => o.live && o.stage !== 'scheduled').length;
  const scheduled = all.filter((o) => o.stage === 'scheduled').length;
  const delivered = Number.isFinite(Number(counts.delivered))
    ? Math.max(Number(counts.delivered), state.departed.size)
    : state.departed.size;

  el.countLive.textContent = String(live);
  el.countScheduled.textContent = String(scheduled);
  el.countDelivered.textContent = String(delivered);
  renderFreshness();
}

function renderFreshness() {
  const at = state.lastGoodAt;
  el.countUpdated.textContent = at ? timeOfDay(at) : '—';
  if (!at) {
    el.freshnessText.textContent = 'Waiting for the first update';
    el.freshness.dataset.state = 'waiting';
    return;
  }
  const secs = Math.max(0, Math.round((Date.now() - at.getTime()) / 1000));
  const ago = secs < 5 ? 'just now' : secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)} min ago`;
  el.freshnessText.textContent = state.stale ? `Last good update ${ago}` : `Updated ${ago}`;
  el.freshness.dataset.state = state.stale ? 'stale' : 'fresh';
}

function renderStale() {
  el.stale.hidden = !state.stale;
  if (state.stale) {
    el.staleText.textContent = state.lastGoodAt
      ? `The feed went quiet. Showing the board as it stood at ${timeOfDay(state.lastGoodAt)}.`
      : 'The feed went quiet. Retrying.';
  }
}

function renderSummary(rows) {
  // Announce counts only: a dispatcher does not need the whole table read out every five seconds.
  const all = allRows();
  const live = all.filter((o) => o.live && o.stage !== 'scheduled').length;
  const shown = rows.length;
  const filtered = state.stage !== 'all' || state.query;
  el.visibleCount.textContent = `${shown} shown`;
  el.summary.textContent = filtered
    ? `${shown} of ${all.length} orders match this filter. ${live} on the road.`
    : `${all.length} orders on the board. ${live} on the road.`;
}

function renderList(rows) {
  const active = document.activeElement;
  const focusedId = active && active.closest ? (active.closest('[data-order-id]') || {}).dataset?.orderId : null;

  const wanted = new Set(rows.map((o) => o.id));
  state.rows.forEach((node, id) => {
    if (!wanted.has(id)) { node.remove(); state.rows.delete(id); }
  });

  let cursor = null;
  rows.forEach((order) => {
    let node = state.rows.get(order.id);
    if (!node) { node = buildRow(order); state.rows.set(order.id, node); }
    updateRow(node, order);
    const shouldBe = cursor ? cursor.nextElementSibling : el.list.firstElementChild;
    if (shouldBe !== node) el.list.insertBefore(node, shouldBe);
    cursor = node;
  });

  const nothing = rows.length === 0;
  el.list.hidden = nothing;
  el.empty.hidden = !nothing;
  if (nothing) el.empty.textContent = emptyMessage();

  if (focusedId && state.rows.has(focusedId) && document.activeElement !== active) {
    const btn = state.rows.get(focusedId).querySelector('.ops-row');
    if (btn) btn.focus({ preventScroll: true });
  }
}

function emptyMessage() {
  if (!state.data) return 'Connecting to the dispatch feed…';
  if (state.stage === 'delivered' && !state.query) {
    const done = Number((state.data.counts || {}).delivered) || 0;
    return done
      ? `${done} ${done === 1 ? 'order has' : 'orders have'} been delivered today. An order leaves the live feed the moment the rider finishes, so only the ones completed while this board was open stay listed here.`
      : 'Nothing delivered yet today.';
  }
  if (state.stage !== 'all' || state.query) return 'No orders match this filter. Clear it to see the whole board.';
  return 'No active orders right now. The board fills up the moment an order comes through.';
}

function buildRow(order) {
  const li = document.createElement('li');
  li.className = 'ops-row-item';
  li.dataset.orderId = order.id;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ops-row';
  btn.dataset.testid = 'dispatch-order-row';
  btn.dataset.orderId = order.id;
  btn.innerHTML = `
    <span class="ops-row__top">
      <span class="ops-row__id" data-f="id"></span>
      <span class="ops-pill" data-f="pill"></span>
    </span>
    <span class="ops-row__eta"><span class="visually-hidden">ETA </span><strong data-f="eta"></strong></span>
    <span class="ops-row__who">
      <span class="ops-row__name" data-f="name"></span>
      <span class="ops-row__area" data-f="area"></span>
    </span>
    <span class="ops-row__total" data-f="total"></span>
    <span class="ops-row__meta">
      <span class="ops-row__rider"><span class="visually-hidden">Rider </span><span data-f="rider"></span></span>
      <span class="ops-row__items" data-f="items"></span>
    </span>`;
  btn.addEventListener('click', () => select(order.id));
  li.appendChild(btn);
  return li;
}

function updateRow(li, order) {
  const btn = li.querySelector('.ops-row');
  const f = (name) => li.querySelector(`[data-f="${name}"]`);

  f('id').textContent = order.id;
  f('name').textContent = order.customerName || 'Customer';
  f('area').textContent = order.area || 'Nairobi';
  f('total').textContent = money(order.total);
  const items = Number(order.itemCount) || 0;
  f('items').textContent = `${items} ${items === 1 ? 'item' : 'items'}`;
  f('eta').textContent = etaText(order);
  f('rider').textContent = order.rider && order.rider.name
    ? order.rider.name
    : order.shippingMethod === 'pickup' ? 'Collection' : 'No rider yet';

  const pill = f('pill');
  pill.textContent = order.stageLabel || order.stage || 'Unknown';
  pill.dataset.stage = order.stage || '';

  btn.classList.toggle('is-selected', order.id === state.selectedId);
  btn.classList.toggle('is-departed', order.departed === true);
  if (order.id === state.selectedId) btn.setAttribute('aria-current', 'true');
  else btn.removeAttribute('aria-current');
}

function etaText(order) {
  if (order.stage === 'delivered') return 'Delivered';
  if (order.stage === 'ready-for-pickup') return 'At the shop';
  const mins = Number(order.minutesRemaining);
  if (!Number.isFinite(mins)) return '—';
  if (order.stage === 'scheduled') return mins >= 120 ? `${Math.round(mins / 60)} h` : `${Math.round(mins)} min`;
  return mins <= 1 ? 'Arriving' : `${Math.round(mins)} min`;
}

function timeOfDay(date) {
  try {
    return new Intl.DateTimeFormat('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
  } catch { return date.toISOString().slice(11, 19); }
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

function trackingFor(order) {
  return {
    orderId: order.id,
    stage: order.stage,
    stageLabel: `${order.id} · ${order.stageLabel || ''}`.trim(),
    live: order.live === true,
    progress: order.progress,
    position: order.position,
    origin: order.origin || (state.data && state.data.hub) || HUB_FALLBACK,
    destination: order.destination,
    route: order.route,
    minutesRemaining: order.minutesRemaining,
  };
}

function paintMap(rows = visibleRows()) {
  if (!state.map) return;
  const plottable = rows.filter((o) => o.position && !o.departed);
  const selected = plottable.find((o) => o.id === state.selectedId) || null;
  // Whichever call lands last decides the viewport, so put the one we want framed second.
  // The hub is the component's job in dispatch mode; deselecting clears the route with null.
  if (selected) {
    state.map.setOrders(plottable);
    state.map.setTracking(trackingFor(selected));
  } else {
    state.map.setTracking(null);
    state.map.setOrders(plottable);
  }
  el.mapNote.hidden = plottable.length > 0;
  el.mapWrap.classList.toggle('is-empty', plottable.length === 0);
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

function select(id, { scrollIntoView = false } = {}) {
  const next = state.selectedId === id ? null : id; // clicking the selected row lets it go
  state.selectedId = next;
  state.rows.forEach((li, rowId) => {
    const btn = li.querySelector('.ops-row');
    btn.classList.toggle('is-selected', rowId === next);
    if (rowId === next) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  });
  if (next && scrollIntoView && state.rows.has(next)) {
    state.rows.get(next).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  // On a phone the map sits above the list. Selecting a row is pointless if the map is off screen.
  if (next && !scrollIntoView && el.mapHost) {
    const box = el.mapHost.getBoundingClientRect();
    if (box.bottom < 80) el.mapHost.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  paintMap();
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

el.gateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = el.gateInput.value.trim();
  if (!value) {
    el.gateError.hidden = false;
    el.gateError.textContent = 'Enter the dispatch token to continue.';
    el.gateInput.focus();
    return;
  }
  el.gateError.hidden = true;
  el.gateSubmit.classList.add('is-loading');
  el.gateSubmit.disabled = true;
  writeToken(value);
  el.gateInput.value = '';
  startFeed();
});

el.gateRetry.addEventListener('click', () => {
  showGate({ message: '' });
  if (state.token) startFeed();
});

el.signout.addEventListener('click', () => {
  writeToken('');
  showGate({ message: 'Signed out. The board is locked again.', tone: 'info' });
});

el.stageFilter.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-stage]');
  if (!btn) return;
  state.stage = btn.dataset.stage;
  [...el.stageFilter.querySelectorAll('[data-stage]')].forEach((b) => {
    b.setAttribute('aria-pressed', String(b === btn));
  });
  render(); // filtering is local: no refetch, no flicker
});

el.search.addEventListener('input', () => {
  state.query = el.search.value.trim().toLowerCase();
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.selectedId && !el.board.hidden) select(state.selectedId);
});

window.addEventListener('pagehide', () => { stopFeed(); if (state.ticker) clearInterval(state.ticker); });

/* A ticking "updated 3s ago" is the cheapest way to prove the board is alive. */
state.ticker = setInterval(() => { if (!el.board.hidden) renderFreshness(); }, 1000);

if (state.token) {
  // A token from earlier in this tab: show the board frame straight away (it holds no customer data
  // yet) so the first paint is the board loading, not a flash of the sign-in panel.
  showBoard();
  render();
  startFeed();
} else {
  showGate();
}
