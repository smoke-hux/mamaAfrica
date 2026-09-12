/**
 * Cart store — persisted to localStorage, event-driven.
 * Contract:
 *   cart.items()            -> [{ id, slug, name, price, image, unit, qty, color }]
 *   cart.add(product, qty)  -> adds or increments (max 99 per line, respects product.stock if present)
 *   cart.setQty(id, qty)    -> qty <= 0 removes
 *   cart.remove(id)
 *   cart.clear()
 *   cart.count()            -> total units
 *   cart.subtotal()
 *   cart.setPromo(code) / cart.promo() / cart.setShipping(method) / cart.shipping()
 *   cart.totals()           -> computeTotals(items, {shippingMethod, promoCode})
 *   cart.subscribe(fn)      -> fn(state) on every change; returns unsubscribe
 * Emits a `cart:change` CustomEvent on window with { detail: state }.
 */
import { computeTotals } from './pricing.js';
import { cents } from './format.js';

const STORAGE_KEY = 'mam.cart.v1';
const MAX_QTY = 99;

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
          image: product.image, unit: product.unit, color: product.color, stock: product.stock, qty: q,
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
