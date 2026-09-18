/** Shop page: filters, search, sort, URL sync, product grid. */
import { api } from '/js/api.js';
import { CATEGORY_LABELS, categoryLabel, escapeHtml } from '/js/format.js';
import { productCard, skeletonCard, bindAddToCart, mountReveal, icon } from '/js/components.js';

const SCROLL = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
const SORTS = ['featured', 'price-asc', 'price-desc', 'rating', 'name'];
const CATS = Object.keys(CATEGORY_LABELS);

const el = {
  chips: document.querySelector('[data-chips]'),
  form: document.querySelector('[data-search-form]'),
  search: document.querySelector('[data-testid="search-input"]'),
  clear: document.querySelector('[data-search-clear]'),
  sort: document.querySelector('[data-sort]'),
  count: document.querySelector('[data-count]'),
  activeTag: document.querySelector('[data-active-tag]'),
  grid: document.querySelector('[data-grid]'),
  empty: document.querySelector('[data-empty]'),
  title: document.querySelector('[data-shop-title]'),
  lead: document.querySelector('[data-shop-lead]'),
};

const state = readUrl();
const byId = new Map();
let requestId = 0;
let debounce = null;

/* ---------------- URL <-> state ---------------- */
function readUrl() {
  const u = new URL(location.href);
  const category = u.searchParams.get('category') || '';
  const sort = u.searchParams.get('sort') || 'featured';
  return {
    category: CATS.includes(category) ? category : '',
    q: (u.searchParams.get('q') || '').trim(),
    sort: SORTS.includes(sort) ? sort : 'featured',
    tag: (u.searchParams.get('tag') || '').trim(),
  };
}

function writeUrl() {
  const u = new URL(location.href);
  const p = u.searchParams;
  ['category', 'q', 'sort', 'tag'].forEach((k) => p.delete(k));
  if (state.category) p.set('category', state.category);
  if (state.q) p.set('q', state.q);
  if (state.sort && state.sort !== 'featured') p.set('sort', state.sort);
  if (state.tag) p.set('tag', state.tag);
  history.replaceState(null, '', `${u.pathname}${p.toString() ? `?${p}` : ''}`);
}

/* ---------------- Rendering ---------------- */
function renderChips(counts = {}) {
  const items = [{ slug: '', label: 'All' }, ...CATS.map((slug) => ({ slug, label: categoryLabel(slug) }))];
  el.chips.innerHTML = items.map(({ slug, label }) => {
    const n = slug ? counts[slug] : counts.__all;
    return `<button class="chip" type="button" data-testid="category-chip" data-category="${escapeHtml(slug)}" aria-pressed="${String(slug === state.category)}">${escapeHtml(label)}${n != null ? ` <span class="chip__count">${n}</span>` : ''}</button>`;
  }).join('');
}

