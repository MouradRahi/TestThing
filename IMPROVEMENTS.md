# trackID.lb — Audit Findings & Improvement Roadmap

> Created 2026-06-11 from a full codebase audit (every route, collection, global, and component reviewed; production build verified).
> Goal: a complete, launch-ready e-commerce platform that is **fully white-label** — any brand identity should be expressible from the admin panel alone, with zero code changes.
>
> Status legend: ☐ todo · ☑ done

---

## 0. Fixed During This Audit (2026-06-11)

- ☑ `next.config.ts` — removed invalid `configPath` option from `withPayload` (TS error; config now resolved via `@payload-config` alias)
- ☑ `product/[slug]/page.tsx` — typed the `tags.map()` parameters (implicit `any`)
- ☑ Removed 3 stale `@ts-expect-error` directives in `(payload)/admin` pages
- ☑ **Production build verified passing** — 16 pages generated, zero TypeScript errors

---

## 1. P0 — Critical: Correctness & Security (launch blockers)

These are bugs or holes that cause wrong orders, lost money, or abuse. Nothing ships before these.

### 1.1 Orders API trusts client-supplied prices ⚠️ most severe — ☑ FIXED (Session 9)
`POST /api/orders` takes `priceAtPurchase` straight from the request body and computes the total from it. Anyone with curl can place a $0 order for any product.
- ☑ Server must look up each `productId` in Payload, verify `status: published`, and use the **DB price** — client prices are display-only
- ☑ Reject unknown product IDs
- ☑ Validate quantity: integer, ≥ 1, ≤ available stock (client now sends only `{ productId, quantity }`)

### 1.2 No stock validation or decrement — ☑ FIXED (Session 9)
A one-of-a-kind hand-painted piece — the core of this brand — can be sold twice. `stockQuantity` is never checked at order time and never decremented.
- ☑ In the orders route: check `stockQuantity >= quantity` for every item; return a clear "no longer available" error naming the item (409)
- ☑ Decrement stock on order creation — atomic conditional SQL (`UPDATE … WHERE stock_quantity >= qty`) via `payload.db.pool`, with a payload.update fallback; decrements are rolled back if order creation fails
- ☑ Restore stock when an order is set to `cancelled` (Orders `afterChange` hook; un-cancelling re-decrements, floored at 0)
- ☐ Auto-set product to sold-out / unpublish when `isOneOfAKind` and stock hits 0 — deliberately skipped: keeping the page live with a "Sold Out" button preserves shared links; revisit with sold-out badges (1.3)
- ☑ Cart UI: clamp quantity to available stock (`maxQuantity` carried on cart items; server re-validates regardless)

### 1.3 Stale stock display (ISR window) — ☑ FIXED (Session 9)
Product pages revalidate every **3600s** — a sold piece can show "Add to Cart" for up to an hour; shop grid has no sold-out state at all.
- ☑ Payload `afterChange`/`afterDelete` hooks on Products/Artists/Categories/Pages + all three globals → `revalidatePath`/`revalidateTag` (`src/lib/revalidate.ts`); the orders route also revalidates affected product pages directly since its raw-SQL stock decrement bypasses hooks
- ☑ Sold-out badge + dimmed image on `ProductCard` (shop grid, featured sections, related products)
- ☑ Server re-validates stock at order time regardless (1.2), so the worst case is a friendly error at checkout

### 1.4 No spam / abuse protection on public POST routes
COD stores live and die by fake-order volume. `/api/orders` and `/api/custom-requests` accept unlimited anonymous posts. — ☑ FIXED (Session 9)
- ☑ Honeypot field (`website`) on checkout + custom request forms — bots get a fake success response
- ☑ Per-IP rate limit (`src/lib/api-guards.ts` — 5 orders / 3 custom requests per 10 min, in-memory per instance)
- ☑ Max length caps on all text fields (name 120, phone 40, address 500, notes 1000, description 2000…)
- ☐ Optional later: Cloudflare Turnstile if spam appears in practice

### 1.5 Notifications can be silently killed on Vercel
`void sendOrderConfirmationEmail(...)` returns the response immediately; the serverless function may freeze before the email/WhatsApp call completes. "Fire-and-forget" needs the platform primitive: — ☑ FIXED (Session 9)
- ☑ Wrap notification calls in `after()` from `next/server` (Next 15) — keeps the function alive past the response without blocking it

