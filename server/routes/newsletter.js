import { Router } from 'express';
import { isObj, isEmail, text } from '../lib/validation.js';

export const newsletterRouter = Router();
const subscribers = new Set();
const MAX_SUBSCRIBERS = 10_000; // in-memory demo list: bounded so a script cannot grow it forever

/** POST /api/newsletter { email } */
newsletterRouter.post('/newsletter', (req, res) => {
  const body = isObj(req.body) ? req.body : {};
  const email = text(body.email).toLowerCase();
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Validation failed', fields: { email: 'Enter a valid email address' } });
  }
  const already = subscribers.has(email);
  if (!already && subscribers.size < MAX_SUBSCRIBERS) subscribers.add(email);
  res.json({
    ok: true,
    message: already
      ? "You're already on the list. Asante!"
      : "Karibu! You're on the list. Recipes and offers are on their way.",
  });
});
