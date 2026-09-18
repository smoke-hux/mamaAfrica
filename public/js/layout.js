/**
 * layout.js — injects the shared chrome into every page:
 * sticky header (logo, nav, search, cart button), footer (newsletter, links),
 * slide-in cart drawer (dialog, focus trap), and a polite toast region.
 * Exposes window.MAM = { toast, openCart, closeCart }.
 */
import { cart } from '/js/cart.js';
import { api } from '/js/api.js';
import { money, escapeHtml } from '/js/format.js';
import { FREE_SHIPPING_THRESHOLD, MAX_LINE_QTY } from '/js/pricing.js';
import { icon, safeColor } from '/js/components.js';

const NAV = [
  { label: 'Shop', href: '/shop.html', match: (u) => isPath(u, '/shop') && u.searchParams.get('category') !== 'meal-kits' },
  { label: 'Meal Kits', href: '/shop.html?category=meal-kits', match: (u) => isPath(u, '/shop') && u.searchParams.get('category') === 'meal-kits' },
  { label: 'About', href: '/about.html', match: (u) => isPath(u, '/about') },
];

function isPath(u, base) {
  const p = u.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  return p === base;
}

/* ==========================================================================
   Header
   ========================================================================== */
function renderHeader() {
  const mount = document.getElementById('site-header');
  if (!mount) return;
  const here = new URL(location.href);
  const links = NAV.map((n) => {
    const current = n.match(here) ? ' aria-current="page"' : '';
    return `<li><a class="site-nav__link" href="${n.href}"${current}>${n.label}</a></li>`;
  }).join('');
  const q = here.searchParams.get('q') || '';

  mount.innerHTML = `
<header class="site-header">
  <div class="site-header__bar container">
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
      <span class="nav-toggle__open">${icon('menu')}</span>
      <span class="nav-toggle__close">${icon('x')}</span>
    </button>
    <a class="brand" href="/" aria-label="Mama Afrika Market, home">
      <span class="brand__mark" aria-hidden="true"><span class="brand__fallback">M</span><img src="/img/logo.svg" alt="" width="44" height="44"></span>
      <span class="brand__text">Mama Afrika <span class="brand__accent">Market</span></span>
    </a>
    <nav class="site-nav" id="site-nav" aria-label="Primary">
      <ul class="site-nav__list">${links}</ul>
      <form class="site-search" role="search" action="/shop.html" method="get">
        <label class="visually-hidden" for="site-search-input">Search products</label>
        <input class="site-search__input" id="site-search-input" name="q" type="search" placeholder="Search pilau, chai, nyama choma…" autocomplete="off" value="${escapeHtml(q)}">
        <button class="site-search__btn" type="submit" aria-label="Search">${icon('search')}</button>
      </form>
    </nav>
    <button class="cart-btn" type="button" aria-label="Open cart" aria-haspopup="dialog" aria-controls="cart-drawer">
      ${icon('bag')}
      <span class="cart-btn__label">Basket</span>
      <span class="cart-count" data-cart-count data-testid="cart-count" aria-live="polite" aria-atomic="true">0</span>
    </button>
  </div>
</header>`;

  const header = mount.querySelector('.site-header');
  const toggle = mount.querySelector('.nav-toggle');
  const nav = mount.querySelector('#site-nav');

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); } });
  document.addEventListener('click', (e) => {
    if (toggle.getAttribute('aria-expanded') === 'true' && !header.contains(e.target)) setMenu(false);
  });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  // Search: on the shop page, hand off to shop.js instead of reloading.
  mount.querySelector('.site-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = mount.querySelector('.site-search__input').value.trim();
    if (document.body.dataset.page === 'shop') {
      window.dispatchEvent(new CustomEvent('mam:search', { detail: { q: value } }));
      setMenu(false);
      return;
    }
    location.href = `/shop.html${value ? `?q=${encodeURIComponent(value)}` : ''}`;
  });

  mount.querySelector('.cart-btn').addEventListener('click', () => openCart());

  // Compact header once scrolled.
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { header.classList.toggle('is-scrolled', window.scrollY > 24); ticking = false; });
  }, { passive: true });
}

