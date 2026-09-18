/** Shared formatting helpers (pure, framework-free). */

export const CURRENCY = 'KES';
const SYMBOLS = { KES: 'KSh ' };
// Built once: an Intl.NumberFormat is costly to construct and money() runs for every line of every render.
const WHOLE = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const FRACTIONAL = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Format a number as Kenyan shillings the way Kenyan shops print it: "KSh 1,250".
 * Whole amounts drop the decimals; anything with cents keeps two (KSh 1,250.50).
 */
export function money(amount, currency = CURRENCY) {
  const n = cents(amount);
  const num = (Number.isInteger(n) ? WHOLE : FRACTIONAL).format(n);
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