### 1.6 HTML injection in the confirmation email
`customerName`, `deliveryAddress`, and item titles are interpolated into email HTML unescaped. A crafted name injects markup into an email sent from the store's domain (phishing vector). — ☑ FIXED (Session 9)
- ☑ Escape all user-supplied values in `buildOrderEmailHtml` (simple `escapeHtml` helper)

### 1.7 Announcement bar is hidden behind the fixed nav 🐛 layout bug — ☑ FIXED (Session 9)
`AnnouncementBar` renders in normal flow at the top of `<body>`, but the nav is `fixed top-0 z-50` and `<main>` has a fixed `pt-14`. Enabling the announcement just adds invisible space underneath the nav.
- ☑ Announcement + nav now share one `sticky top-0` header stack; nav is in normal flow, `pt-14` hack removed

### 1.8 Order confirmation page is a façade — ☑ FIXED (Session 9)
`/order/[orderNumber]` fetches nothing — it echoes whatever string is in the URL and says "Order received". Typos look confirmed; customers see no items, totals, or payment info.
- ☑ Fetch the order by `orderNumber` (return 404 if absent) and render items, totals, delivery info, payment method, order status
- ☑ Show bank-transfer instructions here when `paymentMethod === 'bank_transfer'` (see 2.2)
- ☑ Rename folder param `[id]` → `[orderNumber]` for honesty
- Note: order numbers (`TRK-{ts6}-{rand4}`) are unguessable enough to act as access tokens for a COD store — acceptable

### 1.9 Hardcoded production secret fallback
`payload.config.ts`: `secret: process.env.PAYLOAD_SECRET || 'trackid-lb-dev-secret-change-in-production'`. If the env var is ever missing in prod, sessions are signed with a public string. — ☑ FIXED (Session 9)
- ☑ Throw at startup when `NODE_ENV === 'production'` and `PAYLOAD_SECRET` is unset (dev keeps a local-only fallback)

### 1.10 No slug normalization (live bug: `/product/Jeans`) — ☑ FIXED (Session 9)
Slugs are free-typed text — the build output already shows a capitalized slug in production data. Case-sensitive routes + SEO duplicates follow.
- ☑ `beforeValidate` hook (`src/lib/slug.ts` → `formatSlug`) on Products, Artists, Categories, Pages: auto-generates kebab-case slug from title/name when empty; always normalizes what's entered
- ☑ One-off data fix ran against the DB (`Jeans` → `jeans`, plus one category slug)

### 1.11 Role field is decorative
`users.role` (admin/editor) exists but no access rule reads it. Any editor can manage users (and promote themselves), delete orders, etc. — ☑ FIXED (Session 9)
- ☑ Users collection: only admins create/delete users; users can update self but the `role` field itself is admin-only (no self-promotion)
- ☑ Orders: editors read/update, only admin deletes
- ☐ Sensible role gates on the rest (Products/Pages/etc. still rely on Payload defaults — fine for now, revisit with 4.x admin work)

---

## 2. P1 — E-commerce Essentials (missing table stakes)

### 2.1 Delivery fee system — ☑ FIXED (Session 9)
Fee is hardcoded `0`; cart says "Calculated at checkout", checkout says "TBD" — the customer never learns the fee and the order total is wrong.
- ☑ SiteSettings → new **Commerce** tab: `deliveryZones[] { label, fee }` + `freeDeliveryThreshold` (optional)
- ☑ Checkout: area becomes a zone **select** (driven by CMS) → fee shown live in the summary, included in total; falls back to free-text area when no zones are configured
- ☑ Orders API computes the fee server-side from the selected zone (same trust rule as prices); rejects unknown areas when zones exist

### 2.2 Bank transfer instructions — ☑ FIXED (Session 9)
The option exists but selecting it changes nothing — customer has no account details. Email says "details will be sent separately via WhatsApp" (manual work every order).
- ☑ SiteSettings Commerce tab: `bankTransferInstructions` (textarea — bank name, IBAN/account, reference note)
- ☑ Shown on checkout when bank transfer is selected, on the confirmation page ("How to pay"), and in the email (falls back to the WhatsApp line if unset)

