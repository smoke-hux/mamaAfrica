import { Router } from 'express';
import { findPromo } from '../../public/js/pricing.js';
import { isObj } from '../lib/validation.js';

export const promoRouter = Router();

/** POST /api/promo/validate { code } */
promoRouter.post('/promo/validate', (req, res) => {
  const body = isObj(req.body) ? req.body : {};
  const promo = typeof body.code === 'string' ? findPromo(body.code) : null;
  if (!promo) return res.status(404).json({ valid: false, error: 'Promo code not recognised' });
  const { code, type, value, label } = promo;
  res.json({ valid: true, promo: { code, type, value, label } });
});
