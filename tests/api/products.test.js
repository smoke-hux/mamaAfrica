import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { loadApp } from './helpers.js';
import { CATEGORY_LABELS } from '../../public/js/format.js';

const catalog = JSON.parse(readFileSync(new URL('../../server/data/products.json', import.meta.url), 'utf8'));
let app;
beforeAll(async () => ({ app } = await loadApp()));

describe('GET /api/health', () => {
  it('reports ok with uptime and no-store caching', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.uptime).toBe('number');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /api/products', () => {
  it('returns the full catalog with a total', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(catalog.length);
    expect(res.body.products).toHaveLength(catalog.length);
    const p = res.body.products[0];
    for (const key of ['id', 'slug', 'name', 'category', 'price', 'stock', 'tags', 'image', 'color']) expect(p).toHaveProperty(key);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/products?category=spices');
    const expected = catalog.filter((p) => p.category === 'spices').length;
    expect(res.body.total).toBe(expected);
    expect(res.body.products.every((p) => p.category === 'spices')).toBe(true);
  });

  it('returns an empty list for an unknown category', async () => {
    const res = await request(app).get('/api/products?category=furniture');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ products: [], total: 0 });
  });

  it('filters by tag', async () => {
    const res = await request(app).get('/api/products?tag=bestseller');
    expect(res.body.total).toBe(catalog.filter((p) => p.tags.includes('bestseller')).length);
    expect(res.body.products.every((p) => p.tags.includes('bestseller'))).toBe(true);
  });

  it('filters featured=true', async () => {
    const res = await request(app).get('/api/products?featured=true');
    expect(res.body.total).toBe(catalog.filter((p) => p.featured).length);
    expect(res.body.products.every((p) => p.featured)).toBe(true);
  });

  it('searches name, description, origin and tags case-insensitively', async () => {
    let res = await request(app).get('/api/products?q=JOLLOF');
    expect(res.body.products.map((p) => p.slug)).toContain('jollof-rice-kit');

    res = await request(app).get('/api/products?q=ethiopia');
    expect(res.body.products.every((p) => p.origin === 'Ethiopia')).toBe(true);
    expect(res.body.total).toBe(2);

    res = await request(app).get('/api/products?q=gluten-free');
    expect(res.body.total).toBe(catalog.filter((p) => p.tags.includes('gluten-free')).length);

    res = await request(app).get('/api/products?q=zzzznothing');
    expect(res.body).toEqual({ products: [], total: 0 });
  });

  it('combines filters (category + q + sort)', async () => {
    const res = await request(app).get('/api/products?category=sauces&q=spicy&sort=price-desc');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.products.every((p) => p.category === 'sauces')).toBe(true);
    const prices = res.body.products.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it('sorts price-asc and price-desc', async () => {
    const asc = (await request(app).get('/api/products?sort=price-asc')).body.products.map((p) => p.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = (await request(app).get('/api/products?sort=price-desc')).body.products.map((p) => p.price);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('sorts by rating (highest first) and name (A-Z)', async () => {
    const ratings = (await request(app).get('/api/products?sort=rating')).body.products.map((p) => p.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    const names = (await request(app).get('/api/products?sort=name')).body.products.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('sorts featured first by default and for sort=featured', async () => {
    for (const url of ['/api/products', '/api/products?sort=featured']) {
      const list = (await request(app).get(url)).body.products;
      const firstNonFeatured = list.findIndex((p) => !p.featured);
      const lastFeatured = list.map((p) => p.featured).lastIndexOf(true);
      expect(lastFeatured).toBeLessThan(firstNonFeatured);
    }
  });

  it('ignores an unknown sort value and odd query shapes', async () => {
    const res = await request(app).get('/api/products?sort=bogus&category[]=x&q[]=y');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(catalog.length);
  });
});

describe('GET /api/products/:slug', () => {
  it('returns the product with up to 4 related items from the same category', async () => {
    const res = await request(app).get('/api/products/suya-spice');
    expect(res.status).toBe(200);
    expect(res.body.product.slug).toBe('suya-spice');
    expect(res.body.related.length).toBeLessThanOrEqual(4);
    expect(res.body.related.every((p) => p.category === 'spices' && p.slug !== 'suya-spice')).toBe(true);
  });

  it('caps related at 4 for a large category', async () => {
    const res = await request(app).get('/api/products/fufu-flour'); // staples has 5 products
    expect(res.body.related).toHaveLength(4);
  });

  it('404s with JSON for an unknown slug', async () => {
    const res = await request(app).get('/api/products/not-a-product');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Product not found' });
  });
});

describe('GET /api/categories', () => {
  it('lists every category with label and count', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    const { categories } = res.body;
    expect(categories.map((c) => c.slug)).toEqual(Object.keys(CATEGORY_LABELS));
    for (const c of categories) {
      expect(c.label).toBe(CATEGORY_LABELS[c.slug]);
      expect(c.count).toBe(catalog.filter((p) => p.category === c.slug).length);
    }
    expect(categories.reduce((n, c) => n + c.count, 0)).toBe(catalog.length);
  });
});

describe('routing & error envelope', () => {
  it('returns JSON 404 for unknown /api routes (any method)', async () => {
    let res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(res.headers['cache-control']).toBe('no-store');
    res = await request(app).post('/api/products');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('returns JSON 400 for malformed JSON bodies', async () => {
    const res = await request(app).post('/api/promo/validate').set('Content-Type', 'application/json').send('{"code":');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error).toBe('Invalid JSON body');
  });

  it('rejects bodies over 100kb with JSON 413', async () => {
    const res = await request(app).post('/api/newsletter').send({ email: 'x'.repeat(120 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
  });

  it('serves the HTML 404 page for unknown non-API routes', async () => {
    const res = await request(app).get('/definitely-not-a-page');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('data-page="404"');
    expect(res.text).toContain('/js/layout.js');
  });

  it('serves static files with .html extension fallback', async () => {
    const res = await request(app).get('/404');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    const css = await request(app).get('/css/base.css');
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/text\/css/);
  });
});
