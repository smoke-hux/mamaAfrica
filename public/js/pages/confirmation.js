/** Order confirmation — fetch by id (sessionStorage fallback), celebrate. */
import { api } from '/js/api.js';
import { money, escapeHtml } from '/js/format.js';
import { SHIPPING_METHODS } from '/js/pricing.js';
import { MOBILE_MONEY_PROVIDERS } from '/js/validation.js';

const LAST_ORDER_KEY = 'mam.lastOrder';
const $ = (sel) => document.querySelector(sel);

const root = $('#confirmation');
const view = { loading: $('#confirm-loading'), ok: $('#confirm-view'), notFound: $('#confirm-notfound') };

const COUNTRY_NAMES = {
  KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda', ET: 'Ethiopia', ZA: 'South Africa',
  GB: 'United Kingdom', US: 'United States', AE: 'United Arab Emirates', CA: 'Canada', DE: 'Germany', FR: 'France',
  NL: 'Netherlands', IE: 'Ireland', AU: 'Australia',
};
const countryName = (code) => COUNTRY_NAMES[String(code || '').toUpperCase()] || code || '';

function fmtDate(iso, opts = { weekday: 'long', month: 'long', day: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

function readLastOrder() {
  try { return JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) || 'null'); } catch { return null; }
}

function show(which) {
  Object.entries(view).forEach(([k, el]) => { el.hidden = k !== which; });
  root.setAttribute('aria-busy', 'false');
}

function paymentLabel(p = {}) {
  if (p.method === 'card') return p.last4 ? `Card ending in ${escapeHtml(p.last4)}` : 'Card';
  if (p.method === 'mobile-money') {
    const prov = MOBILE_MONEY_PROVIDERS.find((x) => x.id === p.provider)?.label || p.provider || 'Mobile Money';
    return `Mobile Money · ${escapeHtml(prov)}`;
  }
  if (p.method === 'cash-on-delivery') return 'Cash on delivery';
  return escapeHtml(p.method || '—');
}

function render(order) {
  const c = order.customer || {};
  const a = order.address || {};
  const t = order.totals || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const count = items.reduce((n, it) => n + Number(it.qty || 0), 0);

  $('#confirm-lead').textContent = c.email
    ? `Thank you${c.firstName ? `, ${c.firstName}` : ''}. We've sent a receipt to ${c.email} and we're packing your ${count === 1 ? 'item' : `${count} items`} now.`
    : `Thank you${c.firstName ? `, ${c.firstName}` : ''}. We're packing your order now.`;

  $('#order-id').textContent = order.id || '';
  $('#order-date').textContent = order.createdAt ? `Placed ${fmtDate(order.createdAt, { month: 'long', day: 'numeric', year: 'numeric' })}` : '';

  const method = t.shippingMethod || order.shippingMethod;
  const isPickup = method === 'pickup';
  $('#eta-label').textContent = isPickup ? 'Ready for pickup' : 'Estimated delivery';
  // Standard is next day; express and pickup are same day.
  $('#eta-date').textContent = order.estimatedDelivery ? fmtDate(order.estimatedDelivery) : (method === 'standard' ? 'Tomorrow' : 'Today');

  $('#confirm-items').innerHTML = items.length ? items.map((it) => `
    <div class="confirm-item">
      <span>
        <span class="confirm-item__name">${escapeHtml(it.name || it.slug || it.id)}</span>
        <span class="confirm-item__meta">${it.qty} × ${money(it.price)}</span>
      </span>
      <span class="confirm-item__total">${money(it.lineTotal ?? Number(it.price) * Number(it.qty))}</span>
    </div>`).join('') : '<p class="muted">No line items were recorded for this order.</p>';

  $('#sum-subtotal').textContent = money(t.subtotal);
  const disc = Number(t.discount || 0);
  $('#sum-discount-row').hidden = !(disc > 0);
  $('#sum-discount-label').textContent = t.promoCode ? `Discount (${t.promoCode})` : 'Discount';
  $('#sum-discount').textContent = `–${money(disc)}`;
  const shipMethod = SHIPPING_METHODS[t.shippingMethod]?.label || t.shippingMethod || 'Standard';
  $('#sum-shipping-label').textContent = 'Delivery';
  $('#sum-shipping').innerHTML = Number(t.shipping || 0) === 0 ? '<span class="summary__free">Free</span>' : money(t.shipping);
  $('#sum-tax').textContent = money(t.tax);
  $('#sum-total').textContent = money(t.total);

  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  $('#confirm-address').innerHTML = `
    ${name ? `<strong>${escapeHtml(name)}</strong>` : ''}
    ${a.line1 ? `${escapeHtml(a.line1)}<br>` : ''}
    ${a.line2 ? `${escapeHtml(a.line2)}<br>` : ''}
    ${[a.city, a.state, a.postalCode].filter(Boolean).map(escapeHtml).join(', ')}<br>
    ${escapeHtml(countryName(a.country))}`;

  $('#confirm-payment').innerHTML = paymentLabel(order.payment);
  $('#confirm-shipping').textContent = shipMethod;
  $('#confirm-contact').innerHTML = [c.email, c.phone].filter(Boolean).map(escapeHtml).join('<br>') || '—';
  const notes = String(order.notes || '').trim();
  $('#confirm-notes-wrap').hidden = !notes;
  $('#confirm-notes').textContent = notes;

  document.title = `Order ${order.id || ''} confirmed | Mama Afrika Market`;
  show('ok');
}

async function boot() {
  const id = new URLSearchParams(window.location.search).get('id')?.trim();
  const last = readLastOrder();

  if (!id) {
    if (last?.id) { render(last); return; }
    $('#notfound-text').textContent = 'There is no order number in this link. If you just placed an order, check your confirmation email.';
    show('notFound');
    return;
  }

  try {
    const res = await api.order(id);
    if (res?.order) { render(res.order); return; }
    throw Object.assign(new Error('Order not found'), { status: 404 });
  } catch (err) {
    if (last && String(last.id).toUpperCase() === id.toUpperCase()) { render(last); return; }
    if (err.status === 404) {
      $('#notfound-text').textContent = `We couldn't find an order with the number ${id}. Check the link in your confirmation email, or head back to the shop.`;
    } else {
      $('#notfound-title').textContent = "We couldn't load your order";
      $('#notfound-text').textContent = 'The store is having trouble right now. Your order is safe, please try again in a moment.';
    }
    show('notFound');
  }
}

boot();
