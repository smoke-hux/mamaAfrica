import { Router } from 'express';
import { queryProducts, getProductBySlug, relatedProducts, categoriesWithCounts } from '../lib/catalog.js';

export const productsRouter = Router();

/** GET /api/products?category=&q=&sort=&tag=&featured=true */
productsRouter.get('/products', (req, res) => {
  const products = queryProducts(req.query);
  res.json({ products, total: products.length });
});

/** GET /api/products/:slug */
productsRouter.get('/products/:slug', (req, res) => {
  const product = getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product, related: relatedProducts(product, 4) });
});

/** GET /api/categories */
productsRouter.get('/categories', (req, res) => {
  res.json({ categories: categoriesWithCounts() });
});
