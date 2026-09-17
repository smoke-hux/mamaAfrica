/** Cart page — line items, promo, shipping method, live summary. */
import { cart } from '/js/cart.js';
import { api } from '/js/api.js';
import { syncCartWithCatalog } from '/js/cart-sync.js';
import { money, escapeHtml } from '/js/format.js';
import { SHIPPING_METHODS, FREE_SHIPPING_THRESHOLD, findPromo } from '/js/pricing.js';

const $ = (sel, root = document) => root.querySelector(sel);
const toast = (message, opts) => window.MAM?.toast?.(message, opts);

const els = {
  lines: $('#cart-lines'),
  tools: $('#cart-tools'),
  summary: $('#cart-summary'),
  countLabel: $('#cart-count-label'),
  summaryCount: $('#summary-count'),
  promoForm: $('#promo-form'),
  promoInput: $('#promo-code'),
  promoApply: $('#promo-apply'),
  promoError: $('#promo-error'),
  promoApplied: $('#promo-applied'),
  shippingMethods: $('#shipping-methods'),
  progress: $('#ship-progress'),
  progressLabel: $('#ship-progress-label'),
  progressTrack: $('#ship-progress-track'),
  progressBar: $('#ship-progress-bar'),
  subtotal: $('#sum-subtotal'),
  discountRow: $('#sum-discount-row'),
  discountLabel: $('#sum-discount-label'),
  discount: $('#sum-discount'),
  shippingLabel: $('#sum-shipping-label'),
  shipping: $('#sum-shipping'),
  tax: $('#sum-tax'),
  total: $('#sum-total'),
  checkout: $('#checkout-button'),
};

