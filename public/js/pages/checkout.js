/** Checkout page — single-page 3-step form with inline validation and live summary. */
import { cart } from '/js/cart.js';
import { api } from '/js/api.js';
import { syncCartWithCatalog } from '/js/cart-sync.js';
import { money, escapeHtml } from '/js/format.js';
import { SHIPPING_METHODS, findPromo } from '/js/pricing.js';
import {
  validateCheckout, validateCustomer, validateAddress, validatePayment,
  formatCardNumber, formatExpiry, digitsOnly, paymentPayload,
} from '/js/validation.js';

const CONTACT_KEY = 'mam.checkout.contact';
const LAST_ORDER_KEY = 'mam.lastOrder';

/* Empty cart → nothing to check out. */
if (cart.count() === 0) {
  window.location.replace('/cart.html');
}

const SCROLL = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const toast = (message, opts) => window.MAM?.toast?.(message, opts);

const form = $('#checkout-form');
const els = {
  status: $('#form-status'),
  placeOrder: $('#place-order'),
  placeOrderTotal: $('#place-order-total'),
  shippingMethods: $('#shipping-methods'),
  panels: $$('.pay-panel'),
  payCards: $$('.pay-card'),
  summaryDetails: $('#summary-details'),
  summaryToggleTotal: $('#summary-toggle-total'),
  summaryCount: $('#summary-count'),
  summaryItems: $('#summary-items'),
  summaryNote: $('#summary-note'),
  subtotal: $('#sum-subtotal'),
  discountRow: $('#sum-discount-row'),
  discountLabel: $('#sum-discount-label'),
  discount: $('#sum-discount'),
  shippingLabel: $('#sum-shipping-label'),
  shipping: $('#sum-shipping'),
  tax: $('#sum-tax'),
  total: $('#sum-total'),
  steps: $$('.stepper__item'),
  sections: $$('.co-section[data-step]'),
};

/** Field path (server-style) → input id. Radios map to their group name. */
const PATH_TO_ID = {
  'customer.firstName': 'firstName', 'customer.lastName': 'lastName', 'customer.email': 'email', 'customer.phone': 'phone',
  'address.line1': 'line1', 'address.line2': 'line2', 'address.city': 'city', 'address.state': 'state',
  'address.postalCode': 'postalCode', 'address.country': 'country',
  'payment.method': 'method', 'payment.cardNumber': 'cardNumber', 'payment.cardName': 'cardName',
  'payment.expiry': 'expiry', 'payment.cvc': 'cvc', 'payment.provider': 'provider', 'payment.mobileNumber': 'mobileNumber',
  'shippingMethod': 'shippingMethod', 'notes': 'notes',
};
const ID_TO_PATH = Object.fromEntries(Object.entries(PATH_TO_ID).map(([p, id]) => [id, p]));
/** Server errors about cart lines come back as `items`, `items[0].qty`, … and have no form field. */
const isItemPath = (path) => path.startsWith('items');
const STEP_OF_PATH = (path) => (path.startsWith('customer.') ? 'contact' : path.startsWith('address.') || path === 'shippingMethod' || path === 'notes' ? 'shipping' : 'payment');

/* ------------------------------------------------------------------ */
/* Read / write form state                                             */
/* ------------------------------------------------------------------ */

function readForm() {
  const v = (id) => ($(`#${id}`)?.value ?? '').trim();
  const method = form.elements['payment.method']?.value || '';
  return {
    customer: { firstName: v('firstName'), lastName: v('lastName'), email: v('email'), phone: v('phone') },
    address: { line1: v('line1'), line2: v('line2'), city: v('city'), state: v('state'), postalCode: v('postalCode'), country: v('country') },
    payment: {
      method,
      cardNumber: v('cardNumber'), cardName: v('cardName'), expiry: v('expiry'), cvc: v('cvc'),
      provider: v('provider'), mobileNumber: v('mobileNumber'),
    },
    notes: v('notes'),
  };
}

