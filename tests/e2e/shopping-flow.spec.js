import { test, expect } from '@playwright/test';

test.describe('Full shopping journey', () => {
  test('browse → add to cart → cart → checkout with card → confirmation', async ({ page }) => {
    // Five pages in one test. Headless Chrome paints backdrop-filter in software, so on a busy machine
    // this sits close to the default 45s; slow() triples the limit for this test only.
    test.slow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Home loads with hero and featured products
    await page.goto('/');
    await expect(page).toHaveTitle(/Mama Afrika Market/);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByTestId('product-card').first()).toBeVisible();

    // Shop page: add two products
    await page.goto('/shop.html');
    const cards = page.getByTestId('product-card');
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    expect(total).toBeGreaterThanOrEqual(16);

    await cards.nth(0).getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('1');
    await cards.nth(1).getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('2');

    // Cart page: increment, promo, totals
    await page.goto('/cart.html');
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await page.getByTestId('cart-line').first().getByTestId('qty-increment').click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('3');

    await page.getByTestId('promo-input').fill('karibu10');
    await page.getByTestId('promo-apply').click();
    await expect(page.locator('body')).toContainText(/10% off/i);

    const totalText = await page.getByTestId('order-total').first().innerText();
    expect(totalText).toMatch(/\$\d+\.\d{2}/);

    await page.getByTestId('checkout-button').first().click();
    await expect(page).toHaveURL(/checkout\.html/);

    // Checkout: fill form
    await page.fill('#firstName', 'Amara');
    await page.fill('#lastName', 'Okafor');
    await page.fill('#email', 'amara@example.com');
    await page.fill('#phone', '+1 555 010 2233');
    await page.fill('#line1', '12 Market Street');
    await page.fill('#city', 'Houston');
    await page.fill('#state', 'TX');
    await page.fill('#postalCode', '77002');
    await page.selectOption('#country', 'US');

    await page.click('label[for="method-card"]');
    await expect(page.locator('#method-card')).toBeChecked();
    await page.fill('#cardNumber', '4242424242424242');
    await page.fill('#cardName', 'Amara Okafor');
    await page.fill('#expiry', '12/30');
    await page.fill('#cvc', '123');

    const checkoutTotal = await page.getByTestId('order-total').first().innerText();
    await page.getByTestId('place-order').click();

    // Confirmation
    await expect(page).toHaveURL(/order-confirmation\.html\?id=MAM-[A-Z0-9]{6}/);
    await expect(page.getByTestId('order-id').first()).toContainText(/MAM-[A-Z0-9]{6}/);
    const orderId = await page.getByTestId('order-id').first().innerText();
    await expect(page.locator('body')).toContainText(checkoutTotal.trim());
    await expect(page.getByTestId('cart-count').first()).toHaveText('0');

    // Order is retrievable from the API
    const id = orderId.match(/MAM-[A-Z0-9]{6}/)[0];
    const res = await page.request.get(`/api/orders/${id}`);
    expect(res.ok()).toBeTruthy();
    const { order } = await res.json();
    expect(order.customer.email).toBe('amara@example.com');
    expect(order.payment.last4).toBe('4242');
    expect(order.payment.cardNumber).toBeUndefined();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('checkout validation blocks bad input and shows field errors', async ({ page }) => {
    await page.goto('/shop.html');
    await page.getByTestId('product-card').first().getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('1');
    await page.goto('/checkout.html');
    await page.fill('#email', 'not-an-email');
    await page.click('label[for="method-card"]');
    await expect(page.locator('#method-card')).toBeChecked();
    await page.fill('#cardNumber', '4242424242424241'); // fails Luhn
    await page.fill('#expiry', '01/20'); // expired
    await page.getByTestId('place-order').click();
    await expect(page).toHaveURL(/checkout\.html/);
    const visibleErrors = page.locator('.field.has-error .field__error');
    await expect(visibleErrors.first()).toBeVisible();
    expect(await visibleErrors.count()).toBeGreaterThanOrEqual(3);
  });

  test('mobile money checkout path works', async ({ page }) => {
    await page.goto('/product.html?slug=shito-sauce');
    await expect(page.locator('main h1')).toContainText('Shito');
    await page.getByTestId('add-to-cart').first().click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-drawer')).toBeHidden();

    await page.goto('/checkout.html');
    await page.fill('#firstName', 'Kwame'); await page.fill('#lastName', 'Mensah');
    await page.fill('#email', 'kwame@example.com'); await page.fill('#phone', '0244123456');
    await page.fill('#line1', '5 Oxford St'); await page.fill('#city', 'Accra');
    await page.fill('#postalCode', 'GA-145'); await page.selectOption('#country', 'GH');
    await page.click('label[for="method-mobile"]');
    await expect(page.locator('#method-mobile')).toBeChecked();
    await page.selectOption('#provider', { index: 1 });
    await page.fill('#mobileNumber', '0244123456');
    await page.getByTestId('place-order').click();
    await expect(page).toHaveURL(/order-confirmation\.html\?id=MAM-/);
    await expect(page.getByTestId('order-id').first()).toContainText('MAM-');
  });

  test('empty cart redirects checkout to cart page', async ({ page }) => {
    await page.goto('/checkout.html');
    await expect(page).toHaveURL(/cart\.html/);
  });
});

test.describe('Stale cart data', () => {
  test('cart page refreshes prices and stock from the catalog', async ({ page }) => {
    // A cart saved long ago: wrong price, more units than exist, and a product that is gone.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('mam.cart.v1', JSON.stringify({
        items: [
          { id: 'p16', slug: 'ndole-kit', name: 'Ndolé Dinner Kit', price: 1, image: '/img/ndole-kit.svg', unit: '', stock: 500, qty: 99 },
          { id: 'gone', slug: 'gone', name: 'Discontinued Thing', price: 5, image: '', unit: '', qty: 1 },
        ],
        promoCode: null, shippingMethod: 'standard',
      }));
    });
    const product = (await (await page.request.get('/api/products/ndole-kit')).json()).product;

    await page.goto('/cart.html');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    const line = page.getByTestId('cart-line').first();
    await expect(line.locator('.qty__value')).toHaveValue(String(Math.min(99, product.stock)));
    await expect(line.locator('.cart-row__price')).toHaveText(`$${product.price.toFixed(2)}`);
    await expect(page.locator('#toast-region')).toContainText(/Discontinued Thing is no longer available/);
  });

  test('checkout sends an emptied cart back to the cart page and still says why', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('mam.cart.v1', JSON.stringify({
        items: [{ id: 'gone', slug: 'gone', name: 'Discontinued Thing', price: 5, image: '', unit: '', qty: 1 }],
        promoCode: null, shippingMethod: 'standard',
      }));
    });
    await page.goto('/checkout.html');
    await expect(page).toHaveURL(/cart\.html/);
    await expect(page.getByTestId('cart-line')).toHaveCount(0);
    await expect(page.locator('#toast-region')).toContainText(/Discontinued Thing is no longer available/);
  });

  test('checkout explains a stock shortfall instead of a bare "Validation failed"', async ({ page }) => {
    await page.goto('/product.html?slug=ndole-kit');
    await page.getByTestId('add-to-cart').first().click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('1');
    await page.route('**/api/orders/quote', (route) => route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ error: 'Validation failed', fields: { 'items[0].qty': 'Ndolé Dinner Kit is out of stock' } }),
    }));

    await page.goto('/checkout.html');
    await page.fill('#firstName', 'Amara');
    await page.fill('#lastName', 'Okafor');
    await page.fill('#email', 'amara@example.com');
    await page.fill('#phone', '+1 555 010 2233');
    await page.fill('#line1', '12 Market Street');
    await page.fill('#city', 'Houston');
    await page.fill('#postalCode', '77002');
    await page.selectOption('#country', 'US');
    await page.click('label[for="method-cod"]');
    await page.getByTestId('place-order').click();

    const status = page.locator('#form-status');
    await expect(status).toContainText('Ndolé Dinner Kit is out of stock');
    await expect(status).not.toContainText('Validation failed');
    await expect(page).toHaveURL(/checkout\.html/);
  });
});
