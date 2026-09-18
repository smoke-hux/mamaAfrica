import { Router } from 'express';
import { computeTotals, SHIPPING_METHODS, findPromo } from '../../public/js/pricing.js';
import { cents } from '../../public/js/format.js';
import { decrementStock, restoreStock } from '../lib/catalog.js';
import {
  isObj, text, digits,
  validateItems, validateShippingMethod, validatePromoCode,
  validateCustomer, validateAddress, validatePayment,
} from '../lib/validation.js';
import { newOrderId, getOrder, saveOrder } from '../lib/orders-store.js';

export const ordersRouter = Router();

const DELIVERY_DAYS = { standard: 1, express: 0, pickup: 0 }; // next day, same day, collect today
const NOTES_MAX = 500;

function toLines(validated) {
  return validated.map(({ product: p, qty }) => ({
    id: p.id, slug: p.slug, name: p.name, image: p.image, unit: p.unit,
    price: p.price, vatExempt: Boolean(p.vatExempt), qty, lineTotal: cents(p.price * qty),
  }));
}

function normaliseShipping(v) {
  return typeof v === 'string' && SHIPPING_METHODS[v] ? v : 'standard';
}

/** POST /api/orders/quote { items, shippingMethod, promoCode } */
ordersRouter.post('/orders/quote', (req, res) => {
  const body = isObj(req.body) ? req.body : {};
  const { fields, lines } = validateItems(body.items);
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Validation failed', fields });

  const items = toLines(lines);
  const shippingMethod = normaliseShipping(body.shippingMethod);
  const promoCode = typeof body.promoCode === 'string' ? body.promoCode : '';
  const totals = computeTotals(items, { shippingMethod, promoCode });
  res.json({ items, totals });
});

/** POST /api/orders — full validation, reserve stock, persist. */
ordersRouter.post('/orders', async (req, res, next) => {
  try {
    const body = isObj(req.body) ? req.body : {};
    const fields = {};

    const { fields: itemFields, lines } = validateItems(body.items);
    Object.assign(fields, itemFields);

    const shipErr = validateShippingMethod(body.shippingMethod);
    if (shipErr) fields.shippingMethod = shipErr;
    const promoErr = validatePromoCode(body.promoCode);
    if (promoErr) fields.promoCode = promoErr;

    validateCustomer(body.customer, fields);
    validateAddress(body.address, fields);
    validatePayment(body.payment, fields);

    if (body.notes != null && typeof body.notes !== 'string') fields.notes = 'Notes must be text';
    else if (text(body.notes).length > NOTES_MAX) fields.notes = `Notes must be ${NOTES_MAX} characters or fewer`;

    if (Object.keys(fields).length) return res.status(400).json({ error: 'Validation failed', fields });

    const items = toLines(lines);
    const shippingMethod = normaliseShipping(body.shippingMethod);
    const promo = findPromo(body.promoCode);
    const totals = computeTotals(items, { shippingMethod, promoCode: promo ? promo.code : '' });

    const c = body.customer;
    const a = body.address;
    const p = body.payment;
    const payment = { method: text(p.method) };
    if (payment.method === 'card') payment.last4 = digits(p.cardNumber).slice(-4);
    if (payment.method === 'mobile-money') payment.provider = text(p.provider);

    const createdAt = new Date();
    const eta = new Date(createdAt);
    eta.setUTCDate(eta.getUTCDate() + DELIVERY_DAYS[shippingMethod]);

    const order = {
      id: newOrderId(),
      status: 'confirmed',
      createdAt: createdAt.toISOString(),
      items,
      totals,
      customer: {
        firstName: text(c.firstName), lastName: text(c.lastName),
        email: text(c.email).toLowerCase(), phone: text(c.phone),
      },
      address: {
        line1: text(a.line1), line2: text(a.line2), city: text(a.city), state: text(a.state),
        postalCode: text(a.postalCode), country: text(a.country),
      },
      payment,
      shippingMethod,
      estimatedDelivery: eta.toISOString(),
      notes: text(body.notes),
    };

    // Reserve stock in the same tick as validation: a concurrent request must not
    // pass its own stock check while this order is still being written to disk.
    const reserved = decrementStock(lines.map(({ product, qty }) => ({ id: product.id, qty })));
    try {
      await saveOrder(order);
    } catch (err) {
      restoreStock(reserved);
      throw err;
    }
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

/** GET /api/orders/:id */
ordersRouter.get('/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});
