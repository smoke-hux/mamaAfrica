/**
 * Cart store — persisted to localStorage, event-driven.
 * Contract:
 *   cart.items()            -> [{ id, slug, name, price, image, unit, qty, color }]
 *   cart.add(product, qty)  -> adds or increments (max MAX_LINE_QTY per line, respects product.stock if present)
 *   cart.room(product)      -> how many more can be added before the cap
 *   cart.setQty(id, qty)    -> qty <= 0 removes
 *   cart.remove(id)
 *   cart.clear()
 *   cart.count()            -> total units
 *   cart.subtotal()
 *   cart.setPromo(code) / cart.promo() / cart.setShipping(method) / cart.shipping()
 *   cart.totals()           -> computeTotals(items, {shippingMethod, promoCode})
 *   cart.sync(products)     -> refresh lines from the live catalog; returns [{ type, id, name, ... }] changes
 *   cart.subscribe(fn)      -> fn(state) on every change; returns unsubscribe
 * Emits a `cart:change` CustomEvent on window with { detail: state }.
 */
import { computeTotals, MAX_LINE_QTY } from './pricing.js';
import { cents } from './format.js';

const STORAGE_KEY = 'mam.cart.v1';
const MAX_QTY = MAX_LINE_QTY;

function safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__t';
    localStorage.setItem(k, '1'); localStorage.removeItem(k);
    return localStorage;
  } catch { return null; }
}

