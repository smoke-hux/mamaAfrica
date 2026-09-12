/**
 * Shared UI pieces for the storefront pages (home / shop / product / about).
 * Self-contained: only depends on the shared read-only modules.
 *
 *   icon(name)                     -> inline Lucide-style SVG string
 *   stars(rating)                  -> 5-star SVG rating string
 *   productCard(product)           -> card HTML (data-testid="product-card")
 *   skeletonCard()                 -> placeholder card HTML
 *   bindAddToCart(container, find) -> delegated "Add to cart" handling
 *   mountReveal(root)              -> IntersectionObserver for .reveal
 *   safeColor(hex)                 -> validated hex or fallback
 */
import { money, categoryLabel, escapeHtml } from '/js/format.js';
import { cart } from '/js/cart.js';

/* --------------------------------------------------------------------------
   Icons (24 viewBox, stroke-width 2, Lucide style)
   -------------------------------------------------------------------------- */
const PATHS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  sparkles: '<path d="M9.94 14.34 12 21l2.06-6.66L21 12l-6.94-2.34L12 3l-2.06 6.66L3 12z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
  'search-x': '<path d="m13.5 8.5-5 5"/><path d="m8.5 8.5 5 5"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><path d="M17.5 6.5h.01"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  youtube: '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
  'chef-hat': '<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
};

export function icon(name, cls = 'icon') {
  const d = PATHS[name] || PATHS['alert-circle'];
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
}

/* --------------------------------------------------------------------------
   Star rating (fractional fill via clip-path)
   -------------------------------------------------------------------------- */
const STAR = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

export function stars(rating, { reviews, showValue = true } = {}) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  let svgs = '';
  for (let i = 1; i <= 5; i++) {
    const fill = Math.max(0, Math.min(1, r - (i - 1)));
    const cut = Math.round((1 - fill) * 100);
    svgs += `<svg class="star" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="star__bg" d="${STAR}"/><path class="star__fg" d="${STAR}" style="clip-path: inset(0 ${cut}% 0 0)"/></svg>`;
  }
  const label = `Rated ${r.toFixed(1)} out of 5${reviews != null ? ` from ${reviews} reviews` : ''}`;
  const value = showValue
    ? `<span class="rating__value" aria-hidden="true">${r.toFixed(1)}${reviews != null ? ` <span class="rating__count">(${Number(reviews)})</span>` : ''}</span>`
    : '';
  return `<span class="rating" role="img" aria-label="${escapeHtml(label)}"><span class="rating__stars">${svgs}</span>${value}</span>`;
}

/* --------------------------------------------------------------------------
   Product card
   -------------------------------------------------------------------------- */
const TAG_BADGES = { bestseller: 'badge--accent', new: 'badge--leaf', sale: 'badge--primary' };
const SHOWN_TAGS = ['bestseller', 'new', 'sale'];

export function safeColor(hex, fallback = '#EFE1C6') {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(hex || '')) ? hex : fallback;
}

export function tagBadges(tags = []) {
  return tags
    .filter((t) => SHOWN_TAGS.includes(t))
    .map((t) => `<span class="badge ${TAG_BADGES[t] || ''}">${escapeHtml(t)}</span>`)
    .join('');
}

export function productUrl(product) {
  return `/product.html?slug=${encodeURIComponent(product.slug)}`;
}

