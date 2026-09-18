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

// Catalogue products as inline fixtures. Kashata is given a stock of 3 so the stock-cap tests have something small to hit.
const pilau = { id: 'p01', slug: 'pilau-kit', name: 'Mombasa Pilau Kit', price: 850, image: '/img/pilau-kit.svg', unit: 'serves 4', color: '#B5451B', stock: 40 };
const kashata = { id: 'p17', slug: 'coconut-kashata', name: 'Coconut Kashata', price: 150, image: '/img/coconut-kashata.svg', unit: 'pack of 6', color: '#DD7A55', stock: 3 };
const rice = { id: 'p13', slug: 'mwea-pishori-rice', name: 'Mwea Pishori Rice', price: 290, image: '/img/mwea-pishori-rice.svg', unit: '1 kg', color: '#F2A93B', stock: 180, vatExempt: true };

describe('cart store', () => {
  let storage, cart;
  beforeEach(() => { storage = memoryStorage(); cart = createCart({ storage }); });

  it('starts empty', () => {
    expect(cart.items()).toEqual([]);
    expect(cart.count()).toBe(0);
    expect(cart.subtotal()).toBe(0);
  });

  it('adds a product and computes count/subtotal', () => {
    cart.add(pilau, 2);
    expect(cart.count()).toBe(2);
    expect(cart.subtotal()).toBe(1700);
    expect(cart.line('p01')).toMatchObject({ id: 'p01', qty: 2, price: 850, name: 'Mombasa Pilau Kit', vatExempt: false });
  });

  it('increments an existing line instead of duplicating', () => {
    cart.add(pilau); cart.add(pilau, 3);
    expect(cart.items()).toHaveLength(1);
    expect(cart.line('p01').qty).toBe(4);
  });

  it('caps quantity at product stock', () => {
    cart.add(kashata, 10);
    expect(cart.line('p17').qty).toBe(3);
    cart.increment('p17');
    expect(cart.line('p17').qty).toBe(3);
  });

  it('room() says how many more fit, and add() at the cap changes nothing', () => {
    expect(cart.room(kashata)).toBe(3);
    cart.add(kashata, 2);
    expect(cart.room(kashata)).toBe(1);
    cart.add(kashata, 5);
    expect(cart.line('p17').qty).toBe(3);
    expect(cart.room(kashata)).toBe(0);
    expect(cart.room(pilau)).toBe(20); // stock 40, per-line cap wins
  });

  it('caps at MAX_LINE_QTY (20) when stock is unknown', () => {
    cart.add({ id: 'x', name: 'X', price: 1 }, 500);
    expect(cart.line('x').qty).toBe(20);
  });

  it('setQty to 0 removes the line; negative and NaN are clamped', () => {
    cart.add(pilau, 2);
    cart.setQty('p01', 0);
    expect(cart.has('p01')).toBe(false);
    cart.add(pilau, 'abc');
    expect(cart.line('p01').qty).toBe(1);
    cart.setQty('p01', -5);
    expect(cart.has('p01')).toBe(false);
  });

  it('decrement to zero removes, remove() removes, clear() empties everything', () => {
    cart.add(pilau, 1); cart.add(kashata, 2);
    cart.decrement('p01');
    expect(cart.has('p01')).toBe(false);
    cart.remove('p17');
    expect(cart.items()).toEqual([]);
    cart.add(pilau); cart.setPromo('karibu10'); cart.setShipping('express');
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
    cart.add(pilau, 2); cart.setPromo('PILAU20'); cart.setShipping('pickup');
    const again = createCart({ storage });
    expect(again.count()).toBe(2);
    expect(again.promo()).toBe('PILAU20');
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
    c.add(pilau);
    expect(c.count()).toBe(1);
  });

  it('notifies subscribers with a snapshot and supports unsubscribe', () => {
    const seen = [];
    const off = cart.subscribe((s) => seen.push(s.count));
    cart.add(pilau); cart.add(kashata);
    off();
    cart.add(pilau);
    expect(seen).toEqual([1, 2]);
  });

  it('totals() reflects promo + shipping choices', () => {
    cart.add(pilau, 2); // KSh 1,700
    cart.setPromo('KARIBU10'); cart.setShipping('express');
    const t = cart.totals();
    expect(t.discount).toBe(170);
    expect(t.shipping).toBe(450);
    expect(t.tax).toBe(244.8); // 1530 * 0.16
    expect(t.total).toBe(2224.8);
    expect(t.promoCode).toBe('KARIBU10');
  });

  it('carries vatExempt from the product so totals() skip VAT on zero-rated staples', () => {
    cart.add(rice, 2); // KSh 580, zero-rated
    expect(cart.line('p13')).toMatchObject({ vatExempt: true, qty: 2 });
    let t = cart.totals();
    expect(t).toMatchObject({ subtotal: 580, tax: 0, shipping: 250, total: 830 });
    cart.add(pilau, 1); // adds a vatable KSh 850
    t = cart.totals();
    expect(t).toMatchObject({ subtotal: 1430, tax: 136, total: 1816 });
  });

  it('toOrderItems() produces the API payload', () => {
    cart.add(pilau, 2); cart.add(kashata, 1);
    expect(cart.toOrderItems()).toEqual([{ id: 'p01', qty: 2 }, { id: 'p17', qty: 1 }]);
  });

  describe('sync() against the live catalog', () => {
    it('updates stale prices and stock, and reports the price change', () => {
      cart.add(pilau, 2);
      const changes = cart.sync([{ ...pilau, price: 899.5, stock: 12 }, kashata]);
      expect(changes).toEqual([{ type: 'price', id: 'p01', name: pilau.name, from: 850, to: 899.5 }]);
      expect(cart.line('p01')).toMatchObject({ price: 899.5, stock: 12, qty: 2 });
      expect(cart.subtotal()).toBe(1799);
    });

    it('clamps quantity down to what is left', () => {
      cart.add(pilau, 10);
      const changes = cart.sync([{ ...pilau, stock: 4 }]);
      expect(changes).toEqual([{ type: 'qty', id: 'p01', name: pilau.name, from: 10, to: 4, reason: 'stock' }]);
      expect(cart.line('p01').qty).toBe(4);
      cart.increment('p01');
      expect(cart.line('p01').qty).toBe(4);
    });

    it('blames the per-line cap, not stock, when a stored quantity is over the limit', () => {
      const storage2 = memoryStorage({ 'mam.cart.v1': JSON.stringify({ items: [{ ...pilau, qty: 150 }] }) });
      const stale = createCart({ storage: storage2 });
      expect(stale.sync([{ ...pilau, stock: 500 }])).toEqual([{ type: 'qty', id: 'p01', name: pilau.name, from: 150, to: 20, reason: 'limit' }]);
    });

    it('removes sold-out and delisted lines', () => {
      cart.add(pilau); cart.add(kashata);
      const changes = cart.sync([{ ...pilau, stock: 0 }, { id: 'p99', name: 'Other', price: 1, stock: 5 }]);
      expect(changes.map((c) => [c.type, c.id, c.reason])).toEqual([['removed', 'p01', 'sold-out'], ['removed', 'p17', 'delisted']]);
      expect(cart.items()).toEqual([]);
    });

    it('is silent when nothing changed, and ignores an empty catalog', () => {
      cart.add(pilau, 2);
      const seen = [];
      cart.subscribe((s) => seen.push(s));
      expect(cart.sync([pilau, kashata])).toEqual([]);
      expect(cart.sync([])).toEqual([]);
      expect(cart.sync(null)).toEqual([]);
      expect(seen).toHaveLength(0);
      expect(cart.line('p01').qty).toBe(2);
    });
  });

  it('returned items are copies (mutation does not leak)', () => {
    cart.add(pilau);
    cart.items()[0].qty = 50;
    expect(cart.line('p01').qty).toBe(1);
  });
});