function prefill() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(CONTACT_KEY) || 'null'); } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return;
  // Only fill empty inputs so typed text is never overwritten; a <select> at its default is as good as empty.
  const set = (id, val) => { const el = $(`#${id}`); if (el && val != null && (el.value === '' || el.tagName === 'SELECT')) el.value = String(val); };
  const c = saved.customer || {};
  const a = saved.address || {};
  set('firstName', c.firstName); set('lastName', c.lastName); set('email', c.email); set('phone', c.phone);
  set('line1', a.line1); set('line2', a.line2); set('city', a.city); set('state', a.state); set('postalCode', a.postalCode); set('country', a.country);
}

function rememberContact(data) {
  try {
    localStorage.setItem(CONTACT_KEY, JSON.stringify({ customer: data.customer, address: data.address }));
  } catch { /* private mode */ }
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

function errorElFor(id) { return $(`#${id}-error`); }

function setFieldError(path, message) {
  const id = PATH_TO_ID[path] || path.split('.').pop();
  const errorEl = errorElFor(id);
  const input = $(`#${id}`);
  const field = errorEl?.closest('.field') || input?.closest('.field');
  if (errorEl) errorEl.textContent = message || '';
  if (field) field.classList.toggle('has-error', Boolean(message));
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function clearAllErrors() {
  Object.keys(PATH_TO_ID).forEach((p) => setFieldError(p, ''));
  setStatus('');
}

function setStatus(message) {
  els.status.textContent = message || '';
  els.status.hidden = !message;
}

/** Apply a `{ path: message }` map. Returns the first invalid input (in DOM order). */
function applyErrors(fields) {
  const paths = Object.keys(fields);
  // Item paths never have an input, and `items[0]` is not a valid selector fragment, so keep them out of the DOM lookups.
  paths.forEach((p) => { if (!isItemPath(p)) setFieldError(p, fields[p]); });
  const unmapped = paths.filter((p) => isItemPath(p) || (!PATH_TO_ID[p] && !$(`#${p.split('.').pop()}-error`)));
  // Item errors already name the product ("Only 3 left in stock for …"); the `items[0].qty` path is noise.
  if (unmapped.length) setStatus(unmapped.map((p) => (isItemPath(p) ? fields[p] : `${p}: ${fields[p]}`)).join(' · '));
  const inputs = $$('.input, input[type="radio"]', form).filter((el) => {
    const id = el.id || '';
    const path = ID_TO_PATH[id] || (el.name === 'payment.method' ? 'payment.method' : null);
    return path && fields[path] && !el.closest('[hidden]');
  });
  return inputs[0] || null;
}

/** Only the currently visible payment fields count. */
function relevantFields(fields, data) {
  const out = {};
  for (const [path, msg] of Object.entries(fields)) {
    if (path.startsWith('payment.') && path !== 'payment.method') {
      const cardOnly = ['payment.cardNumber', 'payment.cardName', 'payment.expiry', 'payment.cvc'];
      const mmOnly = ['payment.provider', 'payment.mobileNumber'];
      if (cardOnly.includes(path) && data.payment.method !== 'card') continue;
      if (mmOnly.includes(path) && data.payment.method !== 'mobile-money') continue;
    }
    out[path] = msg;
  }
  return out;
}

function validateSingle(path) {
  const data = readForm();
  const { fields } = validateCheckout(data);
  const msg = relevantFields(fields, data)[path] || '';
  setFieldError(path, msg);
  updateStepDone();
  if (!msg && !els.status.hidden && !$('.field.has-error', form)) setStatus('');
  return !msg;
}

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

function setActiveStep(step) {
  els.steps.forEach((li) => {
    const active = li.dataset.step === step;
    li.classList.toggle('is-active', active);
    const link = $('a', li);
    if (active) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current');
  });
}

function updateStepDone() {
  const data = readForm();
  const done = {
    contact: Object.keys(validateCustomer(data.customer)).length === 0,
    shipping: Object.keys(validateAddress(data.address)).length === 0,
    payment: Object.keys(relevantFields(validatePayment(data.payment), data)).length === 0,
  };
  els.steps.forEach((li) => {
    const isDone = done[li.dataset.step] && !li.classList.contains('is-active');
    li.classList.toggle('is-done', Boolean(isDone));
    const num = $('.stepper__num', li);
    const n = { contact: '1', shipping: '2', payment: '3' }[li.dataset.step];
    num.innerHTML = isDone ? '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' : n;
  });
}

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]) { setActiveStep(visible[0].target.dataset.step); updateStepDone(); }
  }, { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
  els.sections.forEach((s) => io.observe(s));
}
form.addEventListener('focusin', (e) => {
  const section = e.target.closest('.co-section[data-step]');
  if (section) { setActiveStep(section.dataset.step); updateStepDone(); }
});
els.steps.forEach((li) => {
  $('a', li).addEventListener('click', (e) => {
    e.preventDefault();
    const target = $(`#step-${li.dataset.step}`);
    target?.scrollIntoView({ behavior: SCROLL, block: 'start' });
    const first = $('.input, input[type="radio"]', target);
    setActiveStep(li.dataset.step);
    setTimeout(() => first?.focus({ preventScroll: true }), 350);
  });
});

