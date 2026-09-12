import { describe, it, expect } from 'vitest';
import { computeTotals, findPromo, normalizePromo, SHIPPING_METHODS, FREE_SHIPPING_THRESHOLD, TAX_RATE } from '../../public/js/pricing.js';

const line = (price, qty) => ({ price, qty });

describe('pricing.computeTotals', () => {
  it('returns zeros for an empty cart (and no shipping charge)', () => {
    const t = computeTotals([]);
    expect(t).toMatchObject({ itemCount: 0, subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 });
  });

  it('sums line items and rounds to cents', () => {
    const t = computeTotals([line(18.5, 2), line(6.5, 3)]);
    expect(t.subtotal).toBe(56.5);
    expect(t.itemCount).toBe(5);
  });

  it('avoids floating point drift', () => {
    const t = computeTotals([line(0.1, 1), line(0.2, 1)]);
    expect(t.subtotal).toBe(0.3);
  });

  it('charges standard shipping below the free threshold', () => {
    const t = computeTotals([line(10, 1)]);
    expect(t.shipping).toBe(SHIPPING_METHODS.standard.price);
    expect(t.freeShippingEarned).toBe(false);
    expect(t.amountToFreeShipping).toBe(FREE_SHIPPING_THRESHOLD - 10);
  });

  it('gives free standard shipping at or above the threshold', () => {
    const t = computeTotals([line(FREE_SHIPPING_THRESHOLD, 1)]);
    expect(t.shipping).toBe(0);
    expect(t.freeShippingEarned).toBe(true);
    expect(t.amountToFreeShipping).toBe(0);
  });

  it('never discounts express shipping via the threshold', () => {
    const t = computeTotals([line(200, 1)], { shippingMethod: 'express' });
    expect(t.shipping).toBe(SHIPPING_METHODS.express.price);
  });

  it('pickup is always free', () => {
    const t = computeTotals([line(5, 1)], { shippingMethod: 'pickup' });
    expect(t.shipping).toBe(0);
  });

  it('falls back to standard for an unknown shipping method', () => {
    const t = computeTotals([line(5, 1)], { shippingMethod: 'drone' });
    expect(t.shippingMethod).toBe('standard');
  });

  it('applies percent promo codes case-insensitively', () => {
    const t = computeTotals([line(100, 1)], { promoCode: ' karibu10 ' });
    expect(t.discount).toBe(10);
    expect(t.promoCode).toBe('KARIBU10');
  });

  it('JOLLOF20 takes 20% off and taxes the discounted amount', () => {
    const t = computeTotals([line(100, 1)], { promoCode: 'JOLLOF20', shippingMethod: 'pickup' });
    expect(t.discount).toBe(20);
    expect(t.tax).toBe(Math.round(80 * TAX_RATE * 100) / 100);
    expect(t.total).toBe(80 + t.tax);
  });

  it('FREESHIP zeroes standard shipping under the threshold but not express', () => {
    expect(computeTotals([line(10, 1)], { promoCode: 'FREESHIP' }).shipping).toBe(0);
    expect(computeTotals([line(10, 1)], { promoCode: 'FREESHIP', shippingMethod: 'express' }).shipping).toBe(SHIPPING_METHODS.express.price);
  });

  it('ignores unknown promo codes', () => {
    const t = computeTotals([line(50, 1)], { promoCode: 'NOPE' });
    expect(t.discount).toBe(0);
    expect(t.promoCode).toBeNull();
  });

  it('discount can push a cart below the free-shipping threshold', () => {
    const t = computeTotals([line(62, 1)], { promoCode: 'JOLLOF20' });
    expect(t.freeShippingEarned).toBe(false);
    expect(t.shipping).toBe(SHIPPING_METHODS.standard.price);
  });

  it('total = subtotal - discount + shipping + tax', () => {
    const t = computeTotals([line(18.5, 2), line(6.5, 1)], { promoCode: 'KARIBU10' });
    const expected = Math.round((t.subtotal - t.discount + t.shipping + t.tax) * 100) / 100;
    expect(t.total).toBe(expected);
  });
});

describe('promo helpers', () => {
  it('normalizes codes', () => expect(normalizePromo('  jollof20 ')).toBe('JOLLOF20'));
  it('finds known codes', () => expect(findPromo('karibu10')).toMatchObject({ code: 'KARIBU10', value: 10 }));
  it('returns null for unknown / empty', () => { expect(findPromo('x')).toBeNull(); expect(findPromo('')).toBeNull(); expect(findPromo(undefined)).toBeNull(); });
});