export function productCard(p, { index = 0 } = {}) {
  const url = productUrl(p);
  const color = safeColor(p.color);
  const name = escapeHtml(p.name);
  const compare = p.compareAt && Number(p.compareAt) > Number(p.price)
    ? `<s class="price__compare">${money(p.compareAt)}</s>` : '';
  const onSale = Boolean(compare);
  const lowStock = Number(p.stock) > 0 && Number(p.stock) <= 10;
  const soldOut = Number(p.stock) <= 0;
  const flag = escapeHtml(String(p.flag || '').toUpperCase());
  return `
<article class="pcard${onSale ? ' pcard--sale' : ''}" data-testid="product-card" data-id="${escapeHtml(p.id)}" data-slug="${escapeHtml(p.slug)}" style="--tint:${color}; --i:${index}">
  <a class="pcard__media" href="${url}" tabindex="-1" aria-hidden="true">
    <img loading="lazy" decoding="async" src="${escapeHtml(p.image)}" alt="" width="400" height="400">
    <span class="pcard__badges">${tagBadges(p.tags)}</span>
    <span class="pcard__origin"><span class="pcard__flag">${flag}</span><span class="pcard__origin-name">${escapeHtml(p.origin)}</span></span>
  </a>
  <div class="pcard__body">
    <p class="pcard__cat">${escapeHtml(categoryLabel(p.category))}</p>
    <h3 class="pcard__name"><a href="${url}">${name}</a></h3>
    <p class="pcard__short">${escapeHtml(p.short)}</p>
    <div class="pcard__rating">${stars(p.rating, { reviews: p.reviews })}</div>
    <div class="pcard__foot">
      <div class="pcard__price">
        <span class="price">${money(p.price)}${compare}</span>
        <span class="pcard__unit">${escapeHtml(p.unit)}</span>
      </div>
      <button class="btn btn--dark btn--sm pcard__add" type="button" data-testid="add-to-cart" data-id="${escapeHtml(p.id)}" aria-label="Add ${name} to cart"${soldOut ? ' disabled' : ''}>
        <span class="pcard__add-idle">${icon('bag')}<span>${soldOut ? 'Sold out' : 'Add'}</span></span>
        <span class="pcard__add-done" aria-hidden="true">${icon('check')}<span>Added</span></span>
      </button>
    </div>
    ${lowStock ? `<p class="pcard__stock">Only ${Number(p.stock)} left</p>` : ''}
  </div>
</article>`;
}

export function skeletonCard() {
  return `
<div class="pcard pcard--skeleton" aria-hidden="true">
  <div class="pcard__media skeleton"></div>
  <div class="pcard__body">
    <div class="skeleton" style="height:12px;width:40%"></div>
    <div class="skeleton" style="height:22px;width:80%"></div>
    <div class="skeleton" style="height:14px;width:95%"></div>
    <div class="skeleton" style="height:14px;width:60%"></div>
    <div class="skeleton" style="height:40px;width:100%;margin-top:auto"></div>
  </div>
</div>`;
}

/**
 * Delegated add-to-cart for any container holding productCard() markup.
 * @param {Element} container
 * @param {(id:string)=>object|undefined} find  resolves a product by id
 */
export function bindAddToCart(container, find) {
  if (!container || container.dataset.addBound) return;
  container.dataset.addBound = '1';
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-testid="add-to-cart"]');
    if (!btn || !container.contains(btn) || btn.disabled) return;
    const product = find(btn.dataset.id);
    if (!product) return;
    cart.add(product, 1);
    flashAdded(btn);
    window.MAM?.toast(`${product.name} added to your basket`, { type: 'success', action: { label: 'View', onClick: () => window.MAM?.openCart() } });
  });
}

/** Toggle a button into its "Added" state for ~1.2s. */
export function flashAdded(btn, ms = 1200) {
  btn.classList.add('is-added');
  btn.setAttribute('aria-disabled', 'true');
  clearTimeout(btn._addedTimer);
  btn._addedTimer = setTimeout(() => {
    btn.classList.remove('is-added');
    btn.removeAttribute('aria-disabled');
  }, ms);
}

/* --------------------------------------------------------------------------
   Reveal-on-scroll
   -------------------------------------------------------------------------- */
let observer = null;
export function mountReveal(root = document) {
  const els = root.querySelectorAll('.reveal:not(.is-visible)');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return; }
  observer ||= new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => observer.observe(el));
}

/** Small helper: set text of first match. */
export function setText(root, selector, text) {
  const el = root.querySelector(selector);
  if (el) el.textContent = text;
}
