/** About page: reveal observers + counting stat numerals. */
import { mountReveal } from '/js/components.js';

mountReveal();

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const counters = document.querySelectorAll('[data-count]');

function countUp(el) {
  const target = Number(el.dataset.count) || 0;
  if (reduce || !target) { el.textContent = String(target); return; }
  const dur = 1100;
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function tick(now) {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = String(Math.round(target * ease(t)));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

if (counters.length) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { countUp(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.4 });
    // Numbers stay readable until they scroll into view, then count up from zero.
    counters.forEach((el) => io.observe(el));
  } else {
    counters.forEach(countUp);
  }
}