/* ------------------------------------------------------------------ */
/* Payment method cards                                                */
/* ------------------------------------------------------------------ */

function syncPaymentMethod() {
  const method = form.elements['payment.method']?.value || 'card';
  els.payCards.forEach((card) => card.classList.toggle('is-selected', $('input', card).checked));
  els.panels.forEach((panel) => { panel.hidden = panel.dataset.method !== method; });
  // Errors from a now-hidden method are stale.
  ['payment.cardNumber', 'payment.cardName', 'payment.expiry', 'payment.cvc', 'payment.provider', 'payment.mobileNumber']
    .forEach((p) => setFieldError(p, ''));
  updateStepDone();
}
$$('input[name="payment.method"]', form).forEach((r) => r.addEventListener('change', syncPaymentMethod));

/* Card number / expiry / cvc auto-formatting */
const cardNumber = $('#cardNumber');
cardNumber.addEventListener('input', () => {
  const formatted = formatCardNumber(cardNumber.value);
  if (cardNumber.value !== formatted) {
    cardNumber.value = formatted;
    cardNumber.setSelectionRange(formatted.length, formatted.length);
  }
});
const expiry = $('#expiry');
expiry.addEventListener('input', () => {
  const formatted = formatExpiry(expiry.value);
  if (expiry.value !== formatted) { expiry.value = formatted; expiry.setSelectionRange(formatted.length, formatted.length); }
});
const cvc = $('#cvc');
cvc.addEventListener('input', () => { const d = digitsOnly(cvc.value).slice(0, 4); if (cvc.value !== d) cvc.value = d; });

/* ------------------------------------------------------------------ */
/* Shipping methods + summary                                          */
/* ------------------------------------------------------------------ */

/** Standard is free when the discounted subtotal earns it or FREESHIP is applied, whichever method is selected now. */
function shippingIsFree(m, totals) {
  return m.price === 0 || (m.id === 'standard' && totals.itemCount > 0 && (totals.freeShippingEarned || totals.promoCode === 'FREESHIP'));
}
/** innerHTML replaces the radio that has focus and the browser silently drops focus to <body>; put it back. */
function keepRadioFocus(container, render) {
  const active = document.activeElement;
  const value = active?.name === 'shippingMethod' && container.contains(active) ? active.value : null;
  render();
  if (value) container.querySelector(`input[name="shippingMethod"][value="${value}"]`)?.focus({ preventScroll: true });
}
function renderShippingMethods(state) {
  const { totals } = state;
  const current = state.shippingMethod;
  keepRadioFocus(els.shippingMethods, () => { els.shippingMethods.innerHTML = Object.values(SHIPPING_METHODS).map((m) => {
    const free = shippingIsFree(m, totals);
    return `
      <label class="radio-row ${m.id === current ? 'is-selected' : ''}">
        <input type="radio" name="shippingMethod" value="${m.id}" ${m.id === current ? 'checked' : ''}>
        <span class="radio-row__label">${escapeHtml(m.label)}</span>
        <span class="radio-row__price ${free ? 'is-free' : ''}">${free ? 'Free' : money(m.price)}</span>
      </label>`;
  }).join(''); });
}
els.shippingMethods.addEventListener('change', (e) => {
  const input = e.target.closest('input[name="shippingMethod"]');
  if (input) cart.setShipping(input.value);
});

