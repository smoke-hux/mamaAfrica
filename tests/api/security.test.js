import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { rmSync } from 'node:fs';
import express from 'express';
import { loadApp, validOrder } from './helpers.js';
import { rateLimit, SECURITY_HEADERS, CSP } from '../../server/lib/security.js';

let app, dir;
beforeAll(async () => ({ app, dir } = await loadApp()));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('security headers', () => {
  it('sends hardening headers on pages and API responses', async () => {
    for (const path of ['/', '/api/health', '/api/nope', '/nope']) {
      const res = await request(app).get(path);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(res.headers[k.toLowerCase()], `${k} on ${path}`).toBe(v);
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  it('only sends HSTS when the request came over TLS', async () => {
    expect((await request(app).get('/api/health')).headers['strict-transport-security']).toBeUndefined();
    const res = await request(app).get('/api/health').set('x-forwarded-proto', 'https');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=31536000/);
  });

  it('CSP blocks inline and third-party scripts and framing', () => {
    expect(CSP).toMatch(/script-src 'self'(;|$)/);
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("object-src 'none'");
  });

  it('vercel.json sends the same headers from the CDN', async () => {
    const { default: cfg } = await import('../../vercel.json', { with: { type: 'json' } });
    const all = cfg.headers.find((h) => h.source === '/(.*)');
    const map = Object.fromEntries(all.headers.map((h) => [h.key, h.value]));
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(map[k], k).toBe(v);
    expect(map['Strict-Transport-Security']).toMatch(/max-age=31536000/);
  });
});

describe('rate limiter', () => {
  /** Turn the limiter on for one test; returns a restore function. trust=false keeps x-real-ip untrusted. */
  function withLiveLimiter(trust = true) {
    const saved = { RATE_LIMIT: process.env.RATE_LIMIT, TRUST_PROXY: process.env.TRUST_PROXY };
    delete process.env.RATE_LIMIT;
    if (trust) process.env.TRUST_PROXY = '1'; else delete process.env.TRUST_PROXY;
    return () => {
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    };
  }

  function limitedApp(opts) {
    const a = express();
    a.get('/x', rateLimit(opts), (req, res) => res.json({ ok: true }));
    return a;
  }

  it('allows max requests per window, then 429s with Retry-After, keyed by x-real-ip', async () => {
    const saved = withLiveLimiter();
    try {
      let t = 1_000_000;
      const a = limitedApp({ max: 3, windowMs: 60_000, name: 'lookups', now: () => t });
      for (let i = 0; i < 3; i++) expect((await request(a).get('/x').set('x-real-ip', '1.1.1.1')).status).toBe(200);
      const blocked = await request(a).get('/x').set('x-real-ip', '1.1.1.1');
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBe('60');
      expect(blocked.body.error).toMatch(/Too many lookups/);
      // another client is unaffected
      expect((await request(a).get('/x').set('x-real-ip', '2.2.2.2')).status).toBe(200);
      // window rolls over
      t += 60_001;
      expect((await request(a).get('/x').set('x-real-ip', '1.1.1.1')).status).toBe(200);
    } finally { saved(); }
  });

  it('ignores x-real-ip unless the host is trusted to set it', async () => {
    const restore = withLiveLimiter(false);
    try {
      const a = limitedApp({ max: 2 });
      // every request pretends to be a new client, but they all share the socket address
      for (let i = 0; i < 2; i++) expect((await request(a).get('/x').set('x-real-ip', `10.0.0.${i}`)).status).toBe(200);
      expect((await request(a).get('/x').set('x-real-ip', '10.0.0.99')).status).toBe(429);
    } finally { restore(); }
  });

  it('is wired to order creation and lookup in the real app', async () => {
    const saved = withLiveLimiter();
    try {
      const ip = '9.9.9.9';
      let last;
      for (let i = 0; i < 31; i++) last = await request(app).get('/api/orders/MAM-NOPE00').set('x-real-ip', ip);
      expect(last.status).toBe(429);
      for (let i = 0; i < 21; i++) last = await request(app).post('/api/orders').set('x-real-ip', ip).send(validOrder({ items: [{ id: 'p07', qty: 1 }] }));
      expect(last.status).toBe(429);
      // an unrelated client still gets normal answers
      expect((await request(app).get('/api/orders/MAM-NOPE00').set('x-real-ip', '8.8.8.8')).status).toBe(404);
    } finally { saved(); }
  });
});