### 2.3 Product variants / sizes ⚠️ data-model gap — ☑ FIXED (Session 9)
This is a **clothing** store with no size concept. One-of-a-kind pieces are single-size, but hoodies/tees in production runs need S/M/L/XL with per-size stock.
- ☑ Products: `sizes[] { label, stockQuantity }` array (hidden for one-of-a-kind; flat `stockQuantity` used when empty) — `src/lib/stock.ts` centralizes the semantics
- ☑ Size picker on product page (per-size sold-out states); size flows through cart line → order item → confirmation page → email/WhatsApp
- ☑ Stock checks/decrements are per-size (atomic SQL against `products_sizes`, with read-modify-write fallback); cancel/restock hook is size-aware; cart lines are keyed `product|size` so two sizes of the same piece are separate lines

### 2.4 Fix "Load More" pagination — ☑ FIXED (Session 9)
The button is a full navigation to `?cursor=…` — the next page **replaces** the grid instead of appending. Looks broken, and users lose their place.
- ☑ Honest "Next Page →" / "← First Page" cursor pagination (filters preserved)
- ☐ Client "load more" that appends — nice-to-have upgrade later

### 2.5 Checkout & cart hardening — mostly done (Session 9)
- ☑ Phone validation on checkout — generic international format (7–15 digits, optional +), client + server; kept brand-agnostic for white-label
- ☑ Quantity selector on product page (− n +, clamped to stock; hidden for single-stock pieces)
- ☑ Add-to-cart feedback: button shows "Added ✓" for ~1.6s
- ☐ Cart re-validates prices/stock against the server when rendered (prices in localStorage go stale)
- ☐ Per-field server-side validation errors surfaced on the form (currently one generic message)
- ☐ Mini-cart drawer (see P4)

### 2.6 Customer-notified status updates — ☑ FIXED (Session 9)
Status changes (confirmed → shipped) happen in admin but the customer never hears about them.
- ☑ Orders `afterChange` hook: on `orderStatus` transition, sends a templated email per status (confirmed / in production / shipped / delivered / cancelled) — skipped on creation
- ☑ Order lookup page (`/track`): enter order number → redirects to the order page showing live status; linked from footer fallback
- ☐ WhatsApp status messages — later, with WhatsApp activation

### 2.7 Search & discovery — mostly done (Session 9)
- ☑ Shop text search (`?q=` against title/tags via Payload `like`) — plain GET form, RSC, zero client JS
- ☑ Sort options: newest (default, cursor-paginated), price ↑, price ↓ (price sorts show one 60-item page — fine until the catalog is large)
- ☐ Filter bar will not scale past ~15 artists (limit 50 fetched, rendered as a wall of chips) → collapse to dropdowns/combobox when counts grow
- ☑ "More from this artist" (falls back to same-category "You may also like") strip on product detail
- ☑ "Only X left" low-stock hint on product page (≤2 in stock, non-one-of-a-kind)

---

## 3. P2 — White-Label & Brand Identity

The stated goal: a business owner expresses their **entire** brand from the admin. Today, the theme/nav/footer are CMS-driven, but brand-specific copy is baked into code in ~10 places, and several SiteSettings fields are dead.

### 3.1 Dead SiteSettings fields (defined, never rendered) 🐛
- ☐ `logoUrl` — Nav and Footer only ever render the text logo. Render `next/image` logo when set (nav, footer, email header)
- ☐ `ogImage` (SEO tab) — never added to metadata. Wire into layout `generateMetadata` as the default OG/Twitter image
- ☐ `contactEmail` — described as "reply-to for order emails", never used. Set `replyTo` in Resend call; show in footer
- ☐ `tagline` (Brand tab) — unused anywhere (only `footerTagline` is). Use on homepage empty state / metadata, or remove the field
- ☐ `whatsappNumber` — unused on the frontend. Add floating WhatsApp chat button (huge for the Lebanese market) + "WhatsApp us" links

