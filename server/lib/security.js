/**
 * Security middleware: browser hardening headers and a small in-memory rate limiter.
 * No dependencies, like the rest of the app. On Vercel the static files never reach
 * Express, so vercel.json repeats the same headers for the CDN; keep the two in sync.
 */

/** Content Security Policy. No inline scripts exist; inline `style` attributes carry the product tints. */
// Google Maps needs its script, tiles (images from several Google hosts), and XHR for tiles and
// places. Everything else stays first-party. Keep this in step with the copy in vercel.json.
const GOOGLE_SCRIPT = 'https://maps.googleapis.com';
const GOOGLE_IMG = 'https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com https://*.google.com';
const GOOGLE_CONNECT = 'https://maps.googleapis.com https://*.googleapis.com';

export const CSP = [
  "default-src 'self'",
  `script-src 'self' ${GOOGLE_SCRIPT}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${GOOGLE_IMG}`,
  `connect-src 'self' ${GOOGLE_CONNECT}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export function securityHeaders(req, res, next) {
  res.set(SECURITY_HEADERS);
  // HSTS only makes sense over TLS; sending it on plain localhost would break local dev in some browsers.
  // Behind chained proxies x-forwarded-proto is a list ("https, http"); the first entry is the client's scheme.
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (req.secure || proto === 'https') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/**
 * Client address. Vercel overwrites x-real-ip from the connection, so it cannot be spoofed there;
 * anywhere else the header is client-controlled and trusting it would let a caller pick a fresh
 * bucket per request. Only trust it on Vercel (VERCEL=1) or when TRUST_PROXY=1 says the host sets it.
 */
export function clientIp(req) {
  if (process.env.VERCEL || process.env.TRUST_PROXY) {
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real) return real;
  }
  return req.ip || 'unknown';
}

/**
 * Fixed-window rate limiter keyed by client IP. Per process, so on Vercel it is per instance:
 * a slow-down, not a wall (use the Vercel WAF for a real one). RATE_LIMIT=off disables it (tests).
 * @param {{ max: number, windowMs?: number, name?: string, now?: () => number }} opts
 */
export function rateLimit({ max, windowMs = 60_000, name = 'requests', now = Date.now }) {
  const hits = new Map(); // ip -> { count, resetAt }
  let nextSweep = 0;
  return (req, res, next) => {
    if (process.env.RATE_LIMIT === 'off') return next();
    const t = now();
    // Drop expired buckets at most once per window: O(n) per window instead of O(n) per request.
    if (t >= nextSweep) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      nextSweep = t + windowMs;
    }
    const ip = clientIp(req);
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= t) { entry = { count: 0, resetAt: t + windowMs }; hits.set(ip, entry); }
    entry.count += 1;
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      const retry = Math.max(1, Math.ceil((entry.resetAt - t) / 1000));
      res.set('Retry-After', String(retry));
      return res.status(429).json({ error: `Too many ${name}. Please wait ${retry}s and try again.` });
    }
    next();
  };
}
