/**
 * Keep the stored cart honest: refresh lines from the live catalog and tell the
 * shopper what changed. Used by the cart and checkout pages (browser only).
 */
import { cart } from './cart.js';
import { api } from './api.js';
import { money } from './format.js';

export function describeChange(c) {
  if (c.type === 'removed') return `${c.name} sold out and was removed from your cart`;
  if (c.type === 'qty') return `Only ${c.to} of ${c.name} left, so we updated your cart`;
  return `${c.name} is now ${money(c.to)}`;
}

/** @returns {Promise<Array<object>>} the changes applied (empty when offline or up to date) */
export async function syncCartWithCatalog({ notify = true } = {}) {
  if (cart.count() === 0) return [];
  let changes = [];
  try {
    const res = await api.products();
    changes = cart.sync(res?.products);
  } catch { return []; /* offline: the server still validates at checkout */ }
  if (notify) changes.forEach((c) => window.MAM?.toast?.(describeChange(c), { type: 'info', duration: 6000 }));
  return changes;
}
