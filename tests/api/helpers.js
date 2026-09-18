/**
 * Shared test bootstrap: point ORDERS_FILE at a fresh temp file BEFORE the
 * app (and its orders store) is imported, then dynamically import the app.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function loadApp() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mam-orders-'));
  const ordersFile = path.join(dir, 'orders.json');
  process.env.ORDERS_FILE = ordersFile;
  process.env.RATE_LIMIT = 'off'; // the suites fire far more than a real client would; security.test.js covers the limiter
  const mod = await import('../../server/index.js');
  return { app: mod.app, ordersFile, dir };
}

export function validOrder(overrides = {}) {
  const base = {
    items: [{ id: 'p01', qty: 2 }],
    shippingMethod: 'standard',
    promoCode: '',
    customer: { firstName: 'Amara', lastName: 'Okafor', email: 'amara@example.com', phone: '+1 555 010 2030' },
    address: { line1: '12 Market Street', line2: '', city: 'Lagos', state: 'LA', postalCode: '100001', country: 'NG' },
    payment: { method: 'card', cardNumber: '4242 4242 4242 4242', cardName: 'Amara Okafor', expiry: '12/39', cvc: '123' },
    notes: '',
  };
  return deepMerge(base, overrides);
}

function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}
