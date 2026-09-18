/**
 * Pricing rules — the single source of truth for totals.
 * Used by BOTH the browser (cart / checkout UI) and the server (order validation),
 * so a shopper can never be charged a number the server didn't compute itself.
 */
import { cents } from './format.js';

export const FREE_SHIPPING_THRESHOLD = 3000;
/** Order size caps, enforced by the cart UI and by the server. Without them one order can drain the catalog. */
export const MAX_LINE_QTY = 20;
export const MAX_ORDER_UNITS = 60;
export const TAX_RATE = 0.16; // Kenya VAT. Lines with `vatExempt: true` (zero-rated staples: maize flour, wheat flour, rice) carry none.

/** Delivery within Nairobi and its environs. Prices in KES, in line with Glovo / Uber Eats delivery fees. */
export const SHIPPING_METHODS = {
  standard: { id: 'standard', label: 'Standard (next day, Nairobi)', price: 250 },
  express:  { id: 'express',  label: 'Express (same day, Nairobi)',  price: 450 },
  pickup:   { id: 'pickup',   label: 'Pick up in Westlands (free)',  price: 0 },
};

/** Promo codes: fixed percentages off the subtotal. Uppercase keys. */
export const PROMO_CODES = {
  KARIBU10: { code: 'KARIBU10', type: 'percent', value: 10, label: '10% off your order' },
  PILAU20:  { code: 'PILAU20',  type: 'percent', value: 20, label: '20% off your order' },
  FREESHIP: { code: 'FREESHIP', type: 'shipping', value: 0, label: 'Free standard delivery' },
};

export function normalizePromo(code) {
  return String(code || '').trim().toUpperCase();
}

export function findPromo(code) {
  return PROMO_CODES[normalizePromo(code)] || null;
}

/**
 * @param {Array<{price:number, qty:number, vatExempt?: boolean}>} items
 * @param {{shippingMethod?: string, promoCode?: string}} opts
 */
export function computeTotals(items, opts = {}) {
  const shippingMethod = SHIPPING_METHODS[opts.shippingMethod] ? opts.shippingMethod : 'standard';
  const promo = findPromo(opts.promoCode);

  const subtotal = cents(items.reduce((sum, it) => sum + Number(it.price) * Number(it.qty), 0));
  const itemCount = items.reduce((n, it) => n + Number(it.qty), 0);

  let discount = 0;
  if (promo && promo.type === 'percent') discount = cents(subtotal * (promo.value / 100));

  let shipping = SHIPPING_METHODS[shippingMethod].price;
  const freeShippingEarned = subtotal - discount >= FREE_SHIPPING_THRESHOLD;
  if (shippingMethod === 'standard' && (freeShippingEarned || (promo && promo.type === 'shipping'))) shipping = 0;
  if (itemCount === 0) shipping = 0;

  const taxable = Math.max(0, subtotal - discount);
  // VAT only on vatable lines; a percent discount is spread across all lines, so scale the vatable share by it.
  const vatable = cents(items.reduce((sum, it) => sum + (it.vatExempt ? 0 : Number(it.price) * Number(it.qty)), 0));
  const tax = subtotal > 0 ? cents(vatable * (taxable / subtotal) * TAX_RATE) : 0;
  const total = cents(taxable + shipping + tax);

  return {
    itemCount, subtotal, discount, shipping, tax, total,
    shippingMethod, promoCode: promo ? promo.code : null, freeShippingEarned,
    amountToFreeShipping: freeShippingEarned ? 0 : cents(FREE_SHIPPING_THRESHOLD - (subtotal - discount)),
  };
}
