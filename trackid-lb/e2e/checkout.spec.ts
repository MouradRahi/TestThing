import { test, expect } from '@playwright/test'

// The one smoke path that must never regress: a customer can browse the
// catalog, add a piece to their cart, and complete a COD checkout — and the
// order they placed is the order that actually got persisted (confirmation
// page shows the same order number the URL redirected to). Deliberately does
// NOT hardcode a specific product/zone name — the dev catalog is real, shared
// data that gets reseeded/edited over time (see MIGRATIONS.md), so this picks
// "whichever product is first" and "whichever zone is first" instead.
test('browse → add to cart → COD checkout → order confirmation', async ({ page }) => {
  await page.goto('/shop')

  const firstProduct = page.locator('a[href^="/product/"]').first()
  await expect(firstProduct).toBeVisible()
  await firstProduct.click()

  await expect(page).toHaveURL(/\/product\//)

  // Sized products (hoodies, tees…) require picking a size before "Add to
  // Cart" is meaningful; unsized/one-of-a-kind pieces skip straight to it.
  const sizeButtons = page.getByRole('button', { name: /^(S|M|L|XL)$/ })
  if (await sizeButtons.first().isVisible().catch(() => false)) {
    const enabledSize = sizeButtons.filter({ hasNot: page.locator(':disabled') }).first()
    await enabledSize.click()
  }

  await page.getByRole('button', { name: 'Add to Cart' }).click()

  // Adding to cart opens the mini-cart drawer (CartDrawer.tsx) without a
  // navigation — "Checkout" is a link inside it straight to /checkout.
  await page.getByRole('link', { name: 'Checkout' }).click()
  await expect(page).toHaveURL('/checkout')
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()

  await page.locator('input[name="customerName"]').fill('Playwright Smoke Test')
  await page.locator('input[name="customerPhone"]').fill('+9611234567')
  await page.locator('input[name="customerEmail"]').fill('playwright-smoke@example.com')

  // Area is a <select> when SiteSettings has delivery zones configured (true
  // on dev, see MIGRATIONS.md) and free text otherwise — handle both so this
  // test doesn't break if a future dev DB is seeded without zones.
  const areaSelect = page.locator('select[name="area"]')
  if (await areaSelect.isVisible().catch(() => false)) {
    await areaSelect.selectOption({ index: 1 }) // index 0 is the empty placeholder
  } else {
    await page.locator('input[name="area"]').fill('Beirut')
  }

  await page.locator('textarea[name="deliveryAddress"]').fill('123 Test Street, near the old cinema')

  // Payment method defaults to Cash on Delivery — this suite intentionally
  // only covers COD (the only payment method the app can complete end-to-end
  // right now; card/OMT are ROADMAP.md Part 2, not yet built).
  await expect(page.locator('input[name="paymentMethod"][value="cod"]')).toBeChecked()

  await page.getByRole('button', { name: 'Place Order' }).click()

  // Server-authoritative order creation — wait for the redirect, not a fixed
  // timeout (POST /api/orders does real work: price/stock resolution, an
  // atomic stock decrement, order creation).
  await expect(page).toHaveURL(/\/order\/[A-Z0-9-]+/, { timeout: 15_000 })

  const orderNumber = page.url().split('/order/')[1]
  await expect(page.getByRole('heading', { name: 'Order received' })).toBeVisible()
  // The confirmation page re-fetches the order by number from the DB — this
  // assertion is the "order appears in admin" proof: if the order weren't
  // actually persisted, this page would 404 instead of rendering the number.
  await expect(page.getByText(orderNumber, { exact: true })).toBeVisible()
  // .first() — "Cash on Delivery" also appears in the footer tagline; the
  // order's own payment-method line renders earlier in the DOM.
  await expect(page.getByText('Cash on Delivery').first()).toBeVisible()
})
