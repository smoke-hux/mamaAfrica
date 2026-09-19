import { test, expect } from '@playwright/test';

/**
 * The grid's first card is not necessarily buyable: other specs share this server and can sell a
 * product out, and a sold-out card's Add button is `disabled`, so clicking it waits forever.
 * Always pick a card that can actually be added.
 */
const addableCard = (page) =>
  page.locator('[data-testid="product-card"]:has([data-testid="add-to-cart"]:not([disabled]))');

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
    const cards = addableCard(page);
    await expect(cards.first()).toBeVisible();
    // Count every card, not just the addable ones: this asserts the catalogue size.
    const total = await page.getByTestId('product-card').count();
    expect(total).toBeGreaterThanOrEqual(20);

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
    expect(totalText).toMatch(/KSh\s[\d,]+(\.\d{2})?/);

    await page.getByTestId('checkout-button').first().click();
    await expect(page).toHaveURL(/checkout\.html/);

    // Checkout: fill form (M-Pesa is the default, so pick card explicitly)
    await page.fill('#firstName', 'Wanjiru');
    await page.fill('#lastName', 'Kamau');
    await page.fill('#email', 'wanjiru@example.com');
    await page.fill('#phone', '+254 712 345 678');
    await page.fill('#line1', '12 Muthithi Road, Westlands');
    await page.fill('#city', 'Nairobi');
    await page.fill('#state', 'Nairobi');
    await page.fill('#postalCode', '00100');
    await page.selectOption('#country', 'KE');
    await expect(page.locator('#country')).toHaveValue('KE');

    await page.click('label[for="method-card"]');
    await expect(page.locator('#method-card')).toBeChecked();
    await page.fill('#cardNumber', '4242424242424242');
    await page.fill('#cardName', 'Wanjiru Kamau');
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
    expect(order.customer.email).toBe('wanjiru@example.com');
    expect(order.payment.last4).toBe('4242');
    expect(order.payment.cardNumber).toBeUndefined();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('checkout validation blocks bad input and shows field errors', async ({ page }) => {
    await page.goto('/shop.html');
    await addableCard(page).first().getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('1');
    await page.goto('/checkout.html');
    await page.fill('#email', 'not-an-email');
    // Leaving the email field shows its inline error, which shifts the single-column phone layout;
    // let that happen before clicking the Card option (M-Pesa is the default now, so this click must land).
    await page.locator('#email').blur();
    await expect(page.locator('#email').locator('xpath=ancestor::*[contains(@class,"field")]').first()).toHaveClass(/has-error/);
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
    await page.goto('/product.html?slug=kachumbari-chilli-sauce');
    await expect(page.locator('main h1')).toContainText('Kachumbari');
    await page.getByTestId('add-to-cart').first().click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-drawer')).toBeHidden();

    await page.goto('/checkout.html');
    await page.fill('#firstName', 'Otieno'); await page.fill('#lastName', 'Odhiambo');
    await page.fill('#email', 'otieno@example.com'); await page.fill('#phone', '0722123456');
    await page.fill('#line1', '5 Oginga Odinga Street'); await page.fill('#city', 'Kisumu');
    await page.fill('#postalCode', '40100'); await page.selectOption('#country', 'KE');
    await page.click('label[for="method-mobile"]');
    await expect(page.locator('#method-mobile')).toBeChecked();
    await page.selectOption('#provider', 'mpesa');
    await page.fill('#mobileNumber', '0722123456');
    await page.getByTestId('place-order').click();
    await expect(page).toHaveURL(/order-confirmation\.html\?id=MAM-/);
    await expect(page.getByTestId('order-id').first()).toContainText('MAM-');
    const id = (await page.getByTestId('order-id').first().innerText()).match(/MAM-[A-Z0-9]{6}/)[0];
    const { order } = await (await page.request.get(`/api/orders/${id}`)).json();
    expect(order.payment).toEqual({ method: 'mobile-money', provider: 'mpesa' });
  });

  test('empty cart redirects checkout to cart page', async ({ page }) => {
    await page.goto('/checkout.html');
    await expect(page).toHaveURL(/cart\.html/);
  });
});