function updateCount(state) {
  const badge = document.querySelector('[data-cart-count]');
  if (!badge) return;
  const n = state.count;
  const prev = Number(badge.textContent) || 0;
  badge.textContent = String(n);
  badge.classList.toggle('is-empty', n === 0);
  const btn = badge.closest('.cart-btn');
  if (btn) btn.setAttribute('aria-label', `Open cart, ${n} ${n === 1 ? 'item' : 'items'}`);
  if (n !== prev) {
    badge.classList.remove('is-bump');
    void badge.offsetWidth; // restart animation
    badge.classList.add('is-bump');
  }
}

/* ==========================================================================
   Footer
   ========================================================================== */
function renderFooter() {
  const mount = document.getElementById('site-footer');
  if (!mount) return;
  const year = new Date().getFullYear();
  mount.innerHTML = `
<footer class="site-footer">
  <div class="site-footer__stripe pattern-kente" aria-hidden="true"></div>
  <div class="container site-footer__grid">
    <div class="site-footer__brand">
      <a class="brand brand--light" href="/" aria-label="Mama Afrika Market, home">
        <span class="brand__mark" aria-hidden="true"><span class="brand__fallback">M</span><img src="/img/logo.svg" alt="" width="44" height="44"></span>
        <span class="brand__text">Mama Afrika <span class="brand__accent">Market</span></span>
      </a>
      <p class="site-footer__tag">Meal kits, spices, staples, Kericho tea and Nairobi restaurant picks from co-ops across the counties, delivered to your gate the same day. Westlands, Nairobi.</p>
      <form class="newsletter" novalidate>
        <label class="newsletter__label" for="newsletter-email">Get recipe cards and KARIBU10 for 10% off your order</label>
        <div class="newsletter__row">
          <input class="input newsletter__input" id="newsletter-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required>
          <button class="btn btn--accent newsletter__btn" type="submit">Join<span class="visually-hidden"> the newsletter</span> ${icon('arrow-right')}</button>
        </div>
        <p class="newsletter__msg" aria-live="polite"></p>
      </form>
    </div>
    <nav class="site-footer__col" aria-label="Shop">
      <h3 class="site-footer__title">Shop</h3>
      <ul>
        <li><a href="/shop.html">All products</a></li>
        <li><a href="/shop.html?category=meal-kits">Meal kits</a></li>
        <li><a href="/shop.html?category=restaurants">Restaurant picks</a></li>
        <li><a href="/shop.html?category=spices">Spices &amp; sauces</a></li>
        <li><a href="/shop.html?category=staples">Staples &amp; flours</a></li>
        <li><a href="/shop.html?category=snacks">Snacks &amp; bites</a></li>
        <li><a href="/shop.html?category=drinks">Tea, coffee &amp; drinks</a></li>
      </ul>
    </nav>
    <nav class="site-footer__col" aria-label="Company">
      <h3 class="site-footer__title">Company</h3>
      <ul>
        <li><a href="/about.html">Our story</a></li>
        <li><a href="/about.html#sourcing">Sourcing</a></li>
        <li><a href="/about.html#values">Values</a></li>
        <li><a href="/about.html#team">Team</a></li>
      </ul>
    </nav>
    <nav class="site-footer__col" aria-label="Help">
      <h3 class="site-footer__title">Help</h3>
      <ul>
        <li><a href="/cart.html">Your basket</a></li>
        <li><a href="/checkout.html">Checkout</a></li>
        <li><a href="/shop.html?tag=bestseller">Bestsellers</a></li>
        <li><a href="/shop.html?tag=sale">On sale</a></li>
      </ul>
      <ul class="site-footer__social" aria-label="Social">
        <li><a href="#" aria-label="Instagram">${icon('instagram')}</a></li>
        <li><a href="#" aria-label="Facebook">${icon('facebook')}</a></li>
        <li><a href="#" aria-label="YouTube">${icon('youtube')}</a></li>
      </ul>
    </nav>
  </div>
  <div class="site-footer__bottom">
    <div class="container site-footer__bottom-row">
      <p class="site-footer__love">${icon('heart', 'icon icon--sm')} Made with love in Westlands, Nairobi</p>
      <p class="site-footer__copy">&copy; ${year} Mama Afrika Market. Demo store, no real orders are shipped.</p>
    </div>
  </div>
</footer>`;

  const form = mount.querySelector('.newsletter');
  const input = form.querySelector('.newsletter__input');
  const btn = form.querySelector('.newsletter__btn');
  const msg = form.querySelector('.newsletter__msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    msg.className = 'newsletter__msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      msg.textContent = 'Please enter a valid email address.';
      msg.classList.add('is-error');
      input.focus();
      return;
    }
    btn.classList.add('is-loading');
    btn.disabled = true;
    try {
      const res = await api.subscribe(email);
      msg.textContent = res?.message || 'You are on the list. Karibu!';
      msg.classList.add('is-success');
      form.reset();
    } catch (err) {
      msg.textContent = err?.message || 'Something went wrong. Please try again.';
      msg.classList.add('is-error');
    } finally {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  });
}

