/**
 * Google Maps JS API loader for live order tracking.
 *
 *   loadGoogleMaps() -> Promise<{ available: boolean, google?: object, mapId?: string|null }>
 *
 * Asks `/api/config` whether a public browser key is configured, then injects the Maps JS API
 * exactly once (`libraries=marker,geometry`, `loading=async`). It NEVER throws and never blocks
 * render: a missing key, a 404, a blocked/quota-limited key, a network failure or a slow script
 * all resolve to `{ available: false }` so the caller can draw the fallback map instead.
 *
 * The promise is memoised — every caller on the page shares one config fetch and one <script>.
 */

/** Whole-operation budget: config fetch + script load. */
const TOTAL_TIMEOUT_MS = 6000;
/** The config fetch gets a slice of the budget so a hung endpoint cannot eat it all. */
const CONFIG_TIMEOUT_MS = 2500;

const CALLBACK_NAME = '__mamaAfrikaMapsReady';
const SCRIPT_ID = 'mama-afrika-google-maps';
const SCRIPT_ORIGIN = 'https://maps.googleapis.com';

const UNAVAILABLE = Object.freeze({ available: false });

let pending = null;

/**
 * Resolve the Google Maps namespace, or `{ available: false }`.
 * @returns {Promise<{ available: boolean, google?: object, mapId?: string|null }>}
 */
export function loadGoogleMaps() {
  if (!pending) {
    pending = boot().catch(() => UNAVAILABLE);
  }
  return pending;
}

/**
 * Drop the memoised result. Only useful for tests/harnesses that want to exercise both
 * branches on one page; production code should never need it.
 */
export function resetGoogleMapsLoader() {
  pending = null;
}

/* -------------------------------------------------------------------------- */

async function boot() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return UNAVAILABLE;

  const deadline = now() + TOTAL_TIMEOUT_MS;

  const config = await fetchMapsConfig();
  if (!config || !config.available || !config.apiKey) return UNAVAILABLE;

  const mapId = config.mapId || null;

  // Somebody (another component, or a test harness) already loaded the API. Reuse it.
  if (isLoaded()) return { available: true, google: window.google, mapId };

  const ok = await injectScript(config.apiKey, Math.max(750, deadline - now()));
  if (!ok || !isLoaded()) return UNAVAILABLE;

  return { available: true, google: window.google, mapId };
}

function isLoaded() {
  return Boolean(window.google && window.google.maps && window.google.maps.Map);
}

function now() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/**
 * `GET /api/config` -> `{ maps: { available, apiKey, mapId } }`.
 * Any non-2xx, malformed body, abort or network error means "no maps".
 */
async function fetchMapsConfig() {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS) : null;
  try {
    const res = await fetch('/api/config', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return null;
    const body = await res.json();
    const maps = body && body.maps;
    if (!maps || typeof maps !== 'object') return null;
    return {
      available: maps.available === true,
      apiKey: typeof maps.apiKey === 'string' && maps.apiKey ? maps.apiKey : null,
      mapId: typeof maps.mapId === 'string' && maps.mapId ? maps.mapId : null,
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Inject the Maps JS API once and wait for its `callback`.
 * Resolves `true` on success, `false` on error / timeout / auth failure.
 */
function injectScript(apiKey, budgetMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => finish(false), budgetMs);

    // Google calls this when the key is invalid, referrer-blocked or over quota. It fires
    // *after* the script itself loads, so it can only help before we settle — which is
    // exactly the common "bad key" case, where the callback never runs.
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = function gmAuthFailure() {
      finish(false);
      if (typeof previousAuthFailure === 'function') {
        try { previousAuthFailure.apply(this, arguments); } catch { /* not our problem */ }
      }
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // A previous (reset) call already injected it; just wait for the shared callback.
      chain(finish);
      return;
    }

    chain(finish);

    const params = new URLSearchParams({
      key: apiKey,
      libraries: 'marker,geometry',
      loading: 'async',
      v: 'weekly',
      language: 'en',
      region: 'KE',
      callback: CALLBACK_NAME,
    });

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `${SCRIPT_ORIGIN}/maps/api/js?${params.toString()}`;
    script.addEventListener('error', () => finish(false));
    try {
      document.head.appendChild(script);
    } catch {
      finish(false);
    }
  });
}

/** Register one more listener on the shared global callback the API invokes when ready. */
function chain(finish) {
  const previous = window[CALLBACK_NAME];
  window[CALLBACK_NAME] = function mapsReady() {
    if (typeof previous === 'function') {
      try { previous.apply(this, arguments); } catch { /* ignore */ }
    }
    finish(isLoaded());
  };
}

export default loadGoogleMaps;
