/** Product detail page: loads ?slug=, buy box, tabs, related products, 404 state. */
import { api } from '/js/api.js';
import { cart } from '/js/cart.js';
import { money, categoryLabel, escapeHtml } from '/js/format.js';
import { FREE_SHIPPING_THRESHOLD } from '/js/pricing.js';
import { icon, stars, tagBadges, safeColor, productCard, bindAddToCart, flashAdded, mountReveal } from '/js/components.js';

const root = document.querySelector('[data-product-root]');
const crumbs = document.querySelector('[data-breadcrumb] ol');
const relatedSection = document.querySelector('[data-related]');
const relatedGrid = document.querySelector('[data-related-grid]');
const relatedLink = document.querySelector('[data-related-link]');
const slug = new URL(location.href).searchParams.get('slug') || '';
const relatedById = new Map();

function crumb(label, href, current = false) {
  const sep = `<li><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 18 6-6-6-6"/></svg></li>`;
  return current
    ? `${sep}<li aria-current="page">${escapeHtml(label)}</li>`
    : `${sep}<li><a href="${href}">${escapeHtml(label)}</a></li>`;
}

function ingredientList(text) {
  return String(text || '').split(/,\s*/).map((s) => s.replace(/\.$/, '').trim()).filter(Boolean);
}

function stockLine(stock) {
  const n = Number(stock);
  if (!(n > 0)) return `<p class="buy-box__stock is-out">${icon('alert-circle', 'icon icon--sm')} Sold out, back soon</p>`;
  if (n <= 10) return `<p class="buy-box__stock is-low">${icon('flame', 'icon icon--sm')} Only ${n} left in stock</p>`;
  return `<p class="buy-box__stock is-ok">${icon('check', 'icon icon--sm')} In stock, ready to ship</p>`;
}

