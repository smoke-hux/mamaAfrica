import { Router } from 'express';
import { isObj, isEmail, text } from '../lib/validation.js';

export const newsletterRouter = Router();
const subscribers = new Set();

/** POST /api/newsletter { email } */
newsletterRouter.post('/newsletter', (req, res) => {
  const body = isObj(req.body) ? req.body : {};
  const email = text(body.email).toLowerCase();
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Validation failed', fields: { email: 'Enter a valid email address' } });
  }
  const already = subscribers.has(email);
  subscribers.add(email);
  res.json({
    ok: true,
    message: already
      ? "You're already on the list. Asante!"
      : "Karibu! You're on the list. Recipes and offers are on their way.",
  });
});
