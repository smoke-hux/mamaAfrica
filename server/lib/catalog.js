/**
 * In-memory product catalog.
 * Loaded once from server/data/products.json (READ ONLY on disk); stock is
 * decremented in memory when orders are placed and never written back.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CATEGORY_LABELS } from '../../public/js/format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = path.join(__dirname, '..', 'data', 'products.json');

/** @type {Array<object>} */
const products = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8')).map((p) => ({ ...p, tags: [...(p.tags || [])] }));

const byId = new Map(products.map((p) => [p.id, p]));
const bySlug = new Map(products.map((p) => [p.slug, p]));

export const SORTS = ['featured', 'price-asc', 'price-desc', 'rating', 'name'];

export function allProducts() {
  return products;
}

export function getProductById(id) {
  return byId.get(String(id)) || null;
}

export function getProductBySlug(slug) {
  return bySlug.get(String(slug)) || null;
}

export function relatedProducts(product, max = 4) {
  return products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, max);
}

/**
 * Filter + sort the catalog from query-string style params.
 * @param {{category?: string, q?: string, sort?: string, tag?: string, featured?: string}} params
 */
export function queryProducts(params = {}) {
  const category = str(params.category).toLowerCase();
  const q = str(params.q).toLowerCase();
  const tag = str(params.tag).toLowerCase();
  const sort = SORTS.includes(str(params.sort)) ? str(params.sort) : 'featured';
  const featuredOnly = str(params.featured).toLowerCase() === 'true';

  let list = products.filter((p) => {
    if (category && p.category !== category) return false;
    if (tag && !p.tags.some((t) => t.toLowerCase() === tag)) return false;
    if (featuredOnly && !p.featured) return false;
    if (q && !matchesQuery(p, q)) return false;
    return true;
  });

  const cmp = {
    'featured': (a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating || b.reviews - a.reviews,
    'price-asc': (a, b) => a.price - b.price || a.name.localeCompare(b.name),
    'price-desc': (a, b) => b.price - a.price || a.name.localeCompare(b.name),
    'rating': (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    'name': (a, b) => a.name.localeCompare(b.name),
  }[sort];
  // Stable sort: decorate with original index so ties keep catalog order.
  list = list
    .map((p, i) => [p, i])
    .sort(([a, ia], [b, ib]) => cmp(a, b) || ia - ib)
    .map(([p]) => p);

  return list;
}

function matchesQuery(p, q) {
  const words = q.split(/\s+/).filter(Boolean);
  const hay = [p.name, p.short, p.description, p.origin, p.category, CATEGORY_LABELS[p.category] || '', ...p.tags]
    .join(' ')
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Categories with counts, in the canonical label order. */
export function categoriesWithCounts() {
  return Object.entries(CATEGORY_LABELS).map(([slug, label]) => ({
    slug,
    label,
    count: products.filter((p) => p.category === slug).length,
  }));
}

/** Decrement in-memory stock for a set of validated {id, qty} lines. */
export function decrementStock(lines) {
  for (const { id, qty } of lines) {
    const p = byId.get(id);
    if (p) p.stock = Math.max(0, p.stock - qty);
  }
}

/** Give back stock reserved by decrementStock (the order could not be saved). */
export function restoreStock(lines) {
  for (const { id, qty } of lines) {
    const p = byId.get(id);
    if (p) p.stock += qty;
  }
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}
