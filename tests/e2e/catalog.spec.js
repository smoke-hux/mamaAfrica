import { test, expect } from '@playwright/test';

test.describe('Catalog browsing', () => {
  test('category filter, search and sort update the grid and URL', async ({ page }) => {
    await page.goto('/shop.html');
    await expect(page.getByTestId('product-card').first()).toBeVisible();

    const chip = page.getByTestId('category-chip').filter({ hasText: /Meal Kits/i });
    await chip.click();
    await expect(page).toHaveURL(/category=meal-kits/);
    await expect(page.getByTestId('product-card')).toHaveCount(2);

    await page.goto('/shop.html');
    await page.getByTestId('search-input').fill('suya');
    await expect(page.getByTestId('product-card')).toHaveCount(1);
    await expect(page.getByTestId('product-card').first()).toContainText(/Suya/i);
    await expect(page).toHaveURL(/q=suya/);

    await page.goto('/shop.html?sort=price-asc');
    await expect(page.getByTestId('product-card')).toHaveCount(16);
    const prices = await page.getByTestId('product-card').locator('.price').allInnerTexts();
    const nums = prices.map((p) => parseFloat(p.replace(/[^0-9.]/g, '')));
    expect(nums.length).toBeGreaterThan(5);
    for (let i = 1; i < nums.length; i++) expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
  });

  test('search with no results shows an empty state', async ({ page }) => {
    await page.goto('/shop.html?q=zzzzqqq');
    await expect(page.getByTestId('product-card')).toHaveCount(0);
    await expect(page.locator('main')).toContainText(/no products|nothing|couldn.t find/i);
  });

  test('product page renders details, tabs and related items', async ({ page }) => {
    await page.goto('/product.html?slug=berbere-spice');
    await expect(page.locator('main h1')).toContainText('Berbere');
    await expect(page.locator('main')).toContainText('$7.90');
    const tabs = page.getByRole('tab');
    expect(await tabs.count()).toBeGreaterThanOrEqual(3);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText(/fenugreek/i);
    await expect(page.getByTestId('product-card').first()).toBeVisible(); // related
  });

  test('unknown product shows a not-found state', async ({ page }) => {
    await page.goto('/product.html?slug=does-not-exist');
    await expect(page.locator('main')).toContainText(/not found|couldn.t find/i);
  });

  test('cart persists across reloads and drawer quantity controls work', async ({ page }) => {
    await page.goto('/shop.html');
    await page.getByTestId('product-card').first().getByTestId('add-to-cart').click();
    await page.reload();
    await expect(page.getByTestId('cart-count').first()).toHaveText('1');
    await page.getByRole('button', { name: /cart/i }).first().click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();
    await page.getByTestId('cart-drawer').getByTestId('qty-increment').first().click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('2');
    await page.getByTestId('cart-drawer').getByTestId('remove-line').first().click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('0');
  });
});
