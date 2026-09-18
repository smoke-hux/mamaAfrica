import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { loadApp } from './helpers.js';
import { PROMO_CODES } from '../../public/js/pricing.js';

let app;
beforeAll(async () => ({ app } = await loadApp()));

describe('POST /api/promo/validate', () => {
  it.each(Object.keys(PROMO_CODES))('accepts %s', async (code) => {
    const res = await request(app).post('/api/promo/validate').send({ code });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    const { code: c, type, value, label } = PROMO_CODES[code];
    expect(res.body.promo).toEqual({ code: c, type, value, label });
  });

  it('is case-insensitive and trims whitespace', async () => {
    const res = await request(app).post('/api/promo/validate').send({ code: '  karibu10 ' });
    expect(res.status).toBe(200);
    expect(res.body.promo.code).toBe('KARIBU10');
  });

  it('404s for unknown, missing or non-string codes', async () => {
    for (const body of [{ code: 'NOPE' }, {}, { code: 42 }, { code: ['KARIBU10'] }, null]) {
      const res = await request(app).post('/api/promo/validate').send(body);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ valid: false, error: 'Promo code not recognised' });
    }
  });

  it('tolerates an array body', async () => {
    const res = await request(app).post('/api/promo/validate').send(['KARIBU10']);
    expect(res.status).toBe(404);
    expect(res.body.valid).toBe(false);
  });
});

describe('POST /api/newsletter', () => {
  it('subscribes a valid email', async () => {
    const res = await request(app).post('/api/newsletter').send({ email: 'fatou@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it('answers the same way for a new and a repeated email (membership is not probeable)', async () => {
    const first = await request(app).post('/api/newsletter').send({ email: 'twice@example.com' });
    const res = await request(app).post('/api/newsletter').send({ email: 'TWICE@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(first.body);
    expect(res.body.message).not.toMatch(/already/i);
  });

  it('400s with a field message for invalid emails', async () => {
    for (const email of ['', 'nope', 'a@b', 'a b@c.com', undefined, 123, { x: 1 }]) {
      const res = await request(app).post('/api/newsletter').send({ email });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.fields.email).toBeTruthy();
    }
  });

  it('400s on an empty body', async () => {
    const res = await request(app).post('/api/newsletter');
    expect(res.status).toBe(400);
    expect(res.body.fields.email).toBeTruthy();
  });
});