const ICON = {
  trash: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  truck: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  tag: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
  x: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
};

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderLines(state) {
  const { items } = state;
  if (items.length === 0) {
    els.lines.innerHTML = `
      <div class="cart-empty card card--pad">
        <div class="basket" aria-hidden="true">
          <div class="basket__handle"></div>
          <div class="basket__item basket__item--lime"></div>
          <div class="basket__item basket__item--tomato"></div>
          <div class="basket__item basket__item--pepper"></div>
          <div class="basket__item basket__item--yam"></div>
          <div class="basket__rim"></div>
          <div class="basket__body"></div>
        </div>
        <h2>Your basket is empty</h2>
        <p class="lead">Fill it with smoky suya spice, party jollof kits and more from across the continent.</p>
        <div class="cart-empty__actions">
          <a class="btn btn--accent btn--lg" href="/shop.html">Start shopping</a>
          <a class="btn btn--outline btn--lg" href="/shop.html?category=meal-kits">Browse meal kits</a>
        </div>
      </div>`;
    els.tools.hidden = true;
    return;
  }
  els.tools.hidden = false;

  const rows = items.map((l) => {
    const lineTotal = money(l.price * l.qty);
    const stock = Number(l.stock);
    const atMax = Number.isFinite(stock) && stock > 0 ? l.qty >= Math.min(99, stock) : l.qty >= 99;
    const lowStock = Number.isFinite(stock) && stock > 0 && stock <= 5;
    return `
      <tr class="cart-row" data-testid="cart-line" data-id="${escapeHtml(l.id)}">
        <td class="cart-row__thumb">
          <a class="cart-thumb" href="/product.html?slug=${encodeURIComponent(l.slug || '')}" style="background:${escapeHtml(l.color || '')}22" tabindex="-1" aria-hidden="true">
            <img src="${escapeHtml(l.image || '')}" alt="" width="84" height="84" loading="lazy">
          </a>
        </td>
        <td class="cart-row__info">
          <a class="cart-row__name" href="/product.html?slug=${encodeURIComponent(l.slug || '')}">${escapeHtml(l.name)}</a>
          <span class="cart-row__unit" data-price="${money(l.price)}">${escapeHtml(l.unit || '')}</span>
          ${lowStock ? `<span class="cart-row__stock">Only ${stock} left</span>` : ''}
        </td>
        <td class="cart-row__price-cell is-num"><span class="cart-row__price">${money(l.price)}</span></td>
        <td class="cart-row__qty">
          <div class="qty" role="group" aria-label="Quantity for ${escapeHtml(l.name)}">
            <button class="qty__btn" type="button" data-action="dec" data-testid="qty-decrement" aria-label="Decrease quantity of ${escapeHtml(l.name)}">−</button>
            <input class="qty__value" type="number" inputmode="numeric" min="1" max="99" value="${l.qty}" data-action="qty" aria-label="Quantity of ${escapeHtml(l.name)}">
            <button class="qty__btn" type="button" data-action="inc" data-testid="qty-increment" aria-label="Increase quantity of ${escapeHtml(l.name)}" ${atMax ? 'disabled' : ''}>+</button>
          </div>
        </td>
        <td class="cart-row__total-cell is-num"><span class="cart-row__total">${lineTotal}</span></td>
        <td class="cart-row__remove-cell is-num">
          <button class="cart-row__remove" type="button" data-action="remove" data-testid="remove-line" aria-label="Remove ${escapeHtml(l.name)} from cart">${ICON.trash}</button>
        </td>
      </tr>`;
  }).join('');

  els.lines.innerHTML = `
    <table class="cart-table">
      <caption class="visually-hidden">Items in your cart</caption>
      <thead>
        <tr>
          <th scope="col" colspan="2">Item</th>
          <th scope="col" class="is-num">Price</th>
          <th scope="col">Qty</th>
          <th scope="col" class="is-num">Total</th>
          <th scope="col"><span class="visually-hidden">Remove</span></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderShippingMethods(state) {
  const { totals } = state;
  const current = state.shippingMethod;
  els.shippingMethods.innerHTML = Object.values(SHIPPING_METHODS).map((m) => {
    const free = m.price === 0 || (m.id === 'standard' && totals.shipping === 0 && totals.itemCount > 0);
    const hint = m.id === 'pickup' ? 'Collect from our Brooklyn market stall' : m.id === 'express' ? 'Priority handling, next-day dispatch' : 'Free on orders over $60';
    return `
      <label class="radio-row ${m.id === current ? 'is-selected' : ''}">
        <input type="radio" name="shippingMethod" value="${m.id}" ${m.id === current ? 'checked' : ''}>
        <span class="radio-row__label">${escapeHtml(m.label)}<span class="radio-row__hint">${hint}</span></span>
        <span class="radio-row__price ${free ? 'is-free' : ''}">${free ? 'Free' : money(m.price)}</span>
      </label>`;
  }).join('');
}

function renderPromo(state) {
  const code = state.promoCode;
  const promo = code ? findPromo(code) : null;
  if (code) {
    els.promoForm.hidden = true;
    els.promoApplied.hidden = false;
    els.promoApplied.innerHTML = `
      <div class="promo-applied" role="status">
        <span class="promo-applied__code">${ICON.tag}<span>${escapeHtml(code)}</span> <span class="muted" style="font-weight:600">· ${escapeHtml(promo ? promo.label : 'applied')}</span></span>
        <button class="promo-applied__remove" type="button" id="promo-remove" aria-label="Remove promo code ${escapeHtml(code)}">${ICON.x}</button>
      </div>`;
  } else {
    els.promoForm.hidden = false;
    els.promoApplied.hidden = true;
    els.promoApplied.innerHTML = '';
  }
}

function renderSummary(state) {
  const t = state.totals;
  const n = state.count;
  const noun = n === 1 ? 'item' : 'items';
  els.countLabel.textContent = n ? `${n} ${noun}` : '';
  els.summaryCount.textContent = n ? `${n} ${noun}` : '';

  els.subtotal.textContent = money(t.subtotal);
  els.discountRow.hidden = !(t.discount > 0);
  els.discountLabel.textContent = t.promoCode ? `Discount (${t.promoCode})` : 'Discount';
  els.discount.textContent = `–${money(t.discount)}`;
  els.shippingLabel.textContent = `Shipping · ${t.shippingMethod === 'pickup' ? 'Pickup' : t.shippingMethod === 'express' ? 'Express' : 'Standard'}`;
  if (t.itemCount === 0) els.shipping.textContent = '—';
  else if (t.shipping === 0) { els.shipping.innerHTML = '<span class="summary__free">Free</span>'; }
  else els.shipping.textContent = money(t.shipping);
  els.tax.textContent = money(t.tax);
  els.total.textContent = money(t.total);

  // Free-shipping progress (measured against the discounted subtotal)
  const progressed = Math.max(0, t.subtotal - t.discount);
  const pct = Math.max(0, Math.min(100, Math.round((progressed / FREE_SHIPPING_THRESHOLD) * 100)));
  els.progressBar.style.width = `${pct}%`;
  els.progressTrack.setAttribute('aria-valuenow', String(pct));
  const earned = t.freeShippingEarned || (t.promoCode === 'FREESHIP');
  els.progress.classList.toggle('is-earned', earned);
  if (n === 0) {
    els.progressLabel.innerHTML = `${ICON.truck}<span>Free standard shipping on orders over ${money(FREE_SHIPPING_THRESHOLD)}</span>`;
  } else if (earned) {
    els.progressLabel.innerHTML = `${ICON.check}<span>You've unlocked free standard shipping</span>`;
  } else {
    els.progressLabel.innerHTML = `${ICON.truck}<span>Add <strong>${money(t.amountToFreeShipping)}</strong> more for free standard shipping</span>`;
  }

  const empty = n === 0;
  els.checkout.setAttribute('aria-disabled', empty ? 'true' : 'false');
  els.checkout.tabIndex = empty ? -1 : 0;
}

