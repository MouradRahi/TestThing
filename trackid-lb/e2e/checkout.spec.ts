import { test, expect } from '@playwright/test'

// The one smoke path that must never regress: a customer can browse the
// catalog, add a piece to their cart, and complete a COD checkout — and the
// order they placed is the order that actually got persisted (confirmation
// page shows the same order number the URL redirected to). Deliberately does
// NOT hardcode a specific product/zone name — the dev catalog is real, shared
// data that gets reseeded/edited over time (see MIGRATIONS.md), so this picks
// "whichever product is first" and "whichever zone is first" instead.
//
// "First product" isn't necessarily "first *purchasable* product" though —
// stock naturally decrements as this exact suite (and manual dev-DB
// verification) runs over time, so a given product can drift to sold-out
// between sessions (confirmed happening for real: 2026-08-18, CI failed
// because the newest product had sold out and only showed a "Notify me"
// back-in-stock button, not "Add to Cart"). Walk the catalog until an
// actually-purchasable product is found instead of assuming the first one is.
test('browse → add to cart → COD checkout → order confirmation', async ({ page }) => {
  await page.goto('/shop')

  const productLinks = page.locator('a[href^="/product/"]')
  await expect(productLinks.first()).toBeVisible()
  const candidateCount = Math.min(await productLinks.count(), 10)

  // .isVisible() checks the DOM synchronously with no polling (unlike
  // .click()/expect(...).toBeVisible(), which auto-wait) — since the buy box
  // is client-rendered and may not have hydrated the instant the URL changes,
  // a plain .isVisible() here would false-negative on a page that just
  // hasn't finished rendering yet. waitFor() actually polls.
  async function isVisibleSoon(locator: ReturnType<typeof page.locator>, timeout = 5000) {
    return locator
      .first()
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false)
  }

  let addedToCart = false
  for (let i = 0; i < candidateCount && !addedToCart; i++) {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    await productLinks.nth(i).click()
    await expect(page).toHaveURL(/\/product\//)

    // Sized products (hoodies, tees…) require picking a size before "Add to
    // Cart" is meaningful; unsized/one-of-a-kind pieces skip straight to it.
    const sizeButtons = page.getByRole('button', { name: /^(S|M|L|XL)$/ })
    const addToCart = page.getByRole('button', { name: 'Add to Cart' })
    // Either the size picker, a direct "Add to Cart", or the sold-out
    // "Notify me" appears once the buy box has hydrated — wait for whichever
    // this product actually has. This is ONE locator on purpose: racing two
    // separate waits left the losing one still polling after the loop moved
    // on, and that dangling wait aborted the next iteration's page.goto()
    // with net::ERR_ABORTED once the catalog drifted enough for sold-out
    // products to actually exercise the retry path.
    const buyBox = page.getByRole('button', { name: /^(S|M|L|XL|Add to Cart|Notify me)$/ })
    await isVisibleSoon(buyBox)

    if (await isVisibleSoon(sizeButtons, 500)) {
      const enabledSize = sizeButtons.filter({ hasNot: page.locator(':disabled') }).first()
      if (!(await isVisibleSoon(enabledSize, 500))) continue // every size sold out
      await enabledSize.click()
    }

    if (!(await isVisibleSoon(addToCart, 2000))) continue // sold out (shows "Notify me" instead)
    await addToCart.click()
    addedToCart = true
  }
  expect(addedToCart, `none of the first ${candidateCount} shop products were purchasable`).toBe(true)

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