export function createCart({ storage = safeStorage(), key = STORAGE_KEY } = {}) {
  let state = load();
  const listeners = new Set();

  function load() {
    const empty = { items: [], promoCode: null, shippingMethod: 'standard' };
    if (!storage) return empty;
    try {
      const raw = storage.getItem(key);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      return {
        items: Array.isArray(parsed.items) ? parsed.items.filter(validLine) : [],
        promoCode: parsed.promoCode || null,
        shippingMethod: parsed.shippingMethod || 'standard',
      };
    } catch { return empty; }
  }

  function validLine(l) {
    return l && typeof l.id === 'string' && Number.isFinite(Number(l.price)) && Number(l.qty) > 0;
  }

  function persist() {
    if (storage) { try { storage.setItem(key, JSON.stringify(state)); } catch { /* quota / private mode */ } }
  }

  function emit() {
    persist();
    const snapshot = api.snapshot();
    listeners.forEach((fn) => { try { fn(snapshot); } catch (e) { console.error(e); } });
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('cart:change', { detail: snapshot }));
    }
  }

  function clampQty(qty, stock) {
    let q = Math.floor(Number(qty));
    if (!Number.isFinite(q)) q = 1;
    const cap = Number.isFinite(Number(stock)) && stock > 0 ? Math.min(MAX_QTY, stock) : MAX_QTY;
    return Math.max(0, Math.min(cap, q));
  }

  const api = {
    items: () => state.items.map((l) => ({ ...l })),
    count: () => state.items.reduce((n, l) => n + l.qty, 0),
    subtotal: () => cents(state.items.reduce((s, l) => s + l.price * l.qty, 0)),
    has: (id) => state.items.some((l) => l.id === id),
    line: (id) => { const l = state.items.find((x) => x.id === id); return l ? { ...l } : null; },
    promo: () => state.promoCode,
    shipping: () => state.shippingMethod,
    totals: () => computeTotals(state.items, { shippingMethod: state.shippingMethod, promoCode: state.promoCode }),
    snapshot: () => ({ items: api.items(), count: api.count(), promoCode: state.promoCode, shippingMethod: state.shippingMethod, totals: api.totals() }),

    /** How many more of this product the cart can take (stock and per-line cap). */
    room(product) {
      const existing = state.items.find((l) => l.id === product.id);
      const cap = clampQty(MAX_QTY, product.stock ?? existing?.stock);
      return Math.max(0, cap - (existing ? existing.qty : 0));
    },

    add(product, qty = 1) {
      if (!product || !product.id) throw new Error('cart.add: product with id required');
      const existing = state.items.find((l) => l.id === product.id);
      const stock = product.stock ?? existing?.stock;
      if (existing) {
        existing.qty = clampQty(existing.qty + Number(qty), stock);
      } else {
        const q = clampQty(qty, stock);
        if (q === 0) return api.snapshot();
        state.items.push({
          id: product.id, slug: product.slug, name: product.name, price: cents(product.price),
          image: product.image, unit: product.unit, color: product.color, stock: product.stock, vatExempt: Boolean(product.vatExempt), qty: q,
        });
      }
      emit();
      return api.snapshot();
    },

    setQty(id, qty) {
      const line = state.items.find((l) => l.id === id);
      if (!line) return api.snapshot();
      const q = clampQty(qty, line.stock);
      if (q === 0) state.items = state.items.filter((l) => l.id !== id);
      else line.qty = q;
      emit();
      return api.snapshot();
    },

    increment(id, by = 1) { const l = state.items.find((x) => x.id === id); return l ? api.setQty(id, l.qty + by) : api.snapshot(); },
    decrement(id, by = 1) { const l = state.items.find((x) => x.id === id); return l ? api.setQty(id, l.qty - by) : api.snapshot(); },

    remove(id) { state.items = state.items.filter((l) => l.id !== id); emit(); return api.snapshot(); },
    clear() { state = { items: [], promoCode: null, shippingMethod: 'standard' }; emit(); return api.snapshot(); },

    setPromo(code) { state.promoCode = code ? String(code).trim().toUpperCase() : null; emit(); return api.snapshot(); },
    setShipping(method) { state.shippingMethod = method || 'standard'; emit(); return api.snapshot(); },

    /**
     * Reconcile stored lines with fresh catalog data. Lines are snapshots taken when the
     * shopper clicked "add", so price and stock drift; the server always prices from the
     * catalog, and the cart should show the same numbers before checkout, not after.
     * @param {Array<object>} products current catalog (the full list: missing ids are dropped)
     * @returns {Array<{type: 'removed'|'qty'|'price', id: string, name: string}>}
     *   `removed` carries reason 'delisted' | 'sold-out'; `qty` carries reason 'stock' | 'limit' (the per-line cap).
     */
    sync(products) {
      if (!Array.isArray(products) || products.length === 0) return [];
      const fresh = new Map(products.map((p) => [p.id, p]));
      const changes = [];
      let dirty = false;
      const next = [];
      for (const line of state.items) {
        const p = fresh.get(line.id);
        const stock = p ? Number(p.stock) : 0;
        if (!p || (Number.isFinite(stock) && stock <= 0)) {
          changes.push({ type: 'removed', id: line.id, name: line.name, reason: p ? 'sold-out' : 'delisted' });
          continue;
        }
        const price = cents(p.price);
        if (price !== line.price) changes.push({ type: 'price', id: line.id, name: p.name, from: line.price, to: price });
        const qty = clampQty(line.qty, p.stock);
        // Clamped to what is left → 'stock'; clamped to the per-line cap (also when the catalog has no stock figure) → 'limit'.
        if (qty < line.qty) changes.push({ type: 'qty', id: line.id, name: p.name, from: line.qty, to: qty, reason: qty === stock ? 'stock' : 'limit' });
        const updated = {
          ...line, slug: p.slug, name: p.name, price, image: p.image, unit: p.unit, color: p.color, stock: p.stock, vatExempt: Boolean(p.vatExempt), qty,
        };
        if (Object.keys(updated).some((k) => updated[k] !== line[k])) dirty = true;
        next.push(updated);
      }
      if (changes.length || dirty) { state.items = next; emit(); }
      return changes;
    },

    /** Payload shape expected by POST /api/orders */
    toOrderItems: () => state.items.map((l) => ({ id: l.id, qty: l.qty })),

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Re-read storage (e.g. after another tab changed it). */
    reload() { state = load(); emit(); },
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => { if (e.key === key) api.reload(); });
  }
  return api;
}

/** Singleton for the browser. Tests use createCart() with an injected storage. */
export const cart = createCart();
export default cart;