/** Remember which control had focus so a re-render doesn't strand keyboard users. */
function rememberFocus() {
  const a = document.activeElement;
  if (!a || !els.lines.contains(a)) return null;
  const row = a.closest('[data-id]');
  return { id: row?.dataset.id, action: a.dataset.action };
}
function restoreFocus(mark, state) {
  if (!mark || !mark.id) return;
  let target = els.lines.querySelector(`[data-id="${CSS.escape(mark.id)}"] [data-action="${mark.action}"]`);
  if (!target || target.disabled) {
    // Line was removed (or + is now disabled): move focus somewhere sensible.
    target = els.lines.querySelector(`[data-id="${CSS.escape(mark.id)}"] [data-action="dec"]`)
      || els.lines.querySelector('[data-action="dec"]')
      || (state.items.length === 0 ? els.lines.querySelector('a.btn') : null);
  }
  target?.focus({ preventScroll: true });
}

function render(state) {
  const mark = rememberFocus();
  renderLines(state);
  renderShippingMethods(state);
  renderPromo(state);
  renderSummary(state);
  restoreFocus(mark, state);
}

/* ------------------------------------------------------------------ */
/* Interactions                                                        */
/* ------------------------------------------------------------------ */

els.lines.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('[data-id]');
  const id = row?.dataset.id;
  if (!id) return;
  const line = cart.line(id);
  if (btn.dataset.action === 'inc') cart.increment(id);
  else if (btn.dataset.action === 'dec') {
    if (line && line.qty <= 1) { removeLine(id, line); } else cart.decrement(id);
  } else if (btn.dataset.action === 'remove') removeLine(id, line);
});

els.lines.addEventListener('change', (e) => {
  const input = e.target.closest('input[data-action="qty"]');
  if (!input) return;
  const id = input.closest('[data-id]')?.dataset.id;
  const q = Math.floor(Number(input.value));
  if (!id) return;
  if (!Number.isFinite(q) || q < 1) { cart.setQty(id, 1); return; }
  cart.setQty(id, q);
});

function removeLine(id, line) {
  cart.remove(id);
  if (line) toast(`Removed ${line.name} from your cart`, { type: 'info' });
}

els.checkout.addEventListener('click', (e) => {
  if (els.checkout.getAttribute('aria-disabled') === 'true') { e.preventDefault(); toast('Your cart is empty', { type: 'error' }); }
});

els.shippingMethods.addEventListener('change', (e) => {
  const input = e.target.closest('input[name="shippingMethod"]');
  if (!input) return;
  cart.setShipping(input.value);
});

function setPromoError(message) {
  const field = els.promoForm;
  field.classList.toggle('has-error', Boolean(message));
  els.promoError.textContent = message || '';
  els.promoInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  els.promoInput.setAttribute('aria-describedby', message ? 'promo-error' : '');
}

els.promoInput.addEventListener('input', () => setPromoError(''));

els.promoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = els.promoInput.value.trim().toUpperCase();
  if (!code) { setPromoError('Enter a promo code'); els.promoInput.focus(); return; }
  setPromoError('');
  els.promoApply.classList.add('is-loading');
  els.promoApply.setAttribute('aria-busy', 'true');
  try {
    const res = await api.validatePromo(code);
    const promo = res?.promo || findPromo(code);
    cart.setPromo(promo?.code || code);
    toast(`${promo?.code || code} applied — ${promo?.label || 'discount added'}`, { type: 'success' });
    els.promoInput.value = '';
  } catch (err) {
    if (err.status === 404 || err.status === 400) {
      setPromoError(err.message || 'Promo code not recognised');
    } else {
      // API unreachable: fall back to the shared promo table so the store still works offline.
      const local = findPromo(code);
      if (local) {
        cart.setPromo(local.code);
        toast(`${local.code} applied — ${local.label}`, { type: 'success' });
        els.promoInput.value = '';
      } else {
        setPromoError('Promo code not recognised');
      }
    }
    if (els.promoForm.classList.contains('has-error')) els.promoInput.focus();
  } finally {
    els.promoApply.classList.remove('is-loading');
    els.promoApply.removeAttribute('aria-busy');
  }
});

els.promoApplied.addEventListener('click', (e) => {
  if (!e.target.closest('#promo-remove')) return;
  cart.setPromo(null);
  toast('Promo code removed', { type: 'info' });
  requestAnimationFrame(() => els.promoInput.focus());
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
render(cart.snapshot());
window.addEventListener('cart:change', (e) => render(e.detail || cart.snapshot()));
// Lines are snapshots from when they were added; refresh prices and stock from the catalog.
syncCartWithCatalog();
