import { describe, it, expect, beforeEach } from 'vitest';
import { createCart } from '../../public/js/cart.js';

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _dump: () => Object.fromEntries(store),
  };
}

const jollof = { id: 'p01', slug: 'jollof-rice-kit', name: 'Jollof Rice Party Kit', price: 18.5, image: '/img/jollof-rice-kit.svg', unit: 'serves 6', color: '#C8412B', stock: 40 };
const suya = { id: 'p03', slug: 'suya-spice', name: 'Yaji Suya Spice', price: 6.5, image: '/img/suya-spice.svg', unit: '150 g', color: '#B5451B', stock: 3 };

describe('cart store', () => {
  let storage, cart;
  beforeEach(() => { storage = memoryStorage(); cart = createCart({ storage }); });

  it('starts empty', () => {
    expect(cart.items()).toEqual([]);
    expect(cart.count()).toBe(0);
    expect(cart.subtotal()).toBe(0);
  });

  it('adds a product and computes count/subtotal', () => {
    cart.add(jollof, 2);
    expect(cart.count()).toBe(2);
    expect(cart.subtotal()).toBe(37);
    expect(cart.line('p01')).toMatchObject({ id: 'p01', qty: 2, price: 18.5, name: 'Jollof Rice Party Kit' });
  });

  it('increments an existing line instead of duplicating', () => {
    cart.add(jollof); cart.add(jollof, 3);
    expect(cart.items()).toHaveLength(1);
    expect(cart.line('p01').qty).toBe(4);
  });

  it('caps quantity at product stock', () => {
    cart.add(suya, 10);
    expect(cart.line('p03').qty).toBe(3);
    cart.increment('p03');
    expect(cart.line('p03').qty).toBe(3);
  });

  it('caps at 99 when stock is unknown', () => {
    cart.add({ id: 'x', name: 'X', price: 1 }, 500);
    expect(cart.line('x').qty).toBe(99);
  });

  it('setQty to 0 removes the line; negative and NaN are clamped', () => {
    cart.add(jollof, 2);
    cart.setQty('p01', 0);
    expect(cart.has('p01')).toBe(false);
    cart.add(jollof, 'abc');
    expect(cart.line('p01').qty).toBe(1);
    cart.setQty('p01', -5);
    expect(cart.has('p01')).toBe(false);
  });

  it('decrement to zero removes, remove() removes, clear() empties everything', () => {
    cart.add(jollof, 1); cart.add(suya, 2);
    cart.decrement('p01');
    expect(cart.has('p01')).toBe(false);
    cart.remove('p03');
    expect(cart.items()).toEqual([]);
    cart.add(jollof); cart.setPromo('karibu10'); cart.setShipping('express');
    cart.clear();
    expect(cart.snapshot()).toMatchObject({ items: [], count: 0, promoCode: null, shippingMethod: 'standard' });
  });

  it('ignores unknown ids gracefully', () => {
    expect(() => cart.setQty('nope', 3)).not.toThrow();
    expect(() => cart.remove('nope')).not.toThrow();
    expect(cart.increment('nope').count).toBe(0);
  });

  it('throws when adding without an id', () => {
    expect(() => cart.add({ name: 'ghost' })).toThrow(/id required/);
  });

  it('persists to storage and reloads from it', () => {
    cart.add(jollof, 2); cart.setPromo('JOLLOF20'); cart.setShipping('pickup');
    const again = createCart({ storage });
    expect(again.count()).toBe(2);
    expect(again.promo()).toBe('JOLLOF20');
    expect(again.shipping()).toBe('pickup');
  });

  it('survives corrupted storage', () => {
    const bad = memoryStorage({ 'mam.cart.v1': '{not json' });
    expect(createCart({ storage: bad }).items()).toEqual([]);
    const badLines = memoryStorage({ 'mam.cart.v1': JSON.stringify({ items: [{ id: 1 }, { id: 'ok', price: 2, qty: 1 }, { id: 'zero', price: 2, qty: 0 }] }) });
    expect(createCart({ storage: badLines }).items()).toHaveLength(1);
  });

  it('works with no storage at all', () => {
    const c = createCart({ storage: null });
    c.add(jollof);
    expect(c.count()).toBe(1);
  });

  it('notifies subscribers with a snapshot and supports unsubscribe', () => {
    const seen = [];
    const off = cart.subscribe((s) => seen.push(s.count));
    cart.add(jollof); cart.add(suya);
    off();
    cart.add(jollof);
    expect(seen).toEqual([1, 2]);
  });

  it('totals() reflects promo + shipping choices', () => {
    cart.add(jollof, 2); // 37.00
    cart.setPromo('KARIBU10'); cart.setShipping('express');
    const t = cart.totals();
    expect(t.discount).toBe(3.7);
    expect(t.shipping).toBe(14.95);
    expect(t.promoCode).toBe('KARIBU10');
  });

  it('toOrderItems() produces the API payload', () => {
    cart.add(jollof, 2); cart.add(suya, 1);
    expect(cart.toOrderItems()).toEqual([{ id: 'p01', qty: 2 }, { id: 'p03', qty: 1 }]);
  });

  it('returned items are copies (mutation does not leak)', () => {
    cart.add(jollof);
    cart.items()[0].qty = 50;
    expect(cart.line('p01').qty).toBe(1);
  });
});
