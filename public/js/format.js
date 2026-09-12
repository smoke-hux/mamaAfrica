/** Shared formatting helpers (pure, framework-free). */

/** Format a number as US dollars: 18.5 -> "$18.50". */
export function money(amount, currency = 'USD') {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

/** Round to cents to avoid floating point drift (0.1 + 0.2 issues). */
export function cents(n) {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

/** Human-readable category labels shared by shop filters and product pages. */
export const CATEGORY_LABELS = {
  'meal-kits': 'Meal Kits',
  'spices': 'Spices & Rubs',
  'sauces': 'Sauces & Condiments',
  'staples': 'Staples & Grains',
  'snacks': 'Snacks',
  'drinks': 'Drinks & Teas',
};

export function categoryLabel(slug) {
  return CATEGORY_LABELS[slug] || slug;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
