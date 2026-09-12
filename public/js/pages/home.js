/** Home page: featured grid + reveal observers. */
import { api } from '/js/api.js';
import { productCard, skeletonCard, bindAddToCart, mountReveal, icon } from '/js/components.js';

const grid = document.getElementById('featured-grid');
const byId = new Map();

function showSkeletons(n = 4) {
  grid.innerHTML = Array.from({ length: n }, skeletonCard).join('');
}

async function loadFeatured() {
  if (!grid) return;
  showSkeletons();
  try {
    const { products = [] } = await api.products({ featured: 'true' });
    const list = products.slice(0, 8);
    if (!list.length) throw new Error('No featured products');
    list.forEach((p) => byId.set(p.id, p));
    grid.classList.add('is-fresh');
    grid.innerHTML = list.map((p, i) => productCard(p, { index: i })).join('');
  } catch (err) {
    grid.classList.remove('is-fresh');
    grid.innerHTML = `
<div class="state" style="grid-column: 1 / -1">
  <div class="state__art" aria-hidden="true">${icon('alert-circle', 'icon icon--lg')}</div>
  <h3>The shelves are being restocked</h3>
  <p class="muted">We couldn't load featured products right now. Browse the full market instead.</p>
  <div class="cluster">
    <a class="btn btn--dark" href="/shop.html">Go to the shop ${icon('arrow-right')}</a>
    <button class="btn btn--outline" type="button" data-retry>Try again</button>
  </div>
</div>`;
    grid.querySelector('[data-retry]')?.addEventListener('click', loadFeatured);
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

bindAddToCart(grid, (id) => byId.get(id));
mountReveal();
loadFeatured();
