/**
 * Mama Afrika Market — Express 5 app.
 * Exports `app` for tests; listens only when run directly (`node server/index.js`).
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { productsRouter } from './routes/products.js';
import { ordersRouter } from './routes/orders.js';
import { promoRouter } from './routes/promo.js';
import { newsletterRouter } from './routes/newsletter.js';
import { securityHeaders, rateLimit } from './lib/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export const app = express();
app.disable('x-powered-by');
app.set('etag', false);
app.use(securityHeaders);

// ---- API -------------------------------------------------------------------
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', express.json({ limit: '100kb' }));

// Rate limits per client IP. Order lookups return customer details for a bare order number,
// so guessing numbers must be slow; the write endpoints are throttled against spam.
app.post('/api/orders', rateLimit({ max: 20, name: 'orders' }));
app.get('/api/orders/:id', rateLimit({ max: 30, name: 'order lookups' }));
app.post(['/api/orders/quote', '/api/promo/validate', '/api/newsletter'], rateLimit({ max: 60, name: 'requests' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});
app.use('/api', productsRouter);
app.use('/api', promoRouter);
app.use('/api', ordersRouter);
app.use('/api', newsletterRouter);

// Unknown /api/* → JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Static site -----------------------------------------------------------
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Non-API unknown routes → HTML 404 page
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

// ---- Errors: always JSON, never HTML --------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = Number(err.status || err.statusCode) || 500;
  let message = 'Internal server error';
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Request body too large'; }
  else if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') { status = 415; message = 'Unsupported content encoding'; }
  else if (status < 500 && err.expose !== false && err.message) message = err.message;
  if (status >= 500) console.error('[error]', err);
  if (res.headersSent) return;
  res.status(status).set('Cache-Control', 'no-store').json({ error: message });
});

// ---- Boot ------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => {
    const line = `Mama Afrika Market is open at http://localhost:${PORT}`;
    const bar = '─'.repeat(line.length + 4);
    console.log(`\n  ┌${bar}┐\n  │  ${line}  │\n  │  ${'Taste the whole continent, delivered.'.padEnd(line.length)}  │\n  └${bar}┘\n`);
  });
}

export default app;
