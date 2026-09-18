/** Shared formatting helpers (pure, framework-free). */

export const CURRENCY = 'KES';
const SYMBOLS = { KES: 'KSh ' };

/**
 * Format a number as Kenyan shillings the way Kenyan shops print it: "KSh 1,250".
 * Whole amounts drop the decimals; anything with cents keeps two (KSh 1,250.50).
 */
export function money(amount, currency = CURRENCY) {
  const n = cents(amount);
  const whole = Number.isInteger(n);
  const num = new Intl.NumberFormat('en-KE', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(n);
  return `${SYMBOLS[currency] ?? `${currency} `}${num}`;
}

/** Round to cents to avoid floating point drift (0.1 + 0.2 issues). */
export function cents(n) {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

/** Human-readable category labels shared by shop filters and product pages. */
export const CATEGORY_LABELS = {
  'meal-kits': 'Meal Kits',
  'restaurants': 'Restaurant Picks',
  'spices': 'Spices & Sauces',
  'staples': 'Staples & Flours',
  'snacks': 'Snacks & Bites',
  'drinks': 'Tea, Coffee & Drinks',
};

export function categoryLabel(slug) {
  return CATEGORY_LABELS[slug] || slug;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