/* ==========================================================================
   Cart drawer
   ========================================================================== */
let drawer, backdrop, lastFocus = null, closeTimer = null;

function renderDrawer() {
  const wrap = document.createElement('div');
  wrap.className = 'cart-drawer-root';
  wrap.innerHTML = `
<div class="drawer-backdrop" data-drawer-backdrop hidden></div>
<div class="cart-drawer" id="cart-drawer" data-testid="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" tabindex="-1" hidden>
  <div class="cart-drawer__head">
    <h2 class="cart-drawer__title" id="cart-drawer-title">Your basket <span class="cart-drawer__count" data-drawer-count></span></h2>
    <button class="btn btn--ghost btn--icon cart-drawer__close" type="button" aria-label="Close cart">${icon('x')}</button>
  </div>
  <div class="cart-drawer__ship" data-drawer-ship></div>
  <div class="cart-drawer__body" data-drawer-body></div>
  <div class="cart-drawer__foot" data-drawer-foot>
    <div class="cart-drawer__row"><span>Subtotal</span><strong class="price" data-drawer-subtotal>${money(0)}</strong></div>
    <p class="cart-drawer__note">Delivery and VAT are calculated at checkout.</p>
    <a class="btn btn--accent btn--lg btn--block card--hard" href="/checkout.html" data-testid="checkout-button">Checkout ${icon('arrow-right')}</a>
    <a class="btn btn--outline btn--block" href="/cart.html">View basket</a>
  </div>
</div>`;
  document.body.appendChild(wrap);
  drawer = wrap.querySelector('#cart-drawer');
  backdrop = wrap.querySelector('[data-drawer-backdrop]');

  wrap.querySelector('.cart-drawer__close').addEventListener('click', closeCart);
  backdrop.addEventListener('click', closeCart);
  drawer.addEventListener('keydown', onDrawerKeydown);
  drawer.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'inc') cart.increment(id);
    else if (action === 'dec') cart.decrement(id);
    else if (action === 'remove') { cart.remove(id); window.MAM?.toast('Removed from basket', { type: 'info' }); }
    else if (action === 'continue') closeCart();
  });
}

