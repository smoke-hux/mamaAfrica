/**
 * Live tracking feed for the browser.
 *
 * Prefers Server-Sent Events and falls back to polling. Serverless functions cannot hold a socket
 * open forever, so the server closes each stream after ~45s and EventSource reconnects on its own;
 * if SSE never works (proxy strips it, connection refused), this drops to polling for good and the
 * caller never notices the difference.
 */

const MIN_POLL_MS = 4000;
const MAX_BACKOFF_MS = 60_000;
/** If SSE produces nothing at all in this long, stop waiting on it and poll instead. */
const SSE_WATCHDOG_MS = 8000;

/**
 * @param {string} orderId
 * @param {{onUpdate: (t: object) => void, onError?: (e: Error) => void, onState?: (s: 'live'|'polling'|'offline'|'done') => void}} handlers
 * @returns {{ stop: () => void, refresh: () => Promise<void> }}
 */
export function trackOrderLive(orderId, { onUpdate, onError, onState } = {}) {
  const base = `/api/orders/${encodeURIComponent(orderId)}/tracking`;
  let stopped = false;
  let source = null;
  let timer = null;
  let backoff = MIN_POLL_MS;
  let sseFailures = 0;
  let lastStage = null;
  let watchdog = null;

  const setState = (s) => { try { onState?.(s); } catch { /* caller's problem, not ours */ } };

  function finish(tracking) {
    // Nothing more will change: stop asking rather than polling a delivered order forever.
    if (tracking && tracking.pollAfterMs === 0) { stop(); setState('done'); return true; }
    return false;
  }

  function emit(tracking) {
    if (stopped || !tracking) return;
    lastStage = tracking.stage;
    try { onUpdate?.(tracking); } catch (err) { console.error(err); }
    finish(tracking);
  }

  async function poll() {
    if (stopped) return;
    try {
      const res = await fetch(base, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw Object.assign(new Error(`Tracking unavailable (${res.status})`), { status: res.status });
      const { tracking } = await res.json();
      backoff = Math.max(MIN_POLL_MS, tracking?.pollAfterMs || MIN_POLL_MS);
      setState('polling');
      emit(tracking);
    } catch (err) {
      backoff = Math.min(MAX_BACKOFF_MS, Math.max(MIN_POLL_MS, backoff * 2));
      setState('offline');
      try { onError?.(err); } catch { /* ignore */ }
    }
    if (!stopped) timer = setTimeout(poll, backoff);
  }

  function startPolling() {
    if (stopped || timer) return;
    closeSource();
    poll();
  }

  function closeSource() {
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    if (source) { try { source.close(); } catch { /* already gone */ } source = null; }
  }

  function startSse() {
    if (typeof EventSource !== 'function') { startPolling(); return; }
    try {
      source = new EventSource(`${base}/stream`);
    } catch { startPolling(); return; }

    // A refused or blocked stream leaves EventSource in CONNECTING and it retries silently, so the
    // 'error' path below never runs. Without this the panel would freeze on its last frame.
    watchdog = setTimeout(() => { if (!stopped && !timer) startPolling(); }, SSE_WATCHDOG_MS);

    source.addEventListener('tracking', (ev) => {
      try {
        const tracking = JSON.parse(ev.data);
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        sseFailures = 0;
        setState('live');
        emit(tracking);
      } catch (err) { onError?.(err); }
    });

    source.addEventListener('error', () => {
      if (stopped) return;
      // A closed stream is normal (the server ends it every ~45s) and EventSource retries itself.
      // Repeated immediate failures mean SSE is not getting through: give up and poll.
      if (source && source.readyState === EventSource.CLOSED) {
        sseFailures += 1;
        if (sseFailures >= 2 || lastStage === null) { startPolling(); return; }
        closeSource();
        setTimeout(() => { if (!stopped) startSse(); }, 2000);
      }
    });
  }

  function stop() {
    stopped = true;
    closeSource();
    if (timer) { clearTimeout(timer); timer = null; }
  }

  async function refresh() {
    try {
      const res = await fetch(base, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const { tracking } = await res.json();
      emit(tracking);
    } catch { /* the next tick will try again */ }
  }

  // One immediate fetch so the map has something to draw before the stream warms up.
  refresh().then(() => { if (!stopped) startSse(); });

  return { stop, refresh };
}

/** Ops board feed. Token lives in sessionStorage, never in the URL bar or localStorage. */
export function pollDispatch(getToken, { onUpdate, onError, intervalMs = 5000, include = 'all' } = {}) {
  const url = `/api/dispatch/orders${include === 'all' ? '?include=all' : ''}`;
  let stopped = false;
  let timer = null;

  async function tick() {
    if (stopped) return;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${getToken() || ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.error || `Dispatch unavailable (${res.status})`), { status: res.status });
      }
      onUpdate?.(await res.json());
    } catch (err) {
      try { onError?.(err); } catch { /* ignore */ }
      if (err.status === 401 || err.status === 503) { stopped = true; return; } // do not hammer a locked door
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  }

  tick();
  return { stop() { stopped = true; if (timer) clearTimeout(timer); } };
}
