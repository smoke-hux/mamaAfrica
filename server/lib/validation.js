/**
 * Defensive validators shared by the orders + newsletter routers.
 * Every helper accepts `unknown` and never throws on odd input.
 */
import { SHIPPING_METHODS, findPromo } from '../../public/js/pricing.js';
import { getProductById } from './catalog.js';

export const PAYMENT_METHODS = ['card', 'mobile-money', 'cash-on-delivery'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const text = (v) => (typeof v === 'string' ? v.trim() : '');
export const digits = (v) => text(v).replace(/\D/g, '');

export function isEmail(v) {
  const s = text(v);
  return s.length <= 254 && EMAIL_RE.test(s);
}

export function luhn(numberString) {
  const s = digits(numberString);
  if (!s) return false;
  let sum = 0;
  let double = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = s.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** "MM/YY" and not before the current month (card is valid through end of its month). */
export function expiryInFuture(v, now = new Date()) {
  const m = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(text(v));
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  const cur = now.getUTCFullYear() * 12 + (now.getUTCMonth() + 1);
  return year * 12 + month >= cur;
}

/**
 * Validate + normalise `items` from a request body.
 * @returns {{ fields: Record<string,string>, lines: Array<{product: object, qty: number}> }}
 */
export function validateItems(items) {
  const fields = {};
  const merged = new Map(); // id -> { product, qty }
  if (!Array.isArray(items) || items.length === 0) {
    fields.items = 'Add at least one item to your order';
    return { fields, lines: [] };
  }
  if (items.length > 100) {
    fields.items = 'Too many items in one order';
    return { fields, lines: [] };
  }
  items.forEach((it, i) => {
    if (!isObj(it)) { fields[`items[${i}]`] = 'Item must be an object with id and qty'; return; }
    const id = typeof it.id === 'string' ? it.id.trim() : '';
    const product = id ? getProductById(id) : null;
    if (!product) { fields[`items[${i}].id`] = 'Unknown product'; return; }
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1) { fields[`items[${i}].qty`] = 'Quantity must be a whole number of at least 1'; return; }
    const prev = merged.get(id);
    const total = (prev ? prev.qty : 0) + qty;
    if (total > product.stock) {
      fields[`items[${i}].qty`] = product.stock > 0
        ? `Only ${product.stock} left in stock for ${product.name}`
        : `${product.name} is out of stock`;
      return;
    }
    merged.set(id, { product, qty: total });
  });
  return { fields, lines: [...merged.values()] };
}

export function validateShippingMethod(v) {
  if (v == null || v === '') return null;
  return typeof v === 'string' && SHIPPING_METHODS[v] ? null : 'Choose a valid shipping method';
}

export function validatePromoCode(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return 'Promo code must be text';
  return findPromo(v) ? null : 'Promo code not recognised';
}

export function validateCustomer(c, fields) {
  if (!isObj(c)) { fields.customer = 'Contact details are required'; return; }
  if (text(c.firstName).length < 2) fields['customer.firstName'] = 'First name must be at least 2 characters';
  if (text(c.lastName).length < 2) fields['customer.lastName'] = 'Last name must be at least 2 characters';
  if (!isEmail(c.email)) fields['customer.email'] = 'Enter a valid email address';
  if (digits(c.phone).length < 7) fields['customer.phone'] = 'Enter a phone number with at least 7 digits';
}

export function validateAddress(a, fields) {
  if (!isObj(a)) { fields.address = 'Shipping address is required'; return; }
  if (!text(a.line1)) fields['address.line1'] = 'Street address is required';
  if (!text(a.city)) fields['address.city'] = 'City is required';
  if (!text(a.postalCode)) fields['address.postalCode'] = 'Postal code is required';
  if (!text(a.country)) fields['address.country'] = 'Country is required';
}

export function validatePayment(p, fields) {
  if (!isObj(p)) { fields.payment = 'Payment details are required'; return; }
  const method = text(p.method);
  if (!PAYMENT_METHODS.includes(method)) { fields['payment.method'] = 'Choose a payment method'; return; }
  if (method === 'card') {
    const num = digits(p.cardNumber);
    if (num.length < 13 || num.length > 19 || !luhn(num)) fields['payment.cardNumber'] = 'Enter a valid card number';
    if (!expiryInFuture(p.expiry)) fields['payment.expiry'] = 'Expiry must be MM/YY and in the future';
    if (!/^\d{3,4}$/.test(text(p.cvc))) fields['payment.cvc'] = 'CVC must be 3 or 4 digits';
    if (p.cardName != null && typeof p.cardName !== 'string') fields['payment.cardName'] = 'Name on card must be text';
  } else if (method === 'mobile-money') {
    if (!text(p.provider)) fields['payment.provider'] = 'Choose a mobile money provider';
    if (digits(p.mobileNumber).length < 7) fields['payment.mobileNumber'] = 'Enter the mobile number linked to your wallet';
  }
}