function drawerLine(l) {
  const color = safeColor(l.color);
  const name = escapeHtml(l.name);
  const url = `/product.html?slug=${encodeURIComponent(l.slug || '')}`;
  const max = Number.isFinite(Number(l.stock)) && l.stock > 0 ? Math.min(MAX_LINE_QTY, l.stock) : MAX_LINE_QTY;
  return `
<li class="cart-line" data-testid="cart-line" data-id="${escapeHtml(l.id)}">
  <a class="cart-line__media" href="${url}" style="--tint:${color}" tabindex="-1" aria-hidden="true">
    <img src="${escapeHtml(l.image || '')}" alt="" loading="lazy" width="80" height="80">
  </a>
  <div class="cart-line__info">
    <a class="cart-line__name" href="${url}">${name}</a>
    <p class="cart-line__meta">${escapeHtml(l.unit || '')} · ${money(l.price)} each</p>
    <div class="cart-line__controls">
      <div class="qty qty--sm" role="group" aria-label="Quantity for ${name}">
        <button class="qty__btn" type="button" data-action="dec" data-id="${escapeHtml(l.id)}" data-testid="qty-decrement" aria-label="Decrease quantity of ${name}">${icon('minus', 'icon icon--sm')}</button>
        <span class="qty__value" aria-live="polite" aria-atomic="true">${Number(l.qty)}</span>
        <button class="qty__btn" type="button" data-action="inc" data-id="${escapeHtml(l.id)}" data-testid="qty-increment" aria-label="Increase quantity of ${name}"${l.qty >= max ? ' disabled' : ''}>${icon('plus', 'icon icon--sm')}</button>
      </div>
      <button class="cart-line__remove" type="button" data-action="remove" data-id="${escapeHtml(l.id)}" data-testid="remove-line" aria-label="Remove ${name} from basket">${icon('trash', 'icon icon--sm')}<span>Remove</span></button>
    </div>
  </div>
  <strong class="cart-line__total price">${money(l.price * l.qty)}</strong>
</li>`;
}

function renderDrawerContents(state) {
  if (!drawer) return;
  const body = drawer.querySelector('[data-drawer-body]');
  const foot = drawer.querySelector('[data-drawer-foot]');
  const ship = drawer.querySelector('[data-drawer-ship]');
  const count = drawer.querySelector('[data-drawer-count]');
  const items = state.items;

  // Remember focus so re-rendering steppers doesn't drop the keyboard user.
  const active = document.activeElement;
  const focusKey = active && drawer.contains(active) && active.dataset.action
    ? `${active.dataset.action}:${active.dataset.id}` : null;

  count.textContent = state.count ? `(${state.count})` : '';
  drawer.querySelector('[data-drawer-subtotal]').textContent = money(state.totals.subtotal);

  if (!items.length) {
    body.innerHTML = `
<div class="cart-drawer__empty">
  <div class="cart-drawer__empty-art" aria-hidden="true">${icon('bag', 'icon icon--lg')}</div>
  <h3>Your basket is empty</h3>
  <p class="muted">Fill it with pilau kits, Kericho tea, choma rub and more.</p>
  <a class="btn btn--dark" href="/shop.html" data-action="continue-link">Start shopping ${icon('arrow-right')}</a>
</div>`;
    foot.hidden = true;
    ship.hidden = true;
    ship.innerHTML = '';
    return;
  }

  foot.hidden = false;
  ship.hidden = false;
  const t = state.totals;
  const progressBase = Math.max(0, t.subtotal - t.discount);
  const pct = Math.min(100, Math.round((progressBase / FREE_SHIPPING_THRESHOLD) * 100));
  ship.innerHTML = t.freeShippingEarned
    ? `<p class="ship-hint is-earned">${icon('check', 'icon icon--sm')} You've unlocked <strong>free standard delivery</strong>.</p>
       <div class="ship-bar" aria-hidden="true"><span style="width:100%"></span></div>`
    : `<p class="ship-hint">${icon('truck', 'icon icon--sm')} Add <strong>${money(t.amountToFreeShipping)}</strong> more for free standard delivery.</p>
       <div class="ship-bar" role="progressbar" aria-label="Progress to free shipping" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`;

  body.innerHTML = `<ul class="cart-lines">${items.map(drawerLine).join('')}</ul>`;

  if (focusKey) {
    const [action, id] = focusKey.split(':');
    const again = drawer.querySelector(`button[data-action="${action}"][data-id="${CSS.escape(id)}"]`);
    if (again && !again.disabled) again.focus();
    else drawer.querySelector('.cart-drawer__close')?.focus();
  }
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function onDrawerKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeCart(); return; }
  if (e.key !== 'Tab') return;
  const nodes = Array.from(drawer.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
  if (!nodes.length) { e.preventDefault(); drawer.focus(); return; }
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === drawer)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function openCart() {
  if (!drawer || drawer.classList.contains('is-open')) return;
  clearTimeout(closeTimer);
  lastFocus = document.activeElement;
  renderDrawerContents(cart.snapshot());
  drawer.hidden = false;
  backdrop.hidden = false;
  void drawer.offsetWidth;
  drawer.classList.add('is-open');
  backdrop.classList.add('is-open');
  document.body.classList.add('drawer-open');
  document.getElementById('main')?.setAttribute('inert', '');
  document.getElementById('site-header')?.setAttribute('inert', '');
  document.getElementById('site-footer')?.setAttribute('inert', '');
  (drawer.querySelector('.cart-drawer__close') || drawer).focus({ preventScroll: true });
}