function render(product) {
  const p = product;
  const color = safeColor(p.color);
  const name = escapeHtml(p.name);
  const onSale = p.compareAt && Number(p.compareAt) > Number(p.price);
  const saving = onSale ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
  const soldOut = !(Number(p.stock) > 0);
  const max = Number(p.stock) > 0 ? Math.min(99, Number(p.stock)) : 99;

  document.title = `${p.name} | Mama Afrika Market`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', p.short || '');
  crumbs.insertAdjacentHTML('beforeend', crumb(categoryLabel(p.category), `/shop.html?category=${encodeURIComponent(p.category)}`) + crumb(p.name, '', true));

  root.innerHTML = `
<section class="container pdp" aria-labelledby="product-title">
  <div class="pdp__gallery stagger">
    <div class="pdp__art" style="--tint:${color}">
      <img src="${escapeHtml(p.image)}" alt="${name} illustration" width="600" height="600" decoding="async">
      <span class="pcard__badges">${tagBadges(p.tags)}</span>
    </div>
    <ul class="pdp__perks">
      <li>${icon('truck')}<strong>Ships in 48h</strong><span>Packed to order</span></li>
      <li>${icon('package')}<strong>Free shipping</strong><span>Standard, over ${money(FREE_SHIPPING_THRESHOLD)}</span></li>
      <li>${icon('rotate-ccw')}<strong>Easy returns</strong><span>30 days, no questions</span></li>
    </ul>
  </div>

  <div class="buy-box stagger">
    <div class="buy-box__eyebrow">
      <span class="pcard__flag">${escapeHtml(String(p.flag || '').toUpperCase())}</span>
      <span class="buy-box__origin">${escapeHtml(p.origin)}</span>
      <span aria-hidden="true">·</span>
      <a class="eyebrow" href="/shop.html?category=${encodeURIComponent(p.category)}">${escapeHtml(categoryLabel(p.category))}</a>
    </div>
    <h1 id="product-title">${name}</h1>
    <div>${stars(p.rating, { reviews: p.reviews }).replace('class="rating"', 'class="rating rating--lg"')}</div>
    <div class="buy-box__price">
      <span class="price${onSale ? ' price--sale' : ''}">${money(p.price)}</span>
      ${onSale ? `<s class="price__compare">${money(p.compareAt)}</s><span class="badge badge--primary">Save ${saving}%</span>` : ''}
      <span class="buy-box__unit">${escapeHtml(p.unit)}${p.weight && p.weight !== p.unit ? ` · ${escapeHtml(p.weight)}` : ''}</span>
    </div>
    <p class="buy-box__short">${escapeHtml(p.short)}</p>

    <form class="buy-box__form" data-buy-form>
      <div class="qty" role="group" aria-label="Quantity">
        <button class="qty__btn" type="button" data-qty="-1" data-testid="qty-decrement" aria-label="Decrease quantity">${icon('minus')}</button>
        <input class="qty__value" type="number" inputmode="numeric" min="1" max="${max}" value="1" aria-label="Quantity" data-qty-input>
        <button class="qty__btn" type="button" data-qty="1" data-testid="qty-increment" aria-label="Increase quantity">${icon('plus')}</button>
      </div>
      <button class="btn btn--accent btn--lg btn--hard pcard__add" type="submit" data-testid="add-to-cart"${soldOut ? ' disabled' : ''}>
        <span class="pcard__add-idle">${icon('bag')}<span>${soldOut ? 'Sold out' : 'Add to basket'}</span></span>
        <span class="pcard__add-done" aria-hidden="true">${icon('check')}<span>Added</span></span>
      </button>
    </form>
    ${stockLine(p.stock)}

    <ul class="buy-box__assure">
      <li>${icon('truck', 'icon icon--sm')} Ships in 48 hours from our warehouse</li>
      <li>${icon('check', 'icon icon--sm')} Free standard shipping on orders over ${money(FREE_SHIPPING_THRESHOLD)}</li>
      <li>${icon('book', 'icon icon--sm')} Recipe card included in the box</li>
    </ul>
    ${p.tags?.length ? `<div class="buy-box__tags">${p.tags.map((t) => `<a class="badge" href="/shop.html?tag=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join('')}</div>` : ''}
  </div>
</section>

<section class="container tabs" aria-label="Product details">
  <div class="tabs__list" role="tablist" aria-label="Product information">
    <button class="tabs__tab" role="tab" id="tab-description" aria-controls="panel-description" aria-selected="true" tabindex="0">Description</button>
    <button class="tabs__tab" role="tab" id="tab-ingredients" aria-controls="panel-ingredients" aria-selected="false" tabindex="-1">Ingredients</button>
    <button class="tabs__tab" role="tab" id="tab-shipping" aria-controls="panel-shipping" aria-selected="false" tabindex="-1">Shipping &amp; returns</button>
  </div>
  <div class="tabs__panel" role="tabpanel" id="panel-description" aria-labelledby="tab-description" tabindex="0">
    <p>${escapeHtml(p.description)}</p>
    <p class="muted">Origin: ${escapeHtml(p.origin)}. Net weight ${escapeHtml(p.weight)}.</p>
  </div>
  <div class="tabs__panel" role="tabpanel" id="panel-ingredients" aria-labelledby="tab-ingredients" tabindex="0" hidden>
    <h3>What's inside</h3>
    <p class="muted">Nothing artificial. If it isn't listed here, it isn't in the jar.</p>
    <ul class="ingredients">${ingredientList(p.ingredients).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
  </div>
  <div class="tabs__panel" role="tabpanel" id="panel-shipping" aria-labelledby="tab-shipping" tabindex="0" hidden>
    <h3>Shipping</h3>
    <ul>
      <li>${icon('check', 'icon icon--sm')}<span>Orders leave our warehouse within 48 hours, Monday to Saturday.</span></li>
      <li>${icon('check', 'icon icon--sm')}<span>Standard delivery (3–5 business days) is $6.95, or free on orders over ${money(FREE_SHIPPING_THRESHOLD)}.</span></li>
      <li>${icon('check', 'icon icon--sm')}<span>Express delivery (1–2 business days) is $14.95. Store pickup is free.</span></li>
    </ul>
    <h3 style="margin-top: var(--space-5)">Returns</h3>
    <p>Unopened items can be returned within 30 days for a full refund. If something arrived damaged, send us a photo and we'll replace it, no questions asked.</p>
  </div>
</section>`;

  bindQty(root.querySelector('[data-buy-form]'), p, max);
  bindTabs(root.querySelector('[role="tablist"]'));
  root.setAttribute('aria-busy', 'false');
}

function bindQty(form, product, max) {
  const input = form.querySelector('[data-qty-input]');
  const dec = form.querySelector('[data-qty="-1"]');
  const inc = form.querySelector('[data-qty="1"]');
  const add = form.querySelector('[data-testid="add-to-cart"]');

  const clamp = (n) => Math.max(1, Math.min(max, Math.floor(Number(n)) || 1));
  const sync = () => {
    const v = clamp(input.value);
    input.value = v;
    dec.disabled = v <= 1;
    inc.disabled = v >= max;
  };
  dec.addEventListener('click', () => { input.value = clamp(Number(input.value) - 1); sync(); });
  inc.addEventListener('click', () => { input.value = clamp(Number(input.value) + 1); sync(); });
  input.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (add.disabled || add.classList.contains('is-added')) return;
    const qty = clamp(input.value);
    cart.add(product, qty);
    flashAdded(add);
    window.MAM?.toast(`${qty} × ${product.name} added to your basket`, { type: 'success' });
    window.MAM?.openCart();
  });
}

function bindTabs(list) {
  const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  function activate(i, focus = true) {
    tabs.forEach((t, j) => {
      const on = i === j;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) tabs[i].focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(i, false));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length;
      const map = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
      if (e.key in map) { e.preventDefault(); activate(map[e.key]); }
    });
  });
}

function renderRelated(list) {
  if (!list?.length) { relatedSection.hidden = true; return; }
  list.forEach((p) => relatedById.set(p.id, p));
  relatedGrid.classList.add('is-fresh');
  relatedGrid.innerHTML = list.map((p, i) => productCard(p, { index: i })).join('');
  relatedSection.hidden = false;
  bindAddToCart(relatedGrid, (id) => relatedById.get(id));
}

function renderNotFound() {
  document.title = 'Product not found | Mama Afrika Market';
  crumbs.insertAdjacentHTML('beforeend', crumb('Not found', '', true));
  root.innerHTML = `
<section class="container section">
  <div class="state container--narrow">
    <div class="state__art" aria-hidden="true">${icon('search-x', 'icon icon--lg')}</div>
    <h1 class="h2">We couldn't find that product</h1>
    <p class="muted">It may have sold out for the season or moved aisles${slug ? ` (looked for “${escapeHtml(slug)}”)` : ''}.</p>
    <div class="cluster">
      <a class="btn btn--dark" href="/shop.html">Browse the market ${icon('arrow-right')}</a>
      <a class="btn btn--outline" href="/">Back home</a>
    </div>
  </div>
</section>`;
  root.setAttribute('aria-busy', 'false');
  relatedSection.hidden = true;
}

function renderError() {
  document.title = 'Something went wrong | Mama Afrika Market';
  root.innerHTML = `
<section class="container section">
  <div class="state container--narrow">
    <div class="state__art" aria-hidden="true">${icon('alert-circle', 'icon icon--lg')}</div>
    <h1 class="h2">We couldn't load this product</h1>
    <p class="muted">The market is having a moment. Please try again.</p>
    <div class="cluster">
      <button class="btn btn--dark" type="button" data-retry>Try again ${icon('rotate-ccw')}</button>
      <a class="btn btn--outline" href="/shop.html">Browse the market</a>
    </div>
  </div>
</section>`;
  root.querySelector('[data-retry]')?.addEventListener('click', load);
  root.setAttribute('aria-busy', 'false');
}

async function load() {
  if (!slug) { renderNotFound(); return; }
  root.setAttribute('aria-busy', 'true');
  try {
    const { product, related } = await api.product(slug);
    if (!product) { renderNotFound(); return; }
    render(product);
    if (relatedLink) relatedLink.href = `/shop.html?category=${encodeURIComponent(product.category)}`;
    renderRelated(related);
    mountReveal();
  } catch (err) {
    if (err?.status === 404) renderNotFound();
    else renderError();
  }
}

load();
