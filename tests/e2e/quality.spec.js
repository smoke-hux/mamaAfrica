import { test, expect } from '@playwright/test';

/**
 * The grid's first card is not necessarily buyable: other specs share this server and can sell a
 * product out, and a sold-out card's Add button is `disabled`, so clicking it waits forever.
 * Always pick a card that can actually be added.
 */
const addableCard = (page) =>
  page.locator('[data-testid="product-card"]:has([data-testid="add-to-cart"]:not([disabled]))');

const pages = ['/', '/shop.html', '/product.html?slug=pilau-kit', '/about.html', '/cart.html', '/order-confirmation.html?id=MAM-NOPE00'];

for (const path of pages) {
  test(`${path} loads without errors or horizontal overflow`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // The not-found confirmation URL deliberately requests a missing order; Chrome logs that 404 as a console error.
    const allowed404 = path.includes('MAM-NOPE00');
    page.on('console', (m) => {
      const text = m.text();
      // ERR_NETWORK_CHANGED is the host's network interface flapping mid-request, not a page
      // defect: a genuinely broken resource reports a 404 or ERR_ABORTED instead.
      if (m.type() !== 'error' || /favicon|fonts\.g|ERR_NETWORK_CHANGED/i.test(text)) return;
      if (allowed404 && /404/.test(text)) return;
      errors.push(text);
    });
    const res = await page.goto(path);
    expect(res.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#site-header header, header').first()).toBeVisible();
    await expect(page.locator('#site-footer footer, footer').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow px').toBeLessThanOrEqual(1);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('skip link and keyboard access to the cart drawer', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  const cartBtn = page.getByRole('button', { name: /cart/i }).first();
  await cartBtn.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  await expect(page.getByTestId('cart-drawer')).toHaveAttribute('role', 'dialog');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('cart-drawer')).toBeHidden();
});

test('API returns JSON 404 for unknown endpoints and pages return the 404 page', async ({ page }) => {
  const res = await page.request.get('/api/nope');
  expect(res.status()).toBe(404);
  expect(await res.json()).toEqual({ error: 'Not found' });
  const html = await page.goto('/this-page-does-not-exist');
  expect(html.status()).toBe(404);
  await expect(page.locator('main')).toContainText(/404|not found/i);
});

// The toast slides in and removes itself after ~3.2s. With animations on, a loaded machine can
// keep Playwright waiting for the button to be "stable" until the toast is already gone, and it
// then waits forever for one that will never return. Reduced motion makes it stable at once,
// and the app honours the setting, so this also matches how the feature behaves for that audience.
test.describe(() => {
  test.use({ reducedMotion: 'reduce' });
test('closing the drawer opened from a toast returns focus to the basket button', async ({ page }) => {
  await page.goto('/shop.html');
  await addableCard(page).first().getByTestId('add-to-cart').click();
  await page.locator('#toast-region').getByRole('button', { name: 'View' }).click();
  await expect(page.locator('#cart-drawer')).toBeVisible();
  // Close immediately, while the dismissed toast may still be in the DOM for its ~260ms exit. That is
  // the harder case: the opener still exists but is about to vanish, so closeCart() must not hand
  // focus back to it. Waiting for the toast first would test the easy path instead.
  await page.keyboard.press('Escape');
  await expect(page.locator('.cart-btn').first()).toBeFocused();
});
});
