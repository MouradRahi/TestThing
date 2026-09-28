# trackID.lb — Bug Tracker

> Created 2026-07-11 (Session 22) from a fresh critical audit of the live site's code.
> Scope note: the **AI Assistant (§8)** and **online payments** are explicitly OUT of scope for now — nothing here touches them.
>
> Status legend: ☐ open · ☑ fixed (note the session) · ◐ partially fixed
> Severity: **P0** breaks money/customers · **P1** visible wrongness or data risk · **P2** polish/consistency
>
> Keep this file updated: when a bug is fixed, flip its box, add the session number, and note the fix in CLAUDE.md's session log.
>
> **Session 22 correctness sweep**: B2, B3, B5, B6, B7, B8, B11, B13, B15, B23 fixed; B16 mostly (layout description fallback folded into B10). New shared helpers: `src/lib/format.ts → formatPrice()` and `EMAIL_RE`/`isValidPhone` in `api-guards.ts`. `npx tsc --noEmit` + `npm run build` verified (57 pages).

---

## P0 — Customers or money actively hurt

### B1 ☑ FIXED (Session 22, part 4) — No forgot-password / reset-password flow — customers get permanently locked out
Accounts launched (Session 19) with login/register/logout only. `src/app/api/account/` has **no** forgot-password, reset-password, or change-password route, and `AuthForm.tsx` has no "Forgot password?" link. A customer who forgets their password can never recover the account (admin can't help either — Payload hashes are one-way; the admin would have to set a new password manually and communicate it insecurely).
- **Fixed**: `POST /api/account/forgot-password` (rate-limited 5/10min/IP, always responds `{ ok: true }` — never reveals whether the email is registered) calls `payload.forgotPassword({ disableEmail: true })` and sends a branded reset email itself via `sendPasswordResetEmail()` in `notifications.ts` (mirrors the existing status-email template; skips gracefully with no `RESEND_API_KEY`). `POST /api/account/reset-password` calls `payload.resetPassword()`, folds the guest cart in, and logs the customer in (same pattern as register). `POST /api/account/change-password` re-verifies the current password via a real `payload.login()` call before updating (a hijacked/shared session can't lock the real owner out) and re-issues the auth cookie. New pages `/account/forgot-password` and `/account/reset/[token]`; "Forgot password?" link added to the login form; a Password section (current/new/confirm) added to the account page. `Customers.auth.forgotPassword.expiration` set to 30 minutes (was Payload's 1h default).
- Files: `src/app/api/account/{forgot-password,reset-password,change-password}/route.ts`, `src/components/account/{AuthForm,ForgotPasswordForm,ResetPasswordForm,ChangePasswordForm}.tsx`, `src/app/[locale]/(frontend)/account/{forgot-password,reset/[token]}/page.tsx`, `src/app/[locale]/(frontend)/account/page.tsx`, `src/lib/notifications.ts`, `src/collections/Customers.ts`, `messages/{en,ar}.json`.

### B2 ☑ FIXED (Session 22) — Product `description` (rich text, localized) is never rendered anywhere
The Products collection has a localized rich-text `description` the owner writes in admin — and no storefront component reads it. `product/[slug]/page.tsx` renders title, price, tags, and the **generic** CMS `productBlurb` only; grep for `RichTextRenderer` shows it's used by CMS pages only. For a brand selling one-of-a-kind hand-painted storytelling pieces, the piece's own story is invisible.
- **Fix**: render `product.description` through `RichTextRenderer` in the details column (between price/badges and the meta block). Falls back to nothing when empty; keep `productBlurb` as the closing paragraph.
- Files: `src/app/[locale]/(frontend)/product/[slug]/page.tsx:261-288`.

### B3 ☑ FIXED (Session 22) — `/order/[orderNumber]` could cache; now `force-dynamic` (verified `ƒ` + absent from prerender-manifest)
The page exports no `dynamic`/`revalidate`, has no `generateStaticParams`, and reads no dynamic API — so Next renders it **once on first visit and caches it indefinitely**. `Orders`' `afterChange` hook sends status emails but never revalidates `/order/<n>` (grep confirms: zero `safeRevalidate*` in `src/collections/Orders.ts`). Consequence: the `/track` feature ("live status", IMPROVEMENTS 2.6) shows the status frozen at whatever it was on first view; a customer re-checking their order sees "Pending" forever.
- **Verify**: `npm run build` route table — if `/[locale]/order/[orderNumber]` is `●` (SSG/ISR) not `ƒ`, the bug is live.
- **Fix**: `export const dynamic = 'force-dynamic'` on the page (it's per-customer, low-traffic, and must always be fresh — same call as `/account`). Alternatively revalidate the path in the Orders `afterChange` hook, but force-dynamic is simpler and safer here.
- Files: `src/app/[locale]/(frontend)/order/[orderNumber]/page.tsx`, optionally `src/collections/Orders.ts`.

### B4 ☑ FIXED (Session 22, part 5) — `/api/cart` has no rate limit and abandoned guest carts are never deleted
Every other public POST route uses `rateLimit()`; the cart route uses none. A cookie-less client (curl/bot) that POSTs `action:add` gets a **new `carts` row per request** — unbounded DB growth on the free-tier Postgres, no cleanup job anywhere (`CART_COOKIE_MAX_AGE` is 60 days but the rows outlive the cookie forever).
- **Fixed**: (a) `rateLimit('cart:'+ip, 60, 10min)` added to `POST /api/cart`. (b) New `GET /api/cron/cleanup-carts` deletes guest carts (`sessionId` set, `customer` null, `updatedAt` < 90 days ago) via one bulk `payload.delete({ where: { and: [...] } })` — verified against the real dev schema. Guarded by `CRON_SECRET` in production (mirrors the seed route's dev-open/prod-guarded pattern); Vercel signs its own Cron Job requests with that secret automatically once it's set, so no header wiring needed on the Vercel side. Scheduled daily (3am) via new `vercel.json` (`crons[]`) — this is the first cron job in the project, so it also stands up the pattern for the Part 4 scheduled reports and Part 6 abandoned-cart-recovery work already on ROADMAP.md. (c) Cap items per cart was already `MAX_LINES = 30` ✓.
- Files: `src/app/api/cart/route.ts`, `src/app/api/cron/cleanup-carts/route.ts` (new), `vercel.json` (new), `.env.local.example`, `DEPLOY.md`.

---

## P1 — Visible wrongness — ☑ ALL FIXED (Session 22, part 11; B25 added + fixed Session 29)

### B25 ☑ FIXED (Session 29) — Staff new-order WhatsApp alert silently fails outside a 24h window
`sendOrderWhatsAppAlert()` (`notifications.ts`) sent a plain free-text message — WhatsApp's
Business Messaging Policy only allows that within 24h of the *recipient* last messaging the
business first. Any staff member who hadn't recently texted the business's WhatsApp number
got nothing on a new order, with no error visible anywhere in the app (the failure only shows
up in Meta's own delivery-status webhook, which nothing in this codebase was listening to).
Found via live testing while setting up WhatsApp Cloud API credentials for real — confirmed
via the actual delivery webhook payload: error 131047, "Re-engagement message."
- **Fix**: converted to an approved-template send (`WHATSAPP_ORDER_ALERT_TEMPLATE_NAME`),
  which bypasses the 24h-window restriction entirely — same pattern the sibling
  `sendOrderStatusWhatsApp()` already used for exactly this reason. Also added a new
  customer-facing order-confirmation WhatsApp message (`sendOrderConfirmationWhatsApp`,
  `WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_NAME`) that didn't exist before.
- Files: `src/lib/notifications.ts`, `src/app/api/orders/route.ts`, `src/collections/Orders.ts`.
- ⚠️ Both templates are submitted to Meta for approval as of this writing — the fix is
  code-complete but not yet *live* until the template names are set once approved.

### B5 ☑ FIXED (Session 22) — Cart & checkout flash "empty" while the server cart loads
`CartContext` starts with `items: []` and no loading flag; `/checkout` and `/cart` render their empty states immediately, then pop the items in when `GET /api/cart` returns. On a slow connection a customer with a full cart sees "Your cart is empty / Find a piece that speaks to you" for seconds — on checkout, that's an abandonment trigger.
- **Fix**: add `status: 'loading' | 'ready'` to `CartContext`; cart page, checkout page, and drawer render a small skeleton (or nothing) until ready. Nav badge should also not flash 0→N.
- Files: `src/components/cart/CartContext.tsx`, `cart/page.tsx`, `CheckoutForm.tsx`, `CartDrawer.tsx`.

### B6 ☑ FIXED (Session 22) — Add-to-cart failures are silent — optimistic item stays in the UI
`CartContext.mutate()` ignores non-ok responses: the optimistic `setItems` addition is **not reverted** and no message is shown. If the piece just sold out (server 409 "no longer available") or the size is invalid, the customer sees it sitting in their cart and only finds out at checkout.
- **Fix**: on non-ok response, re-fetch the authoritative cart (`refreshCart()`) **and** surface the server's error message (reuse the `CartNotices` channel or a small toast). Same for `update`/`remove` failures.
- Files: `src/components/cart/CartContext.tsx:71-88`.

### B7 ☑ FIXED (Session 22) — Cart drawer rounds all prices to whole dollars
`CartDrawer` renders `${(item.price * item.quantity).toFixed(0)}` and `${total.toFixed(0)}` — a $45.50 piece shows as **$46** (rounds, not truncates) while the cart page and checkout correctly show $45.50. Customers see two different totals for the same cart.
- **Fix**: `.toFixed(2)` (or a shared `formatPrice()` helper — see B15/B16, one helper fixes all price-formatting inconsistencies).
- Files: `src/components/cart/CartDrawer.tsx:142,152`.

### B8 ☑ FIXED (Session 22) — Shop search form drops the Arabic locale
The search `<form action="/shop">` submits a plain GET to the unprefixed path — with `localePrefix: 'as-needed'` that is the **English** shop. An Arabic user typing a search lands on the English site with English results.
- **Fix**: compute the action with the locale prefix (`locale === 'en' ? '/shop' : '/' + locale + '/shop'`), or a tiny client wrapper using `useRouter` from `@/i18n/navigation`. Audit for the same pattern anywhere else a raw `action`/`href` string is used (TrackForm uses the i18n router ✓ — verify).
- Files: `src/app/[locale]/(frontend)/shop/page.tsx:106`.

### B9 ☑ FIXED (Session 22, part 11) — Arabic pages declare the English URL as canonical; no hreflang anywhere
Product/artist/shop/pages set `alternates.canonical: '/product/<slug>'` etc. — unprefixed, so on `/ar/product/x` the canonical tag points to the **English** page. Search engines are being told the Arabic site is a duplicate of the English one; combined with zero `alternates.languages` (hreflang), Arabic content will effectively never rank. The sitemap emits `/ar` URLs whose pages then canonicalize away from themselves — contradictory signals.
- **Fixed**: new `src/lib/seo.ts → localizedAlternates(path, locale)` — canonical points at the *current* locale's own URL, `languages` lists every locale plus `x-default`. Applied to all 5 spots: `product/[slug]`, `artist/[slug]`, `[slug]` + `p/[slug]` (the CMS-page renderer and its `/p` alias, both already canonicalized to the clean URL — now locale-aware too), and the root `(frontend)/layout.tsx` (the homepage's own metadata — it has no page-level override, so this is what actually governs `/` and `/ar`). `shop/page.tsx` needed converting from a static `export const metadata` to an async `generateMetadata()` since a static object can't read the request locale. Verified against a real built+started server: `/product/x` correctly canonicals to itself (no prefix) with `hreflang="ar"` pointing at `/ar/product/x`; `/ar/product/x` correctly canonicals to `/ar/product/x` with the full en/ar/x-default set present on both.
- Files: `src/lib/seo.ts` (new), `product/[slug]/page.tsx`, `artist/[slug]/page.tsx`, `shop/page.tsx`, `[slug]/page.tsx`, `p/[slug]/page.tsx`, `(frontend)/layout.tsx`.

### B10 ☑ FIXED (Session 22, part 11) — Product SEO copy is hardcoded English (and brand-voice-locked) for every locale
`generateMetadata` + JSON-LD build `"Hand-painted by ${storeName} — …"` — the phrase is baked-in English even on `/ar` pages (Arabic pages get English meta descriptions) and locks the "hand-painted" brand voice into code, which 3.2 (white-label Copy tab) was supposed to have eliminated. Same string in the JSON-LD `description`.
- **Fixed**: new **localized** Copy-tab field `productMetaPattern` (`SiteSettings.ts`), default `'Hand-painted by {store} — {title}. {tagline}'`, plus `resolveProductMetaDescription()` (`site-settings.ts`) that interpolates it. Also fixed `productMetaTagline` itself missing `localized: true` — it was a per-brand override but not a per-*locale* one, the same bug in miniature. Both `generateMetadata`'s meta description and the JSON-LD `description` now call the same resolver (previously the JSON-LD version was a second, slightly different hardcoded copy that was even missing the tagline). An admin can now translate the whole pattern per locale — word order legitimately differs in Arabic, which a placeholder-only translation wouldn't fix — and a white-label reseller isn't stuck with "Hand-painted" regardless of vertical. Verified: built page's `<meta name="description">` and JSON-LD `description` now both read "Hand-painted by trackID.lb — Vinyl Enamel Pin. One-of-a-kind piece, made in Lebanon." — correctly interpolated and, for the first time, identical to each other.
- Files: `src/globals/SiteSettings.ts`, `src/lib/site-settings.ts`, `product/[slug]/page.tsx`.

### B11 ☑ FIXED (Session 22) — Order confirmation says delivery is "Free" when the store has no zones configured
The page renders `deliveryFee > 0 ? $X : "Free"`. For a store without delivery zones the fee is 0 because it's **unknown** (checkout correctly says "confirmed by phone") — but the confirmation page and the customer's mental record say "Free". Wrong promise, support burden.
- **Fix**: thread the same `zonesConfigured` distinction the orders API already computes — simplest: store `deliveryFee: null`-vs-0 semantics, or check `getDeliveryZones(settings).length` on the page and show the "confirmed by phone" copy when no zones exist. Check the email template for the same conflation.
- Files: `order/[orderNumber]/page.tsx:89-94`, `src/lib/notifications.ts`.

### B12 ☑ FIXED (Session 22, part 11) — Rapid cart clicks can reconcile out of order
Each +/− click fires `mutate()`; responses `setItems` unconditionally. Two in-flight requests can resolve in reverse order (network jitter), leaving the UI showing the older server state (e.g. click + + fast → shows qty 2, server says 3). Server data is fine; display is wrong until next refresh.
- **Fixed**: a `useRef` monotonic request counter — each `mutate()` call claims the next id before firing its fetch, and only applies a response (success or error-notice) if its id still matches the *latest* issued id when the response arrives; anything superseded by a newer mutation is silently discarded. Every response is a full cart snapshot, so this is correct with a single global counter (not per-line) — whichever mutation was issued last always carries the complete, correct state forward, regardless of arrival order.
- **Verification note**: confirmed by code review (a standard, low-risk "latest request wins" pattern) plus the full Playwright checkout suite still passing — did not build a dedicated network-delay race test (would need Playwright route-interception with artificial delays); flagging that gap rather than overstating the verification depth.
- Files: `src/components/cart/CartContext.tsx`.

### B13 ☑ FIXED (Session 22) — Orders API accepts any string as `customerEmail`
`cleanOptional(body.customerEmail, 160)` — no format check (register route has `EMAIL_RE`, orders doesn't). A typo'd email is stored, the confirmation silently never arrives, and Resend rejects the send (noise in logs, no feedback to anyone).
- **Fix**: reuse the same `EMAIL_RE`; reject with a clear 400 (client already has per-field HTML5 `type="email"` but server must enforce). While there: validate profile-route `phone` with the same phone regex the checkout uses (junk saved phones currently prefill checkout and then fail its validation — dead-end UX).
- Files: `src/app/api/orders/route.ts:143`, `src/app/api/account/profile/route.ts:28`, move `EMAIL_RE`/`PHONE_RE` into `src/lib/api-guards.ts`.

### B14 ☑ FIXED (Session 22, part 6) — Discount `usageLimit` check-then-increment race
`resolveDiscount` reads `usageCount < usageLimit`, and the increment happened after order creation — two concurrent checkouts could both redeem the final use. Money impact was bounded (one extra discount), but it was the same class of race the stock system was already hardened against.
- **Fixed**: `redeemDiscount()` (new, `src/lib/discounts.ts`) atomically claims the redemption via `UPDATE discounts SET usage_count = usage_count + 1 WHERE id = $1 AND (usage_limit IS NULL OR usage_count < usage_limit)` — rowCount 0 means the limit was hit and the order is rejected with a clear message. Moved to run **before stock is touched** (not after order creation as before) so a rejection never needs a stock rollback; a matching `releaseDiscount()` rolls the claim back if a *later* step fails (out-of-stock during the decrement loop, or order-creation error) — same rollback shape as `restoreStock`. Both queries verified against the real dev schema before committing (dry-run against a nonexistent id, rowCount 0, no mutation). The old post-order-creation "record the redemption" block is gone — redemption now happens exactly once, atomically, earlier in the request.
- Files: `src/lib/discounts.ts`, `src/app/api/orders/route.ts`.

---

## P2 — Polish, consistency, a11y — ☑ ALL FIXED (Session 22, part 13; B24 is an accepted-risk register, not actionable)

### B15 ☑ FIXED (Session 22) — Price formatting is inconsistent across the site
`$${product.price}` on the product page ("$45.5"), `.toFixed(0)` in the drawer (B7), `.toFixed(2)` elsewhere, raw interpolation in cart's `t('each')`. One store, four formats.
- **Fix**: `formatPrice(n)` helper (always `$X.XX`, or drop cents when `.00` — pick one rule) used everywhere a price renders. Consider locale-aware formatting via `Intl.NumberFormat` for `/ar`.

### B16 ☑ FIXED (Session 22) — Untranslated strings the i18n pass missed
- ☑ `CartDrawer` aria-label now `t('title')` (Session 22)
- ☑ Order/account/login/register metadata titles localized via `generateMetadata` + message keys (Session 22)
- ☑ Layout default `description` fallback — was a single hardcoded English string; now `common.defaultSiteDescription` in `messages/{en,ar}.json`, read via `getTranslations` in `generateMetadata` (Session 22, part 13)
- ☑ OG locale `ar_AR` → `ar_LB` (Session 22)

### B17 ☑ FIXED (Session 22, part 13) — No focus trap in the cart drawer or mobile menu
The drawer sets initial focus and restores on close ✓, but Tab walks out of the dialog into the page behind the overlay (`aria-modal` alone doesn't trap). Mobile menu has no focus management at all and no Esc-to-close.
- **Fixed**: new shared `src/lib/useFocusTrap.ts` (keydown Tab handler cycling first/last focusable within a container ref) wired into `CartDrawer` — a true modal overlay. The mobile Nav panel got the lighter treatment the bug itself called for (Esc-to-close + focus returns to the hamburger button) rather than a full trap — it's a disclosure dropdown, not a modal, so trapping Tab inside it would be the wrong pattern. No dependency needed.
- Files: `src/lib/useFocusTrap.ts` (new), `CartDrawer.tsx`, `Nav.tsx`.

### B18 ☑ FIXED (Session 22, part 13) — `prefers-reduced-motion` is ignored (slideshow autoplays regardless)
Zero matches for reduced-motion in the codebase; `SlideshowSection` auto-advances for everyone.
- **Fixed**: new `src/lib/useReducedMotion.ts` hook (matchMedia + change listener) disables the slideshow's autoplay timer when the OS preference is set (manual prev/next/dots still work). Also added a global `@media (prefers-reduced-motion: reduce)` rule in `globals.css` that zeroes transition/animation durations and forces `scroll-behavior: auto` site-wide, not just the slideshow.
- Files: `src/lib/useReducedMotion.ts` (new), `src/components/sections/SlideshowSection.tsx`, `globals.css`.

### B19 ☑ FIXED (Session 22, part 13) — Hero/section fill images missing `sizes`
`HeroSection` (and check CTABanner/ImageText/Slideshow) render `<Image fill priority>` with **no `sizes`** — mobile downloads the desktop-size image. CLAUDE.md's performance section claims "explicit `sizes` everywhere"; it's not true for the block sections.
- **Fixed**: `sizes="100vw"` on the three full-bleed backgrounds (Hero, CTABanner, Slideshow); `sizes="(min-width: 768px) 50vw, 100vw"` on ImageText (confirmed its layout is genuinely `md:grid-cols-2` — image is half-width from 768px up, full-width below).
- Files: `src/components/sections/HeroSection.tsx`, `CTABannerSection.tsx`, `SlideshowSection.tsx`, `ImageTextSection.tsx`.

### B20 ☑ FIXED (Session 22, part 13) — All five Google fonts are instantiated on every page (VERIFY payload)
The layout instantiates Inter, Space Grotesk, Playfair, DM Sans, and Manrope unconditionally; `next/font` emits preload tags for instantiated fonts, so all five families may be preloaded when the theme uses at most two. Also: **no Arabic subset in any of them** — `/ar` always falls back to system Arabic, so the "typography identity" feature silently doesn't apply to Arabic.
- **Verified the claim first**: built the app and curled the homepage's `<head>` — 0 preloaded fonts is impossible to verify pre-fix without the built HTML, so this confirmed the bug before touching code. The admin's own default for both `headingFont`/`bodyFont` is `'system'`, so out of the box none of the five deserved eager preloading at all.
- **Fixed**: `preload: false` on all five (plus the new sixth, below) — next/font genuinely can't pick a font conditionally at the module level (it needs a static top-level call), so this is the accepted middle ground the bug itself named, not a workaround. Rebuilt and re-curled: **0 font preload links**, down from up to 5.
- **Arabic font added**: new `IBM_Plex_Sans_Arabic` instantiation (`subsets: ['arabic']`, confirmed available in next/font's Google Fonts metadata before using it) — `resolveFontStack()` in `site-settings.ts` now takes an optional `locale` and automatically substitutes the Arabic stack for both heading and body on `/ar`, regardless of the admin's per-site pick (none of the other five have Arabic glyphs, so overriding rather than exposing it as a separate configurable option was the simpler, correct call). Verified: curled `/` vs `/ar` — English resolves to the system stack (the admin default), Arabic resolves to `var(--font-arabic), 'Segoe UI', Tahoma, sans-serif` on both `--font-heading` and `--font-body`.
- Files: `(frontend)/layout.tsx`, `src/lib/site-settings.ts` (FONT_STACKS, resolveFontStack).

### B21 ☑ FIXED (Session 22, part 13) — Hero `textAlign` uses physical left/right — wrong in RTL
`alignMap` maps to `text-left/items-start` etc.; on `/ar`, "left" should mean "start" (right side). Admin picks "Left" and gets the visually opposite edge in Arabic.
- **Fixed**: `text-left`/`text-right` → `text-start`/`text-end` (the `items-start`/`items-end` flex utilities were already logically correct — CSS flexbox's `align-items: flex-start/end` is direction-aware, only `text-align: left/right` is a genuinely physical property that doesn't flip with `dir`). Admin option **values** stay `'left'`/`'right'` (no data migration for existing content) — only the **labels** changed to Start/Center/End, since "Start" is the accurate name for what the value now means. Confirmed no other block (CTABanner/ImageText/Slideshow) has a `textAlign` field, so this was the only file needing the fix.
- Files: `src/components/sections/HeroSection.tsx`, `src/globals/blocks/hero.ts`.

### B22 ☑ FIXED (Session 22, part 13) — Wishlist toggle with a nonexistent product id → unhandled 500
`POST /api/account/wishlist` writes the id into the relationship without checking the product exists; Payload's validation rejects it and the route 500s (generic). Harmless but sloppy; also no cap on wishlist size.
- **Fixed**: validates the product exists + `status: published` before adding (returns a clean 400, not a 500) — only checked on *add*, since removing an id that's already gone is a harmless no-op, not an error worth validating. Capped at 200 entries (400 once full).
- Files: `src/app/api/account/wishlist/route.ts`.

### B23 ☑ FIXED (Session 22) — Shop "piece count" reports the page size, not the catalog
`pieceCount` uses `products.length` (max 24) with a `+` heuristic. Payload returns `totalDocs` for free — show the real number.
- Files: `shop/page.tsx:97-101`.

### B24 ☐ Accepted-risk register (documented, not currently actionable)
- ~~In-memory rate limiting resets per serverless instance/cold start~~ — **closed, ROADMAP F0 §1.3 (Session 22, part 10)**: all rate limiting is now a durable Postgres-backed fixed-window counter (`src/lib/durable-rate-limit.ts`), survives across instances. The old in-memory map only remains as a same-file fallback for the rare case the DB pool itself is unreachable.
- `/order/[orderNumber]` shows delivery address + phone-less PII to anyone holding the order number — accepted (order number ≈ access token, IMPROVEMENTS 1.8); tightens automatically if/when order pages require login for account-linked orders
- Stock decrement falls back to non-atomic read-modify-write when `payload.db.pool` is unavailable — logged, rare
- `generateStaticParams` limits (200 products / 500 sitemap) — revisit at scale

---

## Verification checklist for the fixing session

1. `npm run build` — route table: confirm B3 (`/order/[orderNumber]` shows `●` vs `ƒ`) and B20 (font preload count in built HTML)
2. `npx tsc --noEmit` after each fix batch
3. Manual: Arabic shop search (B8), drawer totals with a cents-priced product (B7), airplane-mode add-to-cart (B6), slow-3G checkout load (B5)
4. Schema-affecting fixes: none expected — all bugs above are code-only (no new fields)

---

## P0 — Reported from production (Session 30, part 2)

### B25 ☑ FIXED (Session 30, part 2) — Deleting a product 500s whenever anything references it

**Reported**: owner could not delete a product from the live admin; the Products list
showed `DELETE /api/products?...where[and][0][id][in][0]=3 → 500 (Internal Server Error)`
with nothing useful in the UI.

**Root cause** — a Payload schema mismatch, not application code. Four collections hold a
`required` relationship to `products`, so the column is generated `NOT NULL`, while
Payload always generates the foreign key as `ON DELETE SET NULL`:

| child table | `product_id` | FK on delete |
|---|---|---|
| `carts_items` | NOT NULL | SET NULL |
| `reviews` | NOT NULL | SET NULL |
| `bundles_products` | NOT NULL | SET NULL |
| `back_in_stock_requests` | NOT NULL | SET NULL |

Postgres therefore tries to null a NOT NULL column and aborts the DELETE. In practice a
single visitor leaving the product in their cart is enough to make it permanently
undeletable. **Reproduced on dev**: an unreferenced product deletes cleanly; the same
product with one cart line fails with `Failed query: delete from "products" where id = $1`.

**Fix** — a `beforeDelete` hook on Products (`src/collections/Products.ts`) that clears
every reference before Postgres sees the DELETE:
- `reviews` / `back-in-stock-requests` — deleted (meaningless without their product)
- `carts.items` — only the offending line is removed; the rest of the cart survives
- `bundles.products` — special-cased, because that array enforces `minRows: 2`, so
  removing a component from a two-product bundle makes the bundle invalid and Payload's
  own `update()` refuses the save (which is what caused the failure in the first place).
  If ≥2 components remain it goes through Payload normally; otherwise the row is dropped
  and the bundle **unpublished** via direct SQL, with a warning logged — the owner keeps
  the bundle as a draft to fix rather than losing it or leaving a broken one live.

**Order history is deliberately untouched** — `orders.items[].productId` is a plain
snapshot, not a relationship, so past orders keep their title and price. Verified.

**Verified on dev, 6/6**: cart (line removed, cart survives), multi-line cart (other lines
preserved), review, bundle (other component kept, bundle unpublished with a warning),
back-in-stock request, and a past order retaining its snapshot. All test data cleaned up.

⚠️ **Same bug class exists anywhere a `required` relationship points at a deletable
collection** — worth checking before adding one. The identical mismatch was found and
fixed the same session on the new `taxonomy_terms.taxonomy_id`.

### B26 ☑ FIXED (Session 30, part 4) — Product pages were NOT statically rendered in production

**Severity**: performance / cost, not correctness. Pages render correctly; they just render
on every request instead of being served from the edge cache.

**Directly contradicts** CLAUDE.md's "Performance Architecture (Non-Negotiable)" §2 — *"ISR
not SSR for product pages — product data changes infrequently; edge caching > per-request
DB hit"* — and product pages are the highest-traffic route on the site.

**Verified against live production** (which runs pre-Session-30 code, so this is long-standing,
not introduced by the taxonomy or env work):

| Page | Response headers | Verdict |
|---|---|---|
| `/artist/gerar` | `X-Nextjs-Prerender: 1` · `X-Vercel-Cache: PRERENDER` · `Cache-Control: public` | genuinely ISR ✓ |
| `/product/jean` | *(no prerender header)* · `X-Vercel-Cache: MISS` · `Cache-Control: private, no-cache, no-store` | rendered per request ✗ |

Confirmed locally too: a production build emits **6 artist HTML files and 0 product HTML
files**, and `.next/server/app/en/product/` is an empty directory. `/[locale]/product/[slug]`
appears in neither `routes` nor `dynamicRoutes` in `prerender-manifest.json`.

**How it went unnoticed for so long**: the `next build` route table lists it as `●` (SSG),
which several sessions took as proof. That table is unreliable — the same known gotcha
recorded in Session 22 part 2 for `/shop`, `/account`, `/checkout` and `/track`. Note the
product row also lacks the revalidate/expire columns that the genuinely-ISR artist row has,
which is the tell. **Use `prerender-manifest.json`, emitted HTML, or live response headers —
never the route table alone.****Root cause**: `src/lib/auth.ts` imports `headers()` from `next/headers`, and the product
page called `getCustomer()` during render — a dynamic API in a server component opts the
entire route out of static rendering. It was there for one reason: to decide whether to show
`WriteReviewForm`. Introduced with reviews in Session 27 part 4, unnoticed ever since because
the route table kept reporting `●`.

⚠️ **A correction to this entry's own first diagnosis.** It originally recorded "no
`cookies()`, `headers()`… anywhere in the product page or its ten imported components" — that
grep covered the page and its `@/components` imports but **not its `@/lib` imports**, which is
exactly where the culprit sat. The lesson is to trace dynamic APIs through the *whole* import
graph, not just the component layer.

**Fix**: new `GET /api/account/me` returning `{ isLoggedIn }`; `WriteReviewForm` resolves its
own login state on mount and renders either the form or a "Sign in to write a review" link.
The page no longer calls any dynamic API. This mirrors the `fetchState` pattern
`WishlistButton` has used since Session 19 for precisely this reason — and it is a small UX
improvement too, since signed-out visitors previously saw nothing at all where the form
would be.

**Verified three independent ways** after the fix:
- emitted HTML: product pages **0 → 12** (6 products × 2 locales); artist unchanged at 6
- `prerender-manifest.json`: 17 → 29 prerendered routes, with `/[locale]/product/[slug]`
  now also in `dynamicRoutes` for the ISR fallback
- the route table's revalidate columns — the original tell — now read `5m 1y` on the product
  row, matching artist exactly where they were previously blank

`tsc` clean · 71/71 unit tests · Playwright E2E passes (it walks shop → product → cart →
checkout, so it exercises the changed page).
