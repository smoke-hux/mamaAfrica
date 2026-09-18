import { describe, it, expect } from 'vitest';
import { computeTotals, findPromo, normalizePromo, SHIPPING_METHODS, FREE_SHIPPING_THRESHOLD, TAX_RATE } from '../../public/js/pricing.js';

const line = (price, qty, extra = {}) => ({ price, qty, ...extra });

describe('pricing.computeTotals', () => {
  it('uses the Kenyan rules: KSh 3,000 free-delivery threshold, 16% VAT, 250 / 450 / 0 delivery', () => {
    expect(FREE_SHIPPING_THRESHOLD).toBe(3000);
    expect(TAX_RATE).toBe(0.16);
    expect(SHIPPING_METHODS.standard.price).toBe(250);
    expect(SHIPPING_METHODS.express.price).toBe(450);
    expect(SHIPPING_METHODS.pickup.price).toBe(0);
  });

  it('returns zeros for an empty cart (and no shipping charge)', () => {
    const t = computeTotals([]);
    expect(t).toMatchObject({ itemCount: 0, subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 });
  });

  it('sums line items and rounds to cents', () => {
    const t = computeTotals([line(850.5, 2), line(6.25, 3)]);
    expect(t.subtotal).toBe(1719.75);
    expect(t.itemCount).toBe(5);
  });

  it('avoids floating point drift', () => {
    const t = computeTotals([line(0.1, 1), line(0.2, 1)]);
    expect(t.subtotal).toBe(0.3);
  });

  it('charges standard shipping below the free threshold', () => {
    const t = computeTotals([line(850, 1)]);
    expect(t.shipping).toBe(250);
    expect(t.freeShippingEarned).toBe(false);
    expect(t.amountToFreeShipping).toBe(2150);
  });

  it('gives free standard shipping at or above the threshold', () => {
    const t = computeTotals([line(3000, 1)]);
    expect(t.shipping).toBe(0);
    expect(t.freeShippingEarned).toBe(true);
    expect(t.amountToFreeShipping).toBe(0);
  });

  it('never discounts express shipping via the threshold', () => {
    const t = computeTotals([line(3400, 1)], { shippingMethod: 'express' });
    expect(t.shipping).toBe(450);
  });

  it('pickup is always free', () => {
    const t = computeTotals([line(150, 1)], { shippingMethod: 'pickup' });
    expect(t.shipping).toBe(0);
  });

  it('falls back to standard for an unknown shipping method', () => {
    const t = computeTotals([line(150, 1)], { shippingMethod: 'boda' });
    expect(t.shippingMethod).toBe('standard');
  });

  it('applies percent promo codes case-insensitively', () => {
    const t = computeTotals([line(1000, 1)], { promoCode: ' karibu10 ' });
    expect(t.discount).toBe(100);
    expect(t.promoCode).toBe('KARIBU10');
  });

  it('PILAU20 takes 20% off and taxes the discounted amount', () => {
    const t = computeTotals([line(1000, 1)], { promoCode: 'PILAU20', shippingMethod: 'pickup' });
    expect(t.discount).toBe(200);
    expect(t.tax).toBe(128); // 800 * 0.16
    expect(t.total).toBe(928);
  });

  it('FREESHIP zeroes standard shipping under the threshold but not express', () => {
    expect(computeTotals([line(850, 1)], { promoCode: 'FREESHIP' }).shipping).toBe(0);
    expect(computeTotals([line(850, 1)], { promoCode: 'FREESHIP', shippingMethod: 'express' }).shipping).toBe(450);
  });

  it('ignores unknown promo codes', () => {
    const t = computeTotals([line(520, 1)], { promoCode: 'NOPE' });
    expect(t.discount).toBe(0);
    expect(t.promoCode).toBeNull();
  });

  it('discount can push a cart below the free-shipping threshold', () => {
    const t = computeTotals([line(3400, 1)], { promoCode: 'PILAU20' }); // 3400 - 680 = 2720
    expect(t.discount).toBe(680);
    expect(t.freeShippingEarned).toBe(false);
    expect(t.shipping).toBe(250);
    expect(t.amountToFreeShipping).toBe(280);
  });

  it('total = subtotal - discount + shipping + tax', () => {
    const t = computeTotals([line(850, 2), line(290, 1)], { promoCode: 'KARIBU10' });
    expect(t.subtotal).toBe(1990);
    expect(t.discount).toBe(199);
    expect(t.shipping).toBe(250);
    expect(t.tax).toBe(286.56); // 1791 * 0.16
    expect(t.total).toBe(2327.56);
    const expected = Math.round((t.subtotal - t.discount + t.shipping + t.tax) * 100) / 100;
    expect(t.total).toBe(expected);
  });

  it('a vatExempt line carries no VAT, and a discount scales the vatable share', () => {
    // Pilau kit x2 (vatable) + Mwea rice x1 (zero-rated): only the 1,700 is taxed.
    const items = [line(850, 2), line(290, 1, { vatExempt: true })];
    const t = computeTotals(items);
    expect(t.subtotal).toBe(1990);
    expect(t.tax).toBe(272); // 1700 * 0.16
    expect(t.shipping).toBe(250);
    expect(t.total).toBe(2512);

    // KARIBU10 spreads 10% across every line, so the vatable share drops to 1,530.
    const d = computeTotals(items, { promoCode: 'KARIBU10' });
    expect(d.discount).toBe(199);
    expect(d.tax).toBe(244.8); // 1700 * (1791 / 1990) * 0.16
    expect(d.total).toBe(2285.8);

    // A basket of only zero-rated staples has no VAT at all.
    const staples = computeTotals([line(170, 2, { vatExempt: true }), line(180, 1, { vatExempt: true })]);
    expect(staples.subtotal).toBe(520);
    expect(staples.tax).toBe(0);
    expect(staples.total).toBe(770);
  });
});

describe('promo helpers', () => {
  it('normalizes codes', () => expect(normalizePromo('  pilau20 ')).toBe('PILAU20'));
  it('finds known codes', () => expect(findPromo('karibu10')).toMatchObject({ code: 'KARIBU10', value: 10 }));
  it('returns null for unknown / empty', () => { expect(findPromo('x')).toBeNull(); expect(findPromo('')).toBeNull(); expect(findPromo(undefined)).toBeNull(); });
});