### 3.2 Hardcoded brand strings that must move to CMS
A second brand deploying this code would still say "trackID.lb" and "Beirut" in all of these:
- `product/[slug]/page.tsx` — meta description ("Hand-painted by trackID.lb… made in Lebanon"), JSON-LD `brand`/`seller`, the "Hand-painted in Beirut…" paragraph
- `order/[orderNumber]` page — "Thank you for supporting the music."
- `cart` empty state — "Find a piece that speaks to you."
- `notifications.ts` — entire email template: "TRACKID.LB" header, greeting copy, "Lebanon's music fashion brand" footer, hardcoded dark-theme colors
- `site-settings.ts` — `resolveCopyright` fallback "© {year} trackID.lb"
- `layout.tsx` / `sitemap.ts` — `https://trackid.lb` fallback URL
- `payload.config.ts` — admin `titleSuffix: '— trackID.lb Admin'`
- `checkout` — "+961 XX XXX XXX" placeholder, "Beirut, Tripoli, Saida" examples
- `cart.ts` — localStorage key `trackid-cart`

Plan:
- ☐ SiteSettings → new **Copy** tab (or `UIStrings` group): productPageBlurb, orderThankYouMessage, emptyCartMessage, emailGreeting, emailFooter, brandNameForSchema — each with the current text as `defaultValue`
- ☐ Email template: derive brand name, colors (from theme tokens), logo, and copy from SiteSettings
- ☐ JSON-LD + meta descriptions built from `storeName` + CMS copy
- ☐ Derive cart key / order-number prefix (`TRK`) from a configurable `brandSlug` / `orderPrefix` field

### 3.3 Typography — the missing half of brand identity
Colors are fully theme-able; type is locked to `system-ui`. Editorial identity needs fonts.
- ☐ SiteSettings Theme tab: `headingFont` + `bodyFont` selects from a curated set (e.g. Inter, Space Grotesk, Playfair Display, DM Sans, IBM Plex — loaded via `next/font`, subset, swap)
- ☐ Expose as `--font-heading` / `--font-body` CSS vars alongside the color vars
- ☐ Optional: `baseFontSize` / letter-spacing personality toggle (tight editorial vs airy minimal)

### 3.4 Shape & feel tokens
- ☐ `borderRadius` setting (sharp 0 / soft 6px / round 12px) as `--radius` var — single cheapest lever to make the same site read as a different brand
- ☐ Button style variant setting (filled / outline / underline-link) if we want to go further

### 3.5 Favicon & head branding
- ☐ `faviconUrl` in SiteSettings → `icons` in metadata
- ☐ OG image fallback chain: page-specific → SiteSettings `ogImage` → none

### 3.6 Phase 9 (already planned) — blocks on Pages
- ☐ Reuse the homepage `sections` blocks field in the Pages collection so any CMS page can be a full landing page, not just rich text — this completes "build any page from admin"

---

## 4. P3 — Admin & Developer QoL

### 4.1 Media upload collection ⚠️ biggest admin pain point
Every image today is "upload to Supabase dashboard by hand, copy the public URL, paste into a text field". That's not workable for a non-technical owner.
- ☐ Add a `Media` upload collection using `@payloadcms/storage-s3` pointed at Supabase Storage's S3-compatible endpoint (same project, same bucket)
- ☐ Payload generates sizes/thumbnails (sharp is already installed); alt text lives with the file
- ☐ Migrate image fields (`products.images`, `artists.photo`, hero/slideshow `bgImage`, `logoUrl`, `ogImage`) to `upload` relations — keep the URL text fields working during transition, then deprecate

### 4.2 Generate Payload types (config exists, file doesn't)
`payload-types.ts` was never generated — every global/product is typed `Record<string, any>`, which is how dead fields (3.1) went unnoticed.
- ☐ Add `"generate:types": "payload generate:types"` script, run it, commit the file
- ☐ Replace `AnyRecord` casts in `site-settings.ts`, page components, and BlockRenderer with generated types

### 4.3 Drafts, versions & preview
Pages and Homepage edits go live instantly (within cache TTL) with no undo.
- ☐ `versions: { drafts: true }` on Pages + Products (and Homepage global) — gives draft/publish workflow and version history for free
- ☐ Payload Live Preview for Homepage/Pages so the owner sees blocks while editing
- ☐ Pages need a `status` field regardless — today every page is public the moment it's created (and enters the sitemap)

### 4.4 Instant cache invalidation (same hooks as 1.3)
- ☐ `afterChange`/`afterDelete` hooks on all collections + globals → `revalidatePath`/`revalidateTag`; drop the "wait up to 5 minutes" caveat entirely

