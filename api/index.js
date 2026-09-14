/**
 * Vercel serverless entry point.
 * Wraps the Express app so `/api/*` requests run as one function; static files in
 * `public/` are served by Vercel's CDN directly. The filesystem on Vercel is
 * read-only except /tmp, so demo orders persist there for the life of the instance.
 */
process.env.ORDERS_FILE ||= '/tmp/mam-orders.json';
const { app } = await import('../server/index.js');
export default app;
