import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { loadApp, validOrder } from './helpers.js';
import { computeTotals, SHIPPING_METHODS } from '../../public/js/pricing.js';
import { decrementStock, restoreStock } from '../../server/lib/catalog.js';

let app, ordersFile, dir;
beforeAll(async () => ({ app, ordersFile, dir } = await loadApp()));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const stockOf = async (slug) => (await request(app).get(`/api/products/${slug}`)).body.product.stock;
const post = (path, body) => request(app).post(path).send(body);

// ---------------------------------------------------------------------------
describe('POST /api/orders/quote', () => {
  it('quotes line items and totals via the shared computeTotals', async () => {
    // Mombasa Pilau Kit x2 (850 each) + Mwea Pishori Rice x1 (290, zero-rated)
    const res = await post('/api/orders/quote', { items: [{ id: 'p01', qty: 2 }, { id: 'p13', qty: 1 }], shippingMethod: 'standard' });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ id: 'p01', slug: 'pilau-kit', name: 'Mombasa Pilau Kit', price: 850, qty: 2, lineTotal: 1700, vatExempt: false });
    expect(res.body.items[1]).toMatchObject({ id: 'p13', slug: 'mwea-pishori-rice', price: 290, qty: 1, lineTotal: 290, vatExempt: true });
    const expected = computeTotals([{ price: 850, qty: 2 }, { price: 290, qty: 1, vatExempt: true }], { shippingMethod: 'standard' });
    expect(res.body.totals).toEqual(expected);
    expect(res.body.totals.subtotal).toBe(1990);
    expect(res.body.totals.shipping).toBe(250);
    expect(res.body.totals.tax).toBe(272); // 16% of the vatable 1,700 only
    expect(res.body.totals.total).toBe(2512);
    expect(res.body.totals.freeShippingEarned).toBe(false);
    expect(res.body.totals.amountToFreeShipping).toBe(1010);
  });

  it('a vatExempt line carries no VAT, and a discount scales the vatable share', async () => {
    const items = [{ id: 'p01', qty: 2 }, { id: 'p13', qty: 1 }];
    let res = await post('/api/orders/quote', { items, promoCode: 'KARIBU10' });
    expect(res.status).toBe(200);
    expect(res.body.totals.discount).toBe(199);
    expect(res.body.totals.tax).toBe(244.8); // 1700 * (1791 / 1990) * 0.16
    expect(res.body.totals.total).toBe(2285.8);
    // a basket of zero-rated staples only: Sifted Maize Flour x2 (170 each)
    res = await post('/api/orders/quote', { items: [{ id: 'p12', qty: 2 }] });
    expect(res.body.items[0]).toMatchObject({ slug: 'sifted-maize-flour', vatExempt: true, lineTotal: 340 });
    expect(res.body.totals).toMatchObject({ subtotal: 340, tax: 0, shipping: 250, total: 590 });
  });

  it('applies free standard shipping at or above the KSh 3,000 threshold', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p01', qty: 4 }] }); // 3,400
    expect(res.body.totals.subtotal).toBe(3400);
    expect(res.body.totals.shipping).toBe(0);
    expect(res.body.totals.freeShippingEarned).toBe(true);
    expect(res.body.totals.amountToFreeShipping).toBe(0);
    expect(res.body.totals.tax).toBe(544); // 3400 * 0.16
    expect(res.body.totals.total).toBe(3944);
  });

  it('loses free shipping when a percent promo pulls the discounted subtotal below KSh 3,000', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p01', qty: 4 }], promoCode: 'PILAU20' }); // 3400 - 680 = 2720
    expect(res.body.totals.discount).toBe(680);
    expect(res.body.totals.freeShippingEarned).toBe(false);
    expect(res.body.totals.shipping).toBe(250);
    expect(res.body.totals.amountToFreeShipping).toBe(280);
  });

  it('applies KARIBU10 (10%) and tax on the discounted amount', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p09', qty: 2 }], promoCode: 'karibu10' }); // Nyama Choma Rub, 640
    const t = res.body.totals;
    expect(t.promoCode).toBe('KARIBU10');
    expect(t.discount).toBe(64);
    expect(t.tax).toBe(92.16); // 576 * 0.16
    expect(t.total).toBe(918.16); // 576 + 250 + 92.16
  });

  it('FREESHIP zeroes standard shipping but not express', async () => {
    let res = await post('/api/orders/quote', { items: [{ id: 'p09', qty: 1 }], promoCode: 'FREESHIP', shippingMethod: 'standard' });
    expect(res.body.totals.shipping).toBe(0);
    expect(res.body.totals.discount).toBe(0);
    res = await post('/api/orders/quote', { items: [{ id: 'p09', qty: 1 }], promoCode: 'FREESHIP', shippingMethod: 'express' });
    expect(res.body.totals.shipping).toBe(SHIPPING_METHODS.express.price);
    expect(res.body.totals.shipping).toBe(450);
  });

  it('prices express and pickup shipping', async () => {
    const express = await post('/api/orders/quote', { items: [{ id: 'p01', qty: 4 }], shippingMethod: 'express' });
    expect(express.body.totals.shipping).toBe(450);
    const pickup = await post('/api/orders/quote', { items: [{ id: 'p09', qty: 1 }], shippingMethod: 'pickup' });
    expect(pickup.body.totals.shipping).toBe(0);
  });

  it('ignores unknown promo codes and shipping methods (falls back)', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p09', qty: 1 }], promoCode: 'BOGUS', shippingMethod: 'boda' });
    expect(res.status).toBe(200);
    expect(res.body.totals.promoCode).toBeNull();
    expect(res.body.totals.shippingMethod).toBe('standard');
  });

  it('merges duplicate lines for the same product', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p09', qty: 1 }, { id: 'p09', qty: 2 }] });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qty).toBe(3);
  });

  it('400s on unknown product ids with a field path', async () => {
    const res = await post('/api/orders/quote', { items: [{ id: 'p09', qty: 1 }, { id: 'p99', qty: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields['items[1].id']).toMatch(/unknown product/i);
  });

  it('400s on bad quantities (0, negative, fractional, non-numeric, over stock)', async () => {
    for (const qty of [0, -1, 1.5, 'two', null, 10_000]) {
      const res = await post('/api/orders/quote', { items: [{ id: 'p09', qty }] });
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
    const before = await stockOf('pilau-kit');
    const res = await post('/api/orders', validOrder({ notes: '  Call when at the gate  ' }));
    expect(res.status).toBe(201);
    const { order } = res.body;

    expect(order.id).toMatch(/^MAM-[A-Z0-9]{6}$/);
    expect(order.status).toBe('confirmed');
    expect(new Date(order.createdAt).toString()).not.toBe('Invalid Date');
    expect(order.items).toEqual([expect.objectContaining({ id: 'p01', slug: 'pilau-kit', qty: 2, price: 850, lineTotal: 1700, vatExempt: false })]);
    expect(order.totals).toEqual(computeTotals([{ price: 850, qty: 2 }], { shippingMethod: 'standard' }));
    expect(order.totals).toMatchObject({ subtotal: 1700, shipping: 250, tax: 272, total: 2222 });
    expect(order.customer).toEqual({ firstName: 'Wanjiru', lastName: 'Kamau', email: 'wanjiru@example.com', phone: '+254 712 345 678' });
    expect(order.address).toMatchObject({ line1: '12 Muthithi Road, Westlands', city: 'Nairobi', postalCode: '00100', country: 'KE' });
    expect(order.payment).toEqual({ method: 'card', last4: '4242' });
    expect(order.notes).toBe('Call when at the gate');

    // never leak sensitive card data anywhere in the response
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('4242 4242');
    expect(raw).not.toContain('4242424242424242');
    expect(raw).not.toContain('cvc');

    // next day for standard
    const eta = (new Date(order.estimatedDelivery) - new Date(order.createdAt)) / 86_400_000;
    expect(eta).toBeCloseTo(1, 5);

    expect(await stockOf('pilau-kit')).toBe(before - 2);
  });

  it('estimated delivery is same day for express and for pickup', async () => {
    const express = (await post('/api/orders', validOrder({ items: [{ id: 'p07', qty: 1 }], shippingMethod: 'express' }))).body.order;
    expect(new Date(express.estimatedDelivery).getTime()).toBe(new Date(express.createdAt).getTime());
    expect(express.totals.shipping).toBe(450);
    const pickup = (await post('/api/orders', validOrder({ items: [{ id: 'p07', qty: 1 }], shippingMethod: 'pickup' }))).body.order;
    expect(new Date(pickup.estimatedDelivery).getTime()).toBe(new Date(pickup.createdAt).getTime());
    expect(pickup.totals.shipping).toBe(0);
  });

  it('applies a promo code to the stored totals', async () => {
    const res = await post('/api/orders', validOrder({ items: [{ id: 'p01', qty: 4 }], promoCode: 'pilau20' }));
    expect(res.status).toBe(201);
    expect(res.body.order.totals).toEqual(computeTotals([{ price: 850, qty: 4 }], { shippingMethod: 'standard', promoCode: 'PILAU20' }));
    expect(res.body.order.totals.promoCode).toBe('PILAU20');
    expect(res.body.order.totals.discount).toBe(680);
    expect(res.body.order.totals).toMatchObject({ shipping: 250, tax: 435.2, total: 3405.2 }); // 2720 * 0.16 = 435.2
  });

  it('accepts mobile money and stores provider only', async () => {
    const res = await post('/api/orders', validOrder({
      items: [{ id: 'p11', qty: 1 }],
      payment: { method: 'mobile-money', provider: 'mpesa', mobileNumber: '+254 733 987 654' },
    }));
    expect(res.status).toBe(201);
    expect(res.body.order.payment).toEqual({ method: 'mobile-money', provider: 'mpesa' });
    expect(JSON.stringify(res.body)).not.toContain('733 987');
  });

  it('accepts cash on delivery with no extra fields', async () => {
    const res = await post('/api/orders', validOrder({ items: [{ id: 'p12', qty: 2 }], payment: { method: 'cash-on-delivery' } }));
    expect(res.status).toBe(201);
    expect(res.body.order.payment).toEqual({ method: 'cash-on-delivery' });
    expect(res.body.order.totals).toMatchObject({ subtotal: 340, tax: 0, total: 590 }); // maize flour is zero-rated
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
    // Every catalog stock is above the per-line cap, so drain the mukimo kit down to 5 first (and put it back).
    const stock = await stockOf('mukimo-kit');
    const [taken] = decrementStock([{ id: 'p03', qty: stock - 5 }]);
    try {
      const fields = await expectFields({ items: [{ id: 'p03', qty: 6 }] }, ['items[0].qty']);
      expect(fields['items[0].qty']).toMatch(/Only 5 left/);
    } finally { restoreStock([taken]); }
    expect(await stockOf('mukimo-kit')).toBe(stock);
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

  it('requires a known provider and a mobile number for mobile money', async () => {
    await expectFields({ payment: { method: 'mobile-money', provider: 'Western Union', mobileNumber: '0712345678' } }, ['payment.provider']);
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
    const fields = await expectFields({ promoCode: 'JOLLOF20', shippingMethod: 'boda' }, ['promoCode', 'shippingMethod']);
    expect(fields.promoCode).toBe('Promo code not recognised');
  });

  it('caps every stored free-text field so one order cannot carry kilobytes', async () => {
    const long = 'x'.repeat(200);
    const fields = await expectFields({
      customer: { firstName: long, lastName: long, phone: '1'.repeat(40) },
      address: { line1: long, line2: long, city: long, state: long, postalCode: long, country: long },
      payment: { cardName: long },
    }, ['customer.firstName', 'customer.lastName', 'customer.phone', 'address.line1', 'address.line2', 'address.city',
      'address.state', 'address.postalCode', 'address.country', 'payment.cardName']);
    expect(fields['address.line1']).toMatch(/120 characters or fewer/);
  });

  it('caps the quantity per line and the units per order', async () => {
    let fields = await expectFields({ items: [{ id: 'p07', qty: 21 }] }, ['items[0].qty']);
    expect(fields['items[0].qty']).toMatch(/Maximum 20/);
    fields = await expectFields({ items: [{ id: 'p07', qty: 15 }, { id: 'p08', qty: 15 }, { id: 'p03', qty: 15 }, { id: 'p05', qty: 16 }] }, ['items']);
    expect(fields.items).toMatch(/limited to 60 items/);
    // the same product split over two lines is merged before the check
    fields = await expectFields({ items: [{ id: 'p07', qty: 12 }, { id: 'p07', qty: 12 }] }, ['items[1].qty']);
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
    const before = await stockOf('chapati-flour');
    await post('/api/orders', validOrder({ items: [{ id: 'p14', qty: 1 }], payment: { cvc: '' } }));
    expect(await stockOf('chapati-flour')).toBe(before);
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

  it('never oversells when concurrent orders compete for the last units', async () => {
    const slug = 'coconut-kashata';
    const { id } = (await request(app).get(`/api/products/${slug}`)).body.product;
    // Leave exactly one line's worth (the per-line cap) so a single order can take the last units.
    decrementStock([{ id, qty: (await stockOf(slug)) - 20 }]);
    const stock = await stockOf(slug);
    expect(stock).toBe(20);
    const results = await Promise.all(Array.from({ length: 3 }, () => post('/api/orders', validOrder({ items: [{ id, qty: stock }] }))));
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 400);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(rejected[0].body.fields['items[0].qty']).toMatch(/out of stock/);
    expect(await stockOf(slug)).toBe(0);
  });
});