### 4.5 Admin ergonomics
- ☐ Order admin: virtual title like `TRK-xxxx — Name — $total`, filter presets by status, items table readable at a glance
- ☐ New-order admin notification badge is covered by WhatsApp alert (Phase 3) — activate keys at launch
- ☐ Seed script (`npm run seed`) creating demo artist/category/products/settings — makes fresh white-label installs demo-able in minutes

---

## 5. P4 — Storefront QoL & Polish

- ☑ **Mobile nav** — hamburger menu added (Session 9); cart link + badge stay visible, CMS links collapse into a panel below the header
- ☐ `loading.tsx` for shop/product/artist routes (skeleton grids), `error.tsx` boundary, branded `not-found.tsx`
- ☐ Product gallery: thumbnails are static `<div>`s — make them switch the main image (small client component); shows max 5 images with no indicator
- ☐ Cart drawer (slide-over mini-cart) instead of full-page navigation on add
- ☐ Wishlist / save-for-later (localStorage, same pattern as cart) — one-of-a-kind pieces create "thinking about it" behavior
- ☐ Recently-viewed strip (localStorage) on product pages
- ☐ Accessibility pass: real social icons with `aria-label` (currently the text "IG"/"TK"), contrast check on announcement-bar custom colors, `aria-live` on cart badge, skip-to-content link
- ☐ Canonical URLs in metadata
- ☐ Remove `experimental.reactCompiler: false` from next.config (emits a build warning, does nothing)
- ☐ Honest rendering strategy for `/shop`: it's dynamic (searchParams), not ISR — either accept that (it's fine) and remove the misleading `revalidate = 30`, or split the no-filter view into a cached segment. Update CLAUDE.md's ISR claim either way

---

## 6. P5 — Post-Launch / Growth

- ☐ Analytics: Vercel Analytics + optional GA4/Meta Pixel ID fields in SiteSettings (owner pastes ID, script renders conditionally)
- ☐ Discount codes: `Discounts` collection (code, % or fixed, expiry, usage limit) → code field at checkout, validated server-side
- ☐ Instagram feed embed (deferred — waiting on handle)
- ☐ WhatsApp Cloud API activation (code ready; needs Meta keys)
- ☐ Phase 10 i18n: Payload `locales: ['en','ar']` + `localized: true` on text fields, `next-intl` for UI strings, RTL via `dir="rtl"` — the Copy tab from 3.2 makes this dramatically easier, do 3.2 first
- ☐ Customer accounts + order history (only if repeat-purchase behavior justifies it — COD stores often never need this)
- ☐ Email capture / drop-announcement newsletter block (Resend Audiences)
- ☐ Sitemap/staticParams limits (500/200) — fine for years; revisit if catalog explodes

---

## 7. Documentation Cleanup

- ☐ CLAUDE.md still says images go through **Cloudinary** in the Performance Architecture and Data Models sections (decision was Supabase) — fix both
- ☐ CLAUDE.md claims the catalog is ISR — `/shop` is dynamic; correct after 5.x lands
- ☐ Session 3 claims the hardcoded `PAYLOAD_SECRET` was fixed — the fallback string is still in `payload.config.ts` (see 1.9)
- ☐ `.env.local.example` referenced in Session 3 doesn't exist in the repo — create it (it's listed in env section of CLAUDE.md)

---

## Suggested Execution Order

| Phase | Scope | Items |
|---|---|---|
| **9a — Trust the server** ☑ DONE (Session 9) | Order integrity & security | 1.1, 1.2, 1.4, 1.5, 1.6, 1.9, 1.11 |
| **9b — Launch UX** ☑ DONE (Session 9; 2.5 partial — cart revalidation + per-field errors remain) | Customer-facing launch blockers | 1.7, 1.8, 1.10, 2.1, 2.2, 2.4, 2.5, mobile nav |
| **10 — Commerce depth** ☑ DONE (Session 9; artist-filter dropdown scaling deferred) | 2.3 variants, 2.6 status updates, 2.7 search/sort, 1.3 revalidation hooks |
| **11 — True white-label** | 3.1–3.5 (dead fields, Copy tab, fonts, radius, favicon) + 4.2 types |
| **12 — Admin experience** | 4.1 media uploads, 4.3 drafts/preview, 4.5 seed script, Phase 9 blocks-on-pages (3.6) |
| **13 — Growth** | Section 6 as the business demands |

---

*Keep this file updated as items complete — move finished items to ☑ and note the session in CLAUDE.md's session log.*
