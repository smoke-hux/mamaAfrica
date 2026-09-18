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
    items: [{ id: 'p01', qty: 2 }], // Mombasa Pilau Kit, KSh 850 each
    shippingMethod: 'standard',
    promoCode: '',
    customer: { firstName: 'Wanjiru', lastName: 'Kamau', email: 'wanjiru@example.com', phone: '+254 712 345 678' },
    address: { line1: '12 Muthithi Road, Westlands', line2: '', city: 'Nairobi', state: 'Nairobi', postalCode: '00100', country: 'KE' },
    payment: { method: 'card', cardNumber: '4242 4242 4242 4242', cardName: 'Wanjiru Kamau', expiry: '12/39', cvc: '123' },
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