export function closeCart() {
  if (!drawer || !drawer.classList.contains('is-open')) return;
  drawer.classList.remove('is-open');
  backdrop.classList.remove('is-open');
  document.body.classList.remove('drawer-open');
  document.getElementById('main')?.removeAttribute('inert');
  document.getElementById('site-header')?.removeAttribute('inert');
  document.getElementById('site-footer')?.removeAttribute('inert');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  closeTimer = setTimeout(() => { drawer.hidden = true; backdrop.hidden = true; }, reduce ? 0 : 320);
  // The opener may be gone (a dismissed toast's "View" button): fall back to the basket button so focus never lands on <body>.
  // A toast that is animating out is still in the DOM for ~260ms but about to vanish: treat it as gone too.
  // <body> passes every other check (it has focus() and is in the document) but is exactly where focus must not land.
  const usable = lastFocus && lastFocus !== document.body && typeof lastFocus.focus === 'function'
    && document.contains(lastFocus) && !lastFocus.closest('.toast');
  const target = usable ? lastFocus : document.querySelector('.cart-btn');
  target?.focus({ preventScroll: true });
  lastFocus = null;
}

/* ==========================================================================
   Toasts
   ========================================================================== */
let toastRegion;
const TOAST_ICONS = { success: 'check', error: 'alert-circle', info: 'info' };

function renderToastRegion() {
  toastRegion = document.createElement('div');
  toastRegion.className = 'toast-region';
  toastRegion.id = 'toast-region';
  toastRegion.setAttribute('aria-live', 'polite');
  toastRegion.setAttribute('aria-atomic', 'false');
  document.body.appendChild(toastRegion);
}

export function toast(message, { type = 'success', duration = 3200, action = null } = {}) {
  if (!toastRegion) renderToastRegion();
  const kind = TOAST_ICONS[type] ? type : 'info';
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast__icon">${icon(TOAST_ICONS[kind], 'icon icon--sm')}</span><span class="toast__msg"></span>`;
  el.querySelector('.toast__msg').textContent = String(message);
  if (action && action.label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast__action';
    b.textContent = action.label;
    b.addEventListener('click', () => { dismiss(); action.onClick?.(); });
    el.appendChild(b);
  }
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'toast__close';
  x.setAttribute('aria-label', 'Dismiss');
  x.innerHTML = icon('x', 'icon icon--sm');
  x.addEventListener('click', () => dismiss());
  el.appendChild(x);

  // Keep at most three on screen.
  while (toastRegion.children.length >= 3) toastRegion.firstElementChild.remove();
  toastRegion.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));

  let timer = setTimeout(dismiss, duration);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });

  function dismiss() {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
  }
  return dismiss;
}

/* ==========================================================================
   Boot
   ========================================================================== */
function boot() {
  renderHeader();
  renderFooter();
  renderDrawer();
  renderToastRegion();

  // Broken image guard: keep the tinted block, hide the broken icon.
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG') t.classList.add('is-broken');
  }, true);

  cart.subscribe((state) => { updateCount(state); if (drawer && !drawer.hidden) renderDrawerContents(state); });
  updateCount(cart.snapshot());

  window.MAM = Object.assign(window.MAM || {}, { toast, openCart, closeCart });
  document.dispatchEvent(new CustomEvent('mam:ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
