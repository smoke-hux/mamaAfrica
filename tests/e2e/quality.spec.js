import { test, expect } from '@playwright/test';

const pages = ['/', '/shop.html', '/product.html?slug=jollof-rice-kit', '/about.html', '/cart.html', '/order-confirmation.html?id=MAM-NOPE00'];

for (const path of pages) {
  test(`${path} loads without errors or horizontal overflow`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // The not-found confirmation URL deliberately requests a missing order; Chrome logs that 404 as a console error.
    const allowed404 = path.includes('MAM-NOPE00');
    page.on('console', (m) => {
      const text = m.text();
      if (m.type() !== 'error' || /favicon|fonts\.g/i.test(text)) return;
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