test.describe('Shipping options', () => {
  test('arrow keys move through the shipping radios without losing focus', async ({ page }) => {
    await page.goto('/product.html?slug=pilau-kit');
    await page.getByTestId('add-to-cart').first().click();
    await page.goto('/cart.html');
    await page.locator('input[name="shippingMethod"][value="standard"]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('input[name="shippingMethod"][value="express"]')).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('input[name="shippingMethod"][value="pickup"]')).toBeChecked();
    await expect(page.locator('input[name="shippingMethod"][value="pickup"]')).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mam.cart.v1')).shippingMethod)).toBe('pickup');
  });

  test('Standard shows "Free" for a qualifying basket even while Express is selected', async ({ page }) => {
    await page.goto('/product.html?slug=pilau-kit'); // KSh 850 x 4 = KSh 3,400 > KSh 3,000
    await page.locator('[data-qty-input]').fill('4');
    await page.getByTestId('add-to-cart').first().click();
    await page.goto('/cart.html');
    await page.locator('input[name="shippingMethod"][value="express"]').check();
    const standardRow = page.locator('.radio-row', { has: page.locator('input[value="standard"]') });
    await expect(standardRow.locator('.radio-row__price')).toHaveText('Free');
    await expect(page.getByTestId('order-total').first()).toContainText('KSh');
  });

  test('adding beyond the stock cap does not claim success', async ({ page }) => {
    // Other specs share this server and consume stock, so assert against what is actually left
    // rather than the catalogue's starting figure: the point is that a second add cannot exceed it.
    const stock = (await (await page.request.get('/api/products/pilau-kit')).json()).product.stock;
    const cap = Math.min(20, stock);
    await page.goto('/product.html?slug=pilau-kit');
    const qty = page.locator('[data-qty-input]');
    // product.js re-syncs the stepper once it hydrates, which can clobber a fill that lands first.
    // Wait for the value to stick before adding, or a slow machine adds the default quantity instead.
    await qty.fill(String(cap));
    await expect(qty).toHaveValue(String(cap));
    await page.getByTestId('add-to-cart').first().click();
    await expect(page.getByTestId('cart-count').first()).toHaveText(String(cap));
    await page.keyboard.press('Escape');
    // The drawer takes ~320ms to hide; clicking through it lands on the overlay and the second add
    // never happens, so wait for it to be gone rather than racing the animation.
    await expect(page.locator('#cart-drawer')).toBeHidden();
    // product.js ignores a click while the button is in its ~1.2s "Added" flash, so a second click
    // fired too soon is silently swallowed and no cap message ever appears.
    await expect(page.getByTestId('add-to-cart').first()).not.toHaveClass(/is-added/);
    await page.getByTestId('add-to-cart').first().click();
    await expect(page.getByTestId('cart-count').first()).toHaveText(String(cap));
    await expect(page.locator('#toast-region')).toContainText(/the most we can send/);
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
          { id: 'p03', slug: 'mukimo-kit', name: 'Mukimo Kit with Pumpkin Leaves', price: 1, image: '/img/mukimo-kit.svg', unit: '', stock: 500, qty: 99 },
          { id: 'gone', slug: 'gone', name: 'Discontinued Thing', price: 5, image: '', unit: '', qty: 1 },
        ],
        promoCode: null, shippingMethod: 'standard',
      }));
    });
    const product = (await (await page.request.get('/api/products/mukimo-kit')).json()).product;

    await page.goto('/cart.html');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    const line = page.getByTestId('cart-line').first();
    await expect(line.locator('.qty__value')).toHaveValue(String(Math.min(20, product.stock))); // stock 35 → per-line cap 20
    await expect(line.locator('.cart-row__price')).toHaveText(`KSh ${product.price.toLocaleString('en-KE')}`); // KSh 520
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
    await page.goto('/product.html?slug=mukimo-kit');
    await page.getByTestId('add-to-cart').first().click();
    await expect(page.getByTestId('cart-count').first()).toHaveText('1');
    await page.route('**/api/orders/quote', (route) => route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ error: 'Validation failed', fields: { 'items[0].qty': 'Mukimo Kit with Pumpkin Leaves is out of stock' } }),
    }));

    await page.goto('/checkout.html');
    await page.fill('#firstName', 'Wanjiru');
    await page.fill('#lastName', 'Kamau');
    await page.fill('#email', 'wanjiru@example.com');
    await page.fill('#phone', '+254 712 345 678');
    await page.fill('#line1', '12 Muthithi Road, Westlands');
    await page.fill('#city', 'Nairobi');
    await page.fill('#postalCode', '00100');
    await page.selectOption('#country', 'KE');
    await page.click('label[for="method-cod"]');
    await page.getByTestId('place-order').click();

    const status = page.locator('#form-status');
    await expect(status).toContainText('Mukimo Kit with Pumpkin Leaves is out of stock');
    await expect(status).not.toContainText('Validation failed');
    await expect(page).toHaveURL(/checkout\.html/);
  });
});
