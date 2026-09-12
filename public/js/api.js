/** Thin fetch wrapper for the store API. All endpoints return JSON. */
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  products: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
    return request('/products' + (qs ? `?${qs}` : ''));
  },
  product: (slug) => request(`/products/${encodeURIComponent(slug)}`),
  categories: () => request('/categories'),
  validatePromo: (code) => request('/promo/validate', { method: 'POST', body: JSON.stringify({ code }) }),
  quote: (payload) => request('/orders/quote', { method: 'POST', body: JSON.stringify(payload) }),
  createOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  order: (id) => request(`/orders/${encodeURIComponent(id)}`),
  subscribe: (email) => request('/newsletter', { method: 'POST', body: JSON.stringify({ email }) }),
};
export default api;
