import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { loadApp, validOrder } from './helpers.js';
import { computeTotals, SHIPPING_METHODS } from '../../public/js/pricing.js';

let app, ordersFile, dir;
beforeAll(async () => ({ app, ordersFile, dir } = await loadApp()));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const stockOf = async (slug) => (await request(app).get(`/api/products/${slug}`)).body.product.stock;
const post = (path, body) => request(app).post(path).send(body);

// ---------------------------------------------------------------------------
describe('POST /api/orders/quote', () => {
  it('quotes line items and totals via the shared computeTotals', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p01', qty: 2 }, { id: 'p07', qty: 1 }], shippingMethod: 'standard' });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ id: 'p01', slug: 'jollof-rice-kit', name: 'Jollof Rice Party Kit', price: 18.5, qty: 2, lineTotal: 37 });
    expect(res.body.items[1]).toMatchObject({ id: 'p07', qty: 1, lineTotal: 3.95 });
    const expected = computeTotals([{ price: 18.5, qty: 2 }, { price: 3.95, qty: 1 }], { shippingMethod: 'standard' });
    expect(res.body.totals).toEqual(expected);
    expect(res.body.totals.subtotal).toBe(40.95);
    expect(res.body.totals.shipping).toBe(6.95);
    expect(res.body.totals.freeShippingEarned).toBe(false);
  });

  it('applies free standard shipping at or above the $60 threshold', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p01', qty: 4 }] }); // 74.00
    expect(res.body.totals.subtotal).toBe(74);
    expect(res.body.totals.shipping).toBe(0);
    expect(res.body.totals.freeShippingEarned).toBe(true);
    expect(res.body.totals.amountToFreeShipping).toBe(0);
  });

  it('loses free shipping when a percent promo pulls the discounted subtotal below $60', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p01', qty: 4 }], promoCode: 'JOLLOF20' }); // 74 - 14.8 = 59.2
    expect(res.body.totals.discount).toBe(14.8);
    expect(res.body.totals.freeShippingEarned).toBe(false);
    expect(res.body.totals.shipping).toBe(6.95);
    expect(res.body.totals.amountToFreeShipping).toBe(0.8);
  });

  it('applies KARIBU10 (10%) and tax on the discounted amount', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p03', qty: 2 }], promoCode: 'karibu10' }); // 13.00
    const t = res.body.totals;
    expect(t.promoCode).toBe('KARIBU10');
    expect(t.discount).toBe(1.3);
    expect(t.tax).toBe(0.94); // 11.70 * 0.08
    expect(t.total).toBe(11.7 + 6.95 + 0.94);
  });

  it('FREESHIP zeroes standard shipping but not express', async () => {
    let res = await post('/api/orders/quote', { items: [{ id: 'p03', qty: 1 }], promoCode: 'FREESHIP', shippingMethod: 'standard' });
    expect(res.body.totals.shipping).toBe(0);
    expect(res.body.totals.discount).toBe(0);
    res = await post('/api/orders/quote', { items: [{ id: 'p03', qty: 1 }], promoCode: 'FREESHIP', shippingMethod: 'express' });
    expect(res.body.totals.shipping).toBe(SHIPPING_METHODS.express.price);
  });

  it('prices express and pickup shipping', async () => {
    const express = await post('/api/orders/quote', { items: [{ id: 'p01', qty: 4 }], shippingMethod: 'express' });
    expect(express.body.totals.shipping).toBe(14.95);
    const pickup = await post('/api/orders/quote', { items: [{ id: 'p03', qty: 1 }], shippingMethod: 'pickup' });
    expect(pickup.body.totals.shipping).toBe(0);
  });

  it('ignores unknown promo codes and shipping methods (falls back)', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p03', qty: 1 }], promoCode: 'BOGUS', shippingMethod: 'drone' });
    expect(res.status).toBe(200);
    expect(res.body.totals.promoCode).toBeNull();
    expect(res.body.totals.shippingMethod).toBe('standard');
  });

  it('merges duplicate lines for the same product', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p03', qty: 1 }, { id: 'p03', qty: 2 }] });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qty).toBe(3);
  });

  it('400s on unknown product ids with a field path', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p03', qty: 1 }, { id: 'p99', qty: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields['items[1].id']).toMatch(/unknown product/i);
  });

  it('400s on bad quantities (0, negative, fractional, non-numeric, over stock)', async () => {
    for (const qty of [0, -1, 1.5, 'two', null, 10_000]) {
      const res = await post('/api/orders/quote', { items: [{ id: 'p03', qty }] });
      expect(res.status, `qty=${qty}`).toBe(400);
      expect(res.body.fields['items[0].qty']).toBeTruthy();
    }
  });

  it('400s on missing, empty or malformed items without crashing', async () => {
    for (const body of [{}, { items: [] }, { items: 'p01' }, { items: [null] }, { items: ['p01'] }, { items: { id: 'p01' } }, [], null, 'str']) {
      const res = await post('/api/orders/quote', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(Object.keys(res.body.fields).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/orders — happy paths', () => {
  it('creates a card order, stores only last4, and decrements stock', async () => {
    const before = await stockOf('jollof-rice-kit');
    const res = await post('/api/orders', validOrder({ notes: '  Ring the bell twice  ' }));
    expect(res.status).toBe(201);
    const { order } = res.body;

    expect(order.id).toMatch(/^MAM-[A-Z0-9]{6}$/);
    expect(order.status).toBe('confirmed');
    expect(new Date(order.createdAt).toString()).not.toBe('Invalid Date');
    expect(order.items).toEqual([expect.objectContaining({ id: 'p01', slug: 'jollof-rice-kit', qty: 2, price: 18.5, lineTotal: 37 })]);
    expect(order.totals).toEqual(computeTotals([{ price: 18.5, qty: 2 }], { shippingMethod: 'standard' }));
    expect(order.customer).toEqual({ firstName: 'Amara', lastName: 'Okafor', email: 'amara@example.com', phone: '+1 555 010 2030' });
    expect(order.address).toMatchObject({ line1: '12 Market Street', city: 'Lagos', postalCode: '100001', country: 'NG' });
    expect(order.payment).toEqual({ method: 'card', last4: '4242' });
    expect(order.notes).toBe('Ring the bell twice');

    // never leak sensitive card data anywhere in the response
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('4242 4242');
    expect(raw).not.toContain('4242424242424242');
    expect(raw).not.toContain('cvc');

    // +5 days for standard
    const eta = (new Date(order.estimatedDelivery) - new Date(order.createdAt)) / 86_400_000;
    expect(eta).toBeCloseTo(5, 5);

    expect(await stockOf('jollof-rice-kit')).toBe(before - 2);
  });

  it('estimated delivery is +2 days for express and +0 for pickup', async () => {
    const express = (await post('/api/orders', validOrder({ items: [{ id: 'p07', qty: 1 }], shippingMethod: 'express' }))).body.order;
    expect((new Date(express.estimatedDelivery) - new Date(express.createdAt)) / 86_400_000).toBeCloseTo(2, 5);
    expect(express.totals.shipping).toBe(14.95);
    const pickup = (await post('/api/orders', validOrder({ items: [{ id: 'p07', qty: 1 }], shippingMethod: 'pickup' }))).body.order;
    expect(new Date(pickup.estimatedDelivery).getTime()).toBe(new Date(pickup.createdAt).getTime());
    expect(pickup.totals.shipping).toBe(0);
  });

  it('applies a promo code to the stored totals', async () => {
    const res = await post('/api/orders', validOrder({ items: [{ id: 'p01', qty: 4 }], promoCode: 'jollof20' }));
    expect(res.status).toBe(201);
    expect(res.body.order.totals).toEqual(computeTotals([{ price: 18.5, qty: 4 }], { shippingMethod: 'standard', promoCode: 'JOLLOF20' }));
    expect(res.body.order.totals.promoCode).toBe('JOLLOF20');
    expect(res.body.order.totals.discount).toBe(14.8);
  });

  it('accepts mobile money and stores provider only', async () => {
    const res = await post('/api/orders', validOrder({
      items: [{ id: 'p11', qty: 1 }],
      payment: { method: 'mobile-money', provider: 'M-Pesa', mobileNumber: '+254 712 345 678' },
    }));
    expect(res.status).toBe(201);
    expect(res.body.order.payment).toEqual({ method: 'mobile-money', provider: 'M-Pesa' });
    expect(JSON.stringify(res.body)).not.toContain('712 345');
  });

  it('accepts cash on delivery with no extra fields', async () => {
    const res = await post('/api/orders', validOrder({ items: [{ id: 'p12', qty: 2 }], payment: { method: 'cash-on-delivery' } }));
    expect(res.status).toBe(201);
    expect(res.body.order.payment).toEqual({ method: 'cash-on-delivery' });
  });

  it('accepts a card expiring this month (valid through month end)', async () => {
    const now = new Date();
    const expiry = `${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCFullYear() % 100).padStart(2, '0')}`;
    const res = await post('/api/orders', validOrder({ items: [{ id: 'p08', qty: 1 }], payment: { expiry } }));
    expect(res.status).toBe(201);
  });

  it('generates unique ids across orders', async () => {
    const ids = new Set();
    for (let i = 0; i < 5; i++) {
      const res = await post('/api/orders', validOrder({ items: [{ id: 'p07', qty: 1 }] }));
      expect(res.status).toBe(201);
      ids.add(res.body.order.id);
    }
    expect(ids.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/orders — validation', () => {
  const expectFields = async (overrides, expected) => {
    const res = await post('/api/orders', validOrder(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    for (const f of expected) expect(res.body.fields, `expected field ${f}`).toHaveProperty(f);
    return res.body.fields;
  };

  it('rejects an empty cart', async () => {
    await expectFields({ items: [] }, ['items']);
  });

  it('rejects quantities above stock', async () => {
    const stock = await stockOf('ndole-kit');
    const fields = await expectFields({ items: [{ id: 'p16', qty: stock + 1 }] }, ['items[0].qty']);
    expect(fields['items[0].qty']).toMatch(new RegExp(`Only ${stock} left`));
  });

  it('rejects a Luhn-invalid card number', async () => {
    const fields = await expectFields({ payment: { cardNumber: '4242 4242 4242 4241' } }, ['payment.cardNumber']);
    expect(fields['payment.cardNumber']).toMatch(/valid card number/i);
  });

  it('rejects card numbers shorter than 13 or longer than 19 digits', async () => {
    await expectFields({ payment: { cardNumber: '4242' } }, ['payment.cardNumber']);        // short but Luhn-valid? doesn't matter — length fails
    await expectFields({ payment: { cardNumber: '42424242424242424242' } }, ['payment.cardNumber']); // 20 digits
  });

  it('rejects an expired card and bad expiry formats', async () => {
    const fields = await expectFields({ payment: { expiry: '01/20' } }, ['payment.expiry']);
    expect(fields['payment.expiry']).toMatch(/future/i);
    for (const expiry of ['13/30', '1/30', '12/2030', '1230', '', undefined]) {
      await expectFields({ payment: { expiry } }, ['payment.expiry']);
    }
  });

  it('rejects a card expiring last month', async () => {
    const d = new Date();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
    const expiry = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear() % 100).padStart(2, '0')}`;
    await expectFields({ payment: { expiry } }, ['payment.expiry']);
  });

  it('rejects bad CVCs', async () => {
    for (const cvc of ['12', '12345', 'abc', '', undefined]) await expectFields({ payment: { cvc } }, ['payment.cvc']);
  });

  it('requires provider and mobile number for mobile money', async () => {
    const fields = await expectFields({ payment: { method: 'mobile-money' } }, ['payment.provider', 'payment.mobileNumber']);
    expect(fields).not.toHaveProperty('payment.cardNumber');
  });

  it('rejects unknown payment methods', async () => {
    await expectFields({ payment: { method: 'bitcoin' } }, ['payment.method']);
    await expectFields({ payment: null }, ['payment']);
  });

  it('validates customer fields', async () => {
    const fields = await expectFields(
      { customer: { firstName: 'A', lastName: '', email: 'not-an-email', phone: '12345' } },
      ['customer.firstName', 'customer.lastName', 'customer.email', 'customer.phone'],
    );
    expect(fields['customer.firstName']).toMatch(/2 characters/);
    expect(fields['customer.phone']).toMatch(/7 digits/);
    await expectFields({ customer: 'nope' }, ['customer']);
  });

  it('validates required address fields (line2 and state optional)', async () => {
    const fields = await expectFields(
      { address: { line1: '', line2: '', city: ' ', state: '', postalCode: '', country: '' } },
      ['address.line1', 'address.city', 'address.postalCode', 'address.country'],
    );
    expect(fields).not.toHaveProperty('address.line2');
    expect(fields).not.toHaveProperty('address.state');
    await expectFields({ address: [] }, ['address']);
  });

  it('rejects unknown promo codes and shipping methods on order creation', async () => {
    const fields = await expectFields({ promoCode: 'NOTREAL', shippingMethod: 'drone' }, ['promoCode', 'shippingMethod']);
    expect(fields.promoCode).toBe('Promo code not recognised');
  });

  it('rejects non-string or overlong notes', async () => {
    await expectFields({ notes: { x: 1 } }, ['notes']);
    await expectFields({ notes: 'x'.repeat(501) }, ['notes']);
  });

  it('reports every failing field in one response', async () => {
    const res = await post('/api/orders', {});
    expect(res.status).toBe(400);
    expect(res.body.fields).toMatchObject({ items: expect.any(String), customer: expect.any(String), address: expect.any(String), payment: expect.any(String) });
  });

  it('never 500s on garbage bodies', async () => {
    for (const body of [null, [], { items: 1, customer: 2, address: 3, payment: 4, notes: 5 }, { items: [{}], customer: [], address: 'x', payment: [] }]) {
      const res = await post('/api/orders', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    }
    // JSON primitives are refused by the strict body parser with a JSON 400, never a 500 / HTML page
    for (const raw of ['42', '"text"', 'true']) {
      const res = await request(app).post('/api/orders').set('Content-Type', 'application/json').send(raw);
      expect(res.status, raw).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toBe('Invalid JSON body');
    }
  });

  it('does not touch stock when validation fails', async () => {
    const before = await stockOf('teff-flour');
    await post('/api/orders', validOrder({ items: [{ id: 'p06', qty: 1 }], payment: { cvc: '' } }));
    expect(await stockOf('teff-flour')).toBe(before);
  });
});

// ---------------------------------------------------------------------------
describe('GET /api/orders/:id and persistence', () => {
  it('fetches a created order by id (case-insensitive) and 404s otherwise', async () => {
    const created = (await post('/api/orders', validOrder({ items: [{ id: 'p14', qty: 1 }] }))).body.order;
    let res = await request(app).get(`/api/orders/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.order).toEqual(created);
    res = await request(app).get(`/api/orders/${created.id.toLowerCase()}`);
    expect(res.status).toBe(200);
    res = await request(app).get('/api/orders/MAM-ZZZZZZ');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Order not found' });
  });

  it('persists orders to ORDERS_FILE as a JSON array with no card data', async () => {
    const created = (await post('/api/orders', validOrder({ items: [{ id: 'p15', qty: 1 }] }))).body.order;
    expect(existsSync(ordersFile)).toBe(true);
    const raw = readFileSync(ordersFile, 'utf8');
    const saved = JSON.parse(raw);
    expect(Array.isArray(saved)).toBe(true);
    expect(saved.find((o) => o.id === created.id)).toEqual(created);
    expect(raw).not.toContain('4242424242424242');
    expect(raw).not.toContain('4242 4242');
    expect(raw).not.toMatch(/"cvc"/);
    expect(raw).not.toMatch(/"cardNumber"/);
    // no leftover temp files from the atomic write
    const leftovers = readFileSync(ordersFile, 'utf8') && (await import('node:fs')).readdirSync(dir).filter((f) => f.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
  });

  it('survives many concurrent orders without corrupting the file', async () => {
    const before = JSON.parse(readFileSync(ordersFile, 'utf8')).length;
    const results = await Promise.all(Array.from({ length: 8 }, () => post('/api/orders', validOrder({ items: [{ id: 'p07', qty: 1 }] }))));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const saved = JSON.parse(readFileSync(ordersFile, 'utf8'));
    expect(saved.length).toBe(before + 8);
  });
});