function syncChips() {
  el.chips.querySelectorAll('[data-category]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.category === state.category)));
}

function renderHeading() {
  const cat = state.category ? categoryLabel(state.category) : null;
  if (el.title) {
    el.title.innerHTML = cat
      ? `${escapeHtml(cat)} <span class="italic-accent">aisle</span>`
      : 'Shop <span class="italic-accent">everything</span>';
  }
  if (el.lead) {
    el.lead.textContent = state.q
      ? `Results for “${state.q}”${cat ? ` in ${cat}` : ''}.`
      : cat ? LEADS[state.category] : 'Every jar, sachet and kit we stock, straight from the source.';
  }
  const parts = [cat, state.q ? `“${state.q}”` : null].filter(Boolean);
  document.title = `${parts.length ? parts.join(' · ') : 'Shop'} | Mama Afrika Market`;
}

const LEADS = {
  'meal-kits': 'Everything measured, nothing missing. Dinner in under an hour.',
  spices: 'Ground this month, not last year. Rubs and blends with real heat.',
  sauces: 'Slow-cooked condiments that go with absolutely everything.',
  staples: 'Flours, grains and oils that anchor every plate on the continent.',
  snacks: 'Kettle-fried, nutmeg-scented, gone before the film ends.',
  drinks: 'Ruby bissap and honeyed rooibos, hot or iced.',
};

function renderActiveTag() {
  el.activeTag.innerHTML = state.tag
    ? `<span class="active-filter">Tag: ${escapeHtml(state.tag)} <button type="button" aria-label="Remove tag filter ${escapeHtml(state.tag)}" data-remove-tag>${icon('x', 'icon icon--sm')}</button></span>`
    : '';
}

function showSkeletons() {
  el.grid.setAttribute('aria-busy', 'true');
  el.grid.classList.remove('is-fresh');
  el.grid.hidden = false;
  el.empty.hidden = true;
  el.grid.innerHTML = Array.from({ length: 8 }, skeletonCard).join('');
}

function renderEmpty({ error = false } = {}) {
  el.grid.hidden = true;
  el.empty.hidden = false;
  el.empty.innerHTML = error
    ? `<div class="state">
        <div class="state__art" aria-hidden="true">${icon('alert-circle', 'icon icon--lg')}</div>
        <h3>We couldn't reach the market</h3>
        <p class="muted">Something went wrong loading products. Please try again.</p>
        <div class="cluster"><button class="btn btn--dark" type="button" data-retry>Try again ${icon('rotate-ccw')}</button></div>
      </div>`
    : `<div class="state">
        <div class="state__art" aria-hidden="true">${icon('search-x', 'icon icon--lg')}</div>
        <h3>Nothing on this shelf</h3>
        <p class="muted">No products match ${state.q ? `“${escapeHtml(state.q)}”` : 'those filters'}. Try another spelling, or clear the filters.</p>
        <div class="cluster"><button class="btn btn--dark" type="button" data-clear-filters>Clear filters</button></div>
      </div>`;
}

function renderCount(n, total) {
  if (n === 0) { el.count.textContent = 'No products found'; return; }
  const noun = n === 1 ? 'product' : 'products';
  el.count.innerHTML = `<strong>${n}</strong> ${noun}${total != null && total !== n ? ` of ${total}` : ''}`;
}

/* ---------------- Data ---------------- */
async function load({ skeleton = true } = {}) {
  const id = ++requestId;
  renderHeading();
  renderActiveTag();
  syncChips();
  if (skeleton) showSkeletons();
  try {
    const res = await api.products({ category: state.category, q: state.q, sort: state.sort, tag: state.tag });
    if (id !== requestId) return;
    const products = res.products || [];
    byId.clear();
    products.forEach((p) => byId.set(p.id, p));
    if (!products.length) { renderCount(0); renderEmpty(); return; }
    renderCount(products.length, res.total);
    el.grid.hidden = false;
    el.empty.hidden = true;
    el.grid.classList.add('is-fresh');
    el.grid.innerHTML = products.map((p, i) => productCard(p, { index: i })).join('');
  } catch (err) {
    if (id !== requestId) return;
    el.count.textContent = 'Could not load products';
    renderEmpty({ error: true });
  } finally {
    if (id === requestId) el.grid.setAttribute('aria-busy', 'false');
  }
}

async function loadCategoryCounts() {
  try {
    const { categories = [] } = await api.categories();
    const counts = { __all: 0 };
    categories.forEach((c) => { counts[c.slug] = c.count; counts.__all += Number(c.count) || 0; });
    renderChips(counts);
  } catch { /* counts are decorative; chips already rendered */ }
}

/* ---------------- Events ---------------- */
function setCategory(slug) {
  if (state.category === slug) return;
  state.category = slug;
  writeUrl();
  load();
}

el.chips.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-category]');
  if (!btn) return;
  setCategory(btn.dataset.category || '');
  btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: SCROLL });
});

function applySearch(value, { immediate = false } = {}) {
  const q = String(value || '').trim();
  el.clear.hidden = !el.search.value;
  clearTimeout(debounce);
  const run = () => { if (q === state.q) return; state.q = q; writeUrl(); load(); };
  if (immediate) run(); else debounce = setTimeout(run, 250);
}

el.search.addEventListener('input', () => applySearch(el.search.value));
el.form.addEventListener('submit', (e) => { e.preventDefault(); applySearch(el.search.value, { immediate: true }); });
el.clear.addEventListener('click', () => { el.search.value = ''; applySearch('', { immediate: true }); el.search.focus(); });
el.sort.addEventListener('change', () => { state.sort = SORTS.includes(el.sort.value) ? el.sort.value : 'featured'; writeUrl(); load(); });

el.activeTag.addEventListener('click', (e) => {
  if (!e.target.closest('[data-remove-tag]')) return;
  state.tag = ''; writeUrl(); load();
});

el.empty.addEventListener('click', (e) => {
  if (e.target.closest('[data-clear-filters]')) {
    state.category = ''; state.q = ''; state.tag = ''; state.sort = 'featured';
    el.search.value = ''; el.clear.hidden = true; el.sort.value = 'featured';
    writeUrl(); load();
  } else if (e.target.closest('[data-retry]')) {
    load();
  }
});

// Header search hands off here on the shop page.
window.addEventListener('mam:search', (e) => {
  const q = e.detail?.q || '';
  el.search.value = q;
  applySearch(q, { immediate: true });
});

// Back/forward: re-read the URL.
window.addEventListener('popstate', () => {
  Object.assign(state, readUrl());
  el.search.value = state.q; el.clear.hidden = !state.q; el.sort.value = state.sort;
  load();
});

/* ---------------- Boot ---------------- */
el.search.value = state.q;
el.clear.hidden = !state.q;
el.sort.value = state.sort;
renderChips();
bindAddToCart(el.grid, (id) => byId.get(id));
mountReveal();
load();
loadCategoryCounts();
