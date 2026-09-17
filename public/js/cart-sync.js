/**
 * Keep the stored cart honest: refresh lines from the live catalog and tell the
 * shopper what changed. Used by the cart and checkout pages (browser only).
 */
import { cart } from './cart.js';
import { api } from './api.js';
import { money } from './format.js';

const NOTICE_KEY = 'mam.cart.notices';
/** layout.js keeps at most three toasts on screen; more than that and the first ones are never seen. */
const MAX_NOTICES = 3;

export function describeChange(c) {
  if (c.type === 'removed') {
    return c.reason === 'delisted'
      ? `${c.name} is no longer available and was removed from your cart`
      : `${c.name} sold out and was removed from your cart`;
  }
  if (c.type === 'qty') {
    return c.reason === 'limit'
      ? `${c.name}: the limit is ${c.to} per order, so we updated your cart`
      : `Only ${c.to} of ${c.name} left, so we updated your cart`;
  }
  return `${c.name} is now ${money(c.to)}`;
}

function showNotices(messages) {
  const shown = messages.length > MAX_NOTICES
    ? [...messages.slice(0, MAX_NOTICES - 1), `…and ${messages.length - (MAX_NOTICES - 1)} more changes to your cart`]
    : messages;
  shown.forEach((m) => window.MAM?.toast?.(m, { type: 'info', duration: 6000 }));
}

/**
 * Show notices left behind by a page that navigated away before they could be read
 * (checkout sends the shopper to the cart page when a sync empties the cart).
 */
export function showCarriedNotices() {
  try {
    const raw = sessionStorage.getItem(NOTICE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(NOTICE_KEY);
    const messages = JSON.parse(raw);
    if (Array.isArray(messages)) showNotices(messages.map(String));
  } catch { /* private mode / bad JSON */ }
}

/**
 * @param {{notify?: boolean, carryIfEmptied?: boolean}} [opts] `carryIfEmptied`: the caller leaves the page
 *   when the cart empties, so hand the notices to the next page instead of toasting into a dying document.
 * @returns {Promise<Array<object>>} the changes applied (empty when offline or up to date)
 */
export async function syncCartWithCatalog({ notify = true, carryIfEmptied = false } = {}) {
  if (cart.count() === 0) return [];
  let changes = [];
  try {
    const res = await api.products();
    changes = cart.sync(res?.products);
  } catch { return []; /* offline: the server still validates at checkout */ }
  if (!changes.length) return changes;
  const messages = changes.map(describeChange);
  if (carryIfEmptied && cart.count() === 0) {
    try { sessionStorage.setItem(NOTICE_KEY, JSON.stringify(messages)); } catch { /* private mode */ }
  } else if (notify) {
    showNotices(messages);
  }
  return changes;
}