function renderSummary(state, totalsOverride) {
  const t = totalsOverride || state.totals;
  const n = state.count;
  els.summaryCount.textContent = n ? `${n} ${n === 1 ? 'item' : 'items'}` : '';
  els.summaryItems.innerHTML = state.items.map((l) => `
    <div class="summary__item">
      <span class="summary__thumb" style="background:${escapeHtml(l.color || '')}22">
        <img src="${escapeHtml(l.image || '')}" alt="" width="56" height="56">
        <span class="summary__qty" aria-label="Quantity ${l.qty}">${l.qty}</span>
      </span>
      <span><span class="summary__item-name">${escapeHtml(l.name)}</span><span class="summary__item-unit">${escapeHtml(l.unit || '')}</span></span>
      <span class="summary__item-price">${money(l.price * l.qty)}</span>
    </div>`).join('');

  els.subtotal.textContent = money(t.subtotal);
  els.discountRow.hidden = !(t.discount > 0);
  const promo = t.promoCode ? findPromo(t.promoCode) : null;
  els.discountLabel.textContent = t.promoCode ? `Discount (${t.promoCode})` : 'Discount';
  els.discount.textContent = `–${money(t.discount)}`;
  const shipLabel = { standard: 'Standard', express: 'Express', pickup: 'Pickup' }[t.shippingMethod] || 'Shipping';
  els.shippingLabel.textContent = `Delivery · ${shipLabel}`;
  els.shipping.innerHTML = t.shipping === 0 ? '<span class="summary__free">Free</span>' : money(t.shipping);
  els.tax.textContent = money(t.tax);
  els.total.textContent = money(t.total);
  els.summaryToggleTotal.textContent = money(t.total);
  els.placeOrderTotal.textContent = money(t.total);
  els.summaryNote.textContent = promo && promo.type === 'shipping'
    ? 'FREESHIP applied. Standard delivery is on us.'
    : t.freeShippingEarned && t.shippingMethod === 'standard' ? 'You qualified for free standard delivery.' : '';
}

function renderAll(state) {
  renderShippingMethods(state);
  renderSummary(state);
}

/* Summary collapses on mobile, always open on desktop */
const wide = window.matchMedia('(min-width: 960px)');
function syncSummaryOpen() { if (wide.matches) els.summaryDetails.open = true; }
wide.addEventListener?.('change', syncSummaryOpen);
syncSummaryOpen();

/* ------------------------------------------------------------------ */
/* Validation wiring                                                   */
/* ------------------------------------------------------------------ */

form.addEventListener('focusout', (e) => {
  const el = e.target;
  if (!el.matches?.('.input')) return;
  const path = ID_TO_PATH[el.id];
  if (!path) return;
  // Only validate a field once the user has typed in it or leaves it with content.
  if (el.value.trim() !== '' || el.dataset.touched === 'true') validateSingle(path);
  el.dataset.touched = 'true';
});
form.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.matches?.('.input')) return;
  const path = ID_TO_PATH[el.id];
  if (path && el.closest('.field')?.classList.contains('has-error')) validateSingle(path);
});

/* ------------------------------------------------------------------ */
/* Submit                                                              */
/* ------------------------------------------------------------------ */

let submitting = false;

function setLoading(on) {
  submitting = on;
  els.placeOrder.classList.toggle('is-loading', on);
  els.placeOrder.disabled = on;
  els.placeOrder.setAttribute('aria-busy', on ? 'true' : 'false');
  form.setAttribute('aria-busy', on ? 'true' : 'false');
}

/**
 * The server rejected the cart lines, almost always stock that sold while the shopper was filling in
 * the form: fix the cart from the live catalog, then say what happened and what to do next.
 * (If the sync empties the cart, the cart:change listener below leaves for the cart page with the notices.)
 */
async function explainItemErrors(fields) {
  const reasons = Object.entries(fields || {}).filter(([path]) => isItemPath(path)).map(([, msg]) => msg);
  const changes = await syncCartWithCatalog({ notify: false, carryIfEmptied: true });
  const followUp = changes.length
    ? "We've updated your cart, so please check the summary and place your order again."
    : 'Please review your cart and try again.';
  return reasons.length ? `${reasons.join(' · ')}. ${followUp}` : `We could not price your cart. ${followUp}`;
}

