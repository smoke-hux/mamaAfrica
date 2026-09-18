import { describe, it, expect } from 'vitest';
import { money, cents, categoryLabel, escapeHtml } from '../../public/js/format.js';

describe('format helpers', () => {
  it('money formats Kenyan shillings the local way', () => {
    expect(money(1250)).toBe('KSh 1,250');
    expect(money(0)).toBe('KSh 0');
    expect(money('7.25')).toBe('KSh 7.25');
    expect(money(1250.5)).toBe('KSh 1,250.50');
    expect(money(undefined)).toBe('KSh 0');
    expect(money(10, 'USD')).toBe('USD 10');
  });
  it('cents rounds to 2dp', () => {
    expect(cents(1.005)).toBe(1.01);
    expect(cents(0.1 + 0.2)).toBe(0.3);
    expect(cents('x')).toBe(0);
  });
  it('categoryLabel maps known slugs and passes unknown through', () => {
    expect(categoryLabel('meal-kits')).toBe('Meal Kits');
    expect(categoryLabel('mystery')).toBe('mystery');
  });
  it('escapeHtml neutralises markup', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
  });
});
