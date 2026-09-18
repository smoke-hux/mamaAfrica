/**
 * Pricing rules — the single source of truth for totals.
 * Used by BOTH the browser (cart / checkout UI) and the server (order validation),
 * so a shopper can never be charged a number the server didn't compute itself.
 */
import { cents } from './format.js';

export const FREE_SHIPPING_THRESHOLD = 60;
/** Order size caps, enforced by the cart UI and by the server. Without them one order can drain the catalog. */
export const MAX_LINE_QTY = 20;
export const MAX_ORDER_UNITS = 60;
export const TAX_RATE = 0.08;

export const SHIPPING_METHODS = {
  standard: { id: 'standard', label: 'Standard (3–5 business days)', price: 6.95 },
  express:  { id: 'express',  label: 'Express (1–2 business days)',  price: 14.95 },
  pickup:   { id: 'pickup',   label: 'Pick up in store (free)',       price: 0 },
};

/** Promo codes: fixed percentages off the subtotal. Uppercase keys. */
export const PROMO_CODES = {
  KARIBU10: { code: 'KARIBU10', type: 'percent', value: 10, label: '10% off your order' },
  JOLLOF20: { code: 'JOLLOF20', type: 'percent', value: 20, label: '20% off your order' },
  FREESHIP: { code: 'FREESHIP', type: 'shipping', value: 0, label: 'Free standard shipping' },
};

export function normalizePromo(code) {
  return String(code || '').trim().toUpperCase();
}

export function findPromo(code) {
  return PROMO_CODES[normalizePromo(code)] || null;
}

/**
 * @param {Array<{price:number, qty:number}>} items
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
  const tax = cents(taxable * TAX_RATE);
  const total = cents(taxable + shipping + tax);

  return {
    itemCount, subtotal, discount, shipping, tax, total,
    shippingMethod, promoCode: promo ? promo.code : null, freeShippingEarned,
    amountToFreeShipping: freeShippingEarned ? 0 : cents(FREE_SHIPPING_THRESHOLD - (subtotal - discount)),
  };
}