function focusFirstInvalid(first) {
  if (!first) return;
  const section = first.closest('.co-section[data-step]');
  if (section) setActiveStep(section.dataset.step);
  first.focus({ preventScroll: true });
  first.scrollIntoView({ behavior: SCROLL, block: 'center' });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;
  clearAllErrors();

  if (cart.count() === 0) { window.location.replace('/cart.html'); return; }

  const data = readForm();
  const { fields } = validateCheckout({ ...data, items: cart.toOrderItems() });
  const visible = relevantFields(fields, data);
  if (Object.keys(visible).length) {
    const first = applyErrors(visible);
    setStatus(`Please fix the ${Object.keys(visible).length === 1 ? 'highlighted field' : `${Object.keys(visible).length} highlighted fields`} to continue.`);
    $$('.input', form).forEach((el) => { el.dataset.touched = 'true'; });
    updateStepDone();
    focusFirstInvalid(first);
    return;
  }

  setLoading(true);
  const base = { items: cart.toOrderItems(), shippingMethod: cart.shipping(), promoCode: cart.promo() };

  // 1) Refresh totals from the server so the shopper sees exactly what will be charged.
  try {
    const quote = await api.quote(base);
    if (quote?.totals) renderSummary(cart.snapshot(), quote.totals);
  } catch (err) {
    if (err.status === 400) {
      setLoading(false); // before the sync: the cart:change listener only leaves the page when not submitting
      setStatus(await explainItemErrors(err.data?.fields));
      toast('Please review your cart', { type: 'error' });
      els.status.focus?.();
      return;
    }
    // Network hiccup: continue with locally computed totals (server recomputes on create anyway).
  }

  // 2) Create the order
  const payload = {
    ...base,
    customer: data.customer,
    address: data.address,
    payment: paymentPayload(data.payment),
    notes: data.notes,
  };
  try {
    const res = await api.createOrder(payload);
    const order = res?.order;
    if (!order?.id) throw Object.assign(new Error('Unexpected response from server'), { status: 500 });
    rememberContact(data);
    try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch { /* ignore */ }
    cart.clear();
    toast('Order placed. Asante!', { type: 'success' });
    window.location.assign(`/order-confirmation.html?id=${encodeURIComponent(order.id)}`);
  } catch (err) {
    setLoading(false);
    if (err.status === 400 && err.data?.fields) {
      const first = applyErrors(err.data.fields);
      if (Object.keys(err.data.fields).some(isItemPath)) setStatus(await explainItemErrors(err.data.fields));
      // Keep the specific message applyErrors wrote for other unmapped problems; otherwise point at the fields.
      else if (els.status.hidden) setStatus('Please check the highlighted fields.');
      focusFirstInvalid(first);
      if (!first) els.status.focus?.();
    } else if (err.status === 400) {
      setStatus(err.data?.error || err.message);
    } else if (!err.status) {
      setStatus("We couldn't reach the store right now. Check your connection and try again.");
      toast('Network error. Please try again', { type: 'error' });
    } else if (err.status === 429) {
      setStatus(err.message); // "Too many orders. Please wait Ns and try again."
      toast('Please wait a moment', { type: 'error' });
    } else {
      setStatus(`Something went wrong placing your order (${err.status}). Please try again in a moment.`);
      toast('Something went wrong', { type: 'error' });
    }
  }
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
els.status.setAttribute('tabindex', '-1');
prefill();
syncPaymentMethod();
renderAll(cart.snapshot());
updateStepDone();
syncCartWithCatalog({ carryIfEmptied: true });
// Back from the confirmation page can restore this document from bfcache mid-"submitting": recover it.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  cart.reload();
  if (cart.count() === 0) { window.location.replace('/cart.html'); return; }
  setLoading(false);
  renderAll(cart.snapshot());
});
window.addEventListener('cart:change', (e) => {
  const state = e.detail || cart.snapshot();
  if (state.count === 0 && !submitting && !window.location.pathname.endsWith('order-confirmation.html')) {
    // Cart emptied from another tab / drawer while on checkout.
    window.location.replace('/cart.html');
    return;
  }
  renderAll(state);
});
