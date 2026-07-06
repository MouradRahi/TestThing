# trackID.lb — Project Handoff Document

> This file is the single source of truth for any Claude session picking up this project.
> Update it at the end of every session. Never let it go stale.

---

## What This Project Is

**trackID.lb** is a Lebanese e-commerce brand selling hand-painted, custom-designed clothing themed around music and artists. Customers buy pieces to express their love for a specific artist, song, or genre. Each piece is unique/hand-painted.

- Lebanon-only market (no international shipping, no international payment gateways)
- Payment method: Cash on Delivery (COD) + local bank transfer — NO Stripe/PayPal
- WhatsApp notification to team on new orders
- Strong visual/editorial identity — the storefront design IS the brand

---

## Tech Stack & Why

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | RSC for zero-JS catalog pages, ISR for edge caching, great image optimization |
| CMS + Admin | Payload CMS 3 | TypeScript-native, embeds into Next.js (local API = no HTTP overhead), free admin UI |
| Database | PostgreSQL via Supabase | Relational (orders/products/users need joins), free tier, built-in connection pooler |
| ORM | Payload's built-in (Drizzle under the hood) | Payload manages its own schema |
| Images | Supabase Storage | Same project as DB, public CDN bucket — Cloudinary unavailable in Lebanon |
| Email | Resend | Order confirmation + status emails, simple API |
| WhatsApp | WhatsApp Cloud API (Meta) | Notify team on new order — free tier |
| i18n | next-intl (UI) + Payload localization (content) | English/Arabic + RTL; English unprefixed, `/ar` prefixed |
| Analytics | Vercel Analytics + optional GA4 / Meta Pixel | Pixel/GA IDs pasted in admin, scripts render conditionally |
| Hosting | Vercel | Zero-config Next.js deployment, edge CDN; migrations run via `scripts/migrate.mjs` (any Node) |

**Estimated monthly cost at launch: $0–$20**

---

## Performance Architecture (Non-Negotiable)

These decisions were made upfront to ensure the app scales without deterioration:

### 1. React Server Components for Catalog
All product listing pages are RSC — zero client JavaScript sent for browsing. Data is fetched server-side using Payload's **Local API** (direct DB call, no HTTP round trip).

### 2. Incremental Static Regeneration (ISR)
Individual product pages use `revalidate` so they're pre-rendered and served from Vercel's edge CDN. On update in CMS, page regenerates automatically.

### 3. Cursor-Based Pagination
Product catalog uses cursor-based pagination (not offset) so query time stays constant regardless of catalog size. `?cursor=<id>&limit=24`

### 4. Database Indexes
Critical indexes defined on:
- `products.status` (published/draft filter)
- `products.artist_id` (filter by artist)
- `products.category` (filter by category)
- `products.created_at` (sort by newest)
- `orders.status` (admin order management)
- `orders.created_at` (sort for admin)

### 5. Image Pipeline
All images are stored in **Supabase Storage** (public CDN bucket; Cloudinary is unavailable in Lebanon). Managed via a Payload `Media` upload collection (S3 plugin → Supabase, browser-direct `clientUploads`), with a picker that fills the URL text fields the storefront reads. `next/image` is used everywhere with explicit `sizes` to prevent layout shift and over-fetching.

### 6. No Client-Side Data Fetching on Load
Initial page renders are fully server-rendered. Client-side fetching only for interactive actions (add to cart, filter changes).

---

## Data Models

### Product
```
id, title (localized), slug, description (rich text, localized), price (USD), status (draft|published)
images[] → { image (Media upload), url (Supabase Storage URL), alt }
sizes[] → { label, stockQuantity }   # per-size stock; flat stock_quantity used when empty
artist → relation to Artist
category → relation to Category
garmentType → relation to GarmentType ("more like this")
tags[] (e.g., "hand-painted", "hoodie", "limited")
stock_quantity
is_one_of_a_kind (boolean — for single unique pieces)
created_at, updated_at
```

### Artist
```
id, name, slug, bio (localized), genre (localized), photoMedia (Media upload), photo → Supabase Storage URL
```

### Category
```
id, name, slug (e.g., hoodies, tees, accessories)
```

### Order
```
id, order_number (human-readable, e.g., TRK-123456-AB12)
customer_name, customer_phone, customer_email
delivery_address (text), area (Lebanon area/city)
items[] → { product_id, quantity, size, price_at_purchase, title_at_purchase, image_url }
subtotal, delivery_fee, discount_code, discount_amount, total
payment_method (cod | bank_transfer)
payment_status (pending | paid)
order_status (pending | confirmed | in_production | shipped | delivered | cancelled)
notes (customer notes)
created_at, updated_at
```

### Discount
```
id, code (unique, uppercased), type (percentage | fixed), value
enabled, min_subtotal, expires_at, usage_limit, usage_count (auto)
— validated + recomputed server-side in the orders API; usage_count bumped on redemption
```

### GarmentType
```
id, name (localized), slug   # admin-managed list for CustomRequest + product "more like this"
```

### CustomRequest
```
id, name, phone, email
description (what they want)
reference_artist, reference_song
garment_type → relation to GarmentType
status (new | reviewing | quoted | accepted | rejected)
created_at
```

### Media (Payload upload collection)
```
id, alt, url (Supabase Storage public CDN), sizes (thumbnail/card/feature)
```

### Page (CMS content)
```
id, title (localized), slug, status (draft | published)
content (rich text, localized), sections[] (block builder — same blocks as Homepage)
seo { metaTitle, metaDescription, ogImage }
— serves at /<slug> and /p/<slug>; used for About, FAQ, landing pages, etc.
```

### SiteSettings (Payload Global) — tabbed: Brand / Commerce / Announcement / Footer / Theme / SEO / Copy
```
Brand:        storeName, logo/logoUrl, tagline*, contactEmail, whatsappNumber
Commerce:     deliveryZones[]{label,fee}, freeDeliveryThreshold, bankTransferInstructions
Announcement: announcementEnabled, announcementText*, bg/text colors, href
Footer:       footerTagline*, footerNote*, copyrightText ({year}), socialLinks[]
Theme:        headingFont, bodyFont, borderRadius, colorScheme (dark|light|warm|custom), customColors{8 tokens}
SEO:          metaDescription*, ogImage/ogImageMedia, faviconUrl/faviconMedia, gaMeasurementId, metaPixelId
Copy:         productBlurb*, productMetaTagline, emptyCartMessage*, orderThankYouNote*, emailGreeting, emailFooterNote, orderNumberPrefix
   (* = localized)
```

### Navigation (Payload Global)
```
headerLinks[] → { label, href, openInNewTab }
footerColumns[] → { columnTitle, links[{ label, href, openInNewTab }] }
```

---

## Build Progress

### Phase 1 — Foundation (COMPLETE)
- [x] Next.js 15.4.11 + Payload CMS 3.84.1 scaffolded and wired together
- [x] Payload collections defined: Products, Artists, Categories, Orders, CustomRequests, Pages, Users
- [x] Database indexes applied via `index: true` on all hot query fields
- [x] Project folder structure established (route groups: `(frontend)` + `(payload)`)
- [x] ISR configured: homepage `revalidate=60`, product pages `revalidate=3600` (⚠️ `/shop` is now `force-dynamic` — it reads searchParams — not ISR; instant revalidation hooks keep stock/price fresh)
- [x] Cursor-based pagination in shop catalog (avoids offset slowdown at scale)
- [x] `next/image` with Supabase Storage (`*.supabase.co`) + `placehold.co` (demo seed) remote patterns + AVIF/WebP formats enabled
- [x] Payload Local API singleton (`src/lib/payload.ts`) — zero HTTP overhead in RSC
- [x] Order creation API route (`POST /api/orders`) — COD only, generates TRK-XXXX order numbers
- [x] Zero TypeScript errors
- [x] PostgreSQL connected (Supabase) — needs `.env.local` setup by developer

### Phase 2 — Storefront (COMPLETE)
- [x] Product catalog page (RSC, cursor pagination, filter by artist/category)
- [x] Product detail page (ISR, full editorial layout with image gallery)
- [x] Cart (client-side, localStorage via React Context — `src/components/cart/CartContext.tsx`)
- [x] COD Checkout form (client component, calls `POST /api/orders`)
- [x] Order confirmation page (`/order/[orderNumber]`)
- [x] Reusable `ProductCard` + `AddToCart` components
- [x] Site nav with live cart count badge
- [x] Tailwind v4 PostCSS config (`postcss.config.mjs`)
- [x] `src/lib/cart.ts` — localStorage read/write utilities

### Phase 3 — Notifications (COMPLETE)
- [x] Resend email on order placed (customer confirmation) — `src/lib/notifications.ts`
- [ ] WhatsApp Cloud API message to team — **deferred to post-launch** (code exists in `notifications.ts`, skips gracefully when env vars are absent)
- Notifications are fire-and-forget (never block order creation)
- Keys needed in `.env.local` to activate email: `RESEND_API_KEY`, `RESEND_FROM`

### Phase 4 — Content (COMPLETE)
- [x] Custom Request form page (`/custom-request`) + `POST /api/custom-requests` route
- [x] Artist profile pages (`/artist/[slug]`) — ISR, bio + genre + photo + product grid
- [x] Generic Payload Pages renderer (`/p/[slug]`) — powers About, FAQ, Drops, any CMS page
- [x] `RichTextRenderer` component for Lexical rich text serialization
- [x] Nav updated — "Custom" link added
- [x] Product detail page artist link now goes to `/artist/[slug]` (was shop filter)
- Create content in Payload admin: Pages with slug "about", "faq", etc. auto-render at `/p/about`, `/p/faq`

### Phase 5 — Polish (COMPLETE)
- [x] globals.css polish: smooth scroll, `:focus-visible` ring, `::selection`, `scrollbar-gutter: stable`
- [x] Mobile checkout: order summary appears above form on mobile (better UX)
- [x] Site-level `openGraph` + `twitter` card metadata in frontend layout (`metadataBase` set)
- [x] Product pages: `openGraph` image from first product image + JSON-LD `Product` schema
- [x] Artist pages: `openGraph` image from artist photo
- [x] Custom request page: metadata via `layout.tsx` wrapper (client component pattern)
- [x] `src/app/sitemap.ts` — dynamic sitemap covering /, /shop, /custom-request, all products, artists, pages
- [x] `src/app/robots.ts` — allows all, disallows /admin/ and /api/, points to sitemap
- [x] Footer added with dynamic CMS pages links
- [ ] Instagram feed embed — deferred (handle not yet available)

### Phase 6 — Site Settings + Navigation Globals (COMPLETE)
Eliminates all hardcoded text, links, and colors. Every visible string and nav link is now managed from the Payload admin.

- [x] `src/globals/SiteSettings.ts` — Payload Global with tabs: Brand, Announcement Bar, Footer, Theme, SEO
  - Brand: storeName, logoUrl, tagline, contactEmail, whatsappNumber
  - Announcement bar: enabled toggle, text, bgColor, textColor, optional href (clickable bar)
  - Footer: tagline, footerNote, copyrightText (`{year}` placeholder), socialLinks[]
  - SEO: metaDescription, ogImage
- [x] `src/globals/Navigation.ts` — Payload Global
  - headerLinks[] (label, href, openInNewTab)
  - footerColumns[] (columnTitle, links[]) — each column independently managed
- [x] Both globals registered in `payload.config.ts` under "Site Configuration" group
- [x] `src/lib/site-settings.ts` — cached helpers (5-min TTL via `unstable_cache`)
  - `getSiteSettings()`, `getNavigation()` — safe, never throw
  - `COLOR_SCHEMES` — dark/light/warm presets with 8 color tokens each
  - `resolveColorTokens()` — picks preset or merges custom fields
  - `buildThemeCssVars()` — returns CSS custom property string for inline `<style>`
  - `resolveCopyright()` — replaces `{year}` placeholder
- [x] `src/components/nav/NavWrapper.tsx` — server component; fetches nav + settings, passes to Nav
- [x] `src/components/nav/Nav.tsx` — updated to accept `storeName` + `links[]` as props; falls back to hardcoded defaults if Navigation global is empty
- [x] `src/components/nav/Footer.tsx` — fully driven by globals; fallback hardcoded links if no footerColumns configured; social links row
- [x] `src/components/AnnouncementBar.tsx` — server component; renders above nav if `announcementEnabled=true`
- [x] `(frontend)/layout.tsx` — async, injects `<style>` tag with CSS vars from SiteSettings; `generateMetadata` reads storeName + metaDescription from DB

### Phase 7 — Color Scheme System (COMPLETE)
- [x] Three built-in presets: **Dark Editorial** (default), **Light Minimal**, **Warm Cream**
- [x] **Custom** preset: 8 individual color fields shown only when "Custom" is selected (conditional via Payload `condition`)
- [x] Color tokens: bg, surface, border, foreground, muted, accent, accentHover, onAccent
- [x] `--color-on-accent` CSS var added to `@theme` in globals.css; `.text-on-accent` now uses `var(--color-on-accent)` — adapts to any scheme automatically
- [x] CSS vars injected at layout level via `<style>` tag — overrides `@theme` defaults at runtime, zero client JS

### Phase 8 — Homepage Block Builder (COMPLETE)
Homepage is now fully CMS-driven. Go to Admin → Site Configuration → Homepage to build the page.

- [x] `src/globals/blocks/hero.ts` — eyebrow, headline, subline, primary + secondary CTA, bgImage, bgColor, overlay opacity, text align, min height
- [x] `src/globals/blocks/slideshow.ts` — slides[] (bgImage, bgColor, overlay, eyebrow, headline, subline, CTA), height, autoplay interval
- [x] `src/globals/blocks/featured-products.ts` — sectionTitle, viewAllLabel/Href, source (latest | manual), limit, products relation
- [x] `src/globals/blocks/image-text.ts` — image, eyebrow, heading, body, CTA, imagePosition (left | right)
- [x] `src/globals/blocks/statement.ts` — single centered text line
- [x] `src/globals/blocks/rich-text-block.ts` — Lexical rich text
- [x] `src/globals/blocks/cta-banner.ts` — headline, subline, CTA, bgImage, bgColor, textColor, overlay
- [x] `src/globals/Homepage.ts` — Payload Global with blocks field; registered in payload.config.ts
- [x] `src/components/sections/HeroSection.tsx` — server component
- [x] `src/components/sections/SlideshowSection.tsx` — client component; auto-advance, pause on hover, dot + arrow navigation
- [x] `src/components/sections/FeaturedSection.tsx` — async server component; handles both latest and manual sources
- [x] `src/components/sections/ImageTextSection.tsx` — server component
- [x] `src/components/sections/StatementSection.tsx` — server component
- [x] `src/components/sections/RichTextSection.tsx` — server component
- [x] `src/components/sections/CTABannerSection.tsx` — server component
- [x] `src/components/sections/BlockRenderer.tsx` — switches on `blockType`; filters hidden blocks; empty state message
- [x] `src/app/(frontend)/page.tsx` — now fetches Homepage global (depth: 2) and delegates to BlockRenderer
- Every block has a `hidden` checkbox — toggle off without deleting
- Empty state shown when no sections configured, pointing to admin URL

### Phase 9 — Extended Page Builder (COMPLETE — Session 12)
- [x] Same `sections` blocks field added to the Pages collection — CMS pages (`/[slug]` and `/p/[slug]`) now support full layout sections, not just richText
- [x] Block-media hook shared via `src/lib/media-fill.ts → fillBlocksMedia()` (Homepage + Pages use it identically)
- [x] Renderers show full-width `BlockRenderer` when a page has visible sections; fall back to title + richText otherwise (backward compatible)
- [x] Fixed latent revalidation bug — Pages now revalidate both `/p/<slug>` and the clean `/<slug>`

### Phase 10 — Translation / i18n (IN PROGRESS — Session 18)
- [x] `next-intl` v4 for UI strings + routing; `localePrefix: 'as-needed'` → English unprefixed (`/shop`), Arabic prefixed (`/ar/shop`)
- [x] All `(frontend)` routes moved under `app/[locale]/`; `dir="rtl"` on `<html>` for Arabic (locale-set driven, so adding an LTR locale later needs no RTL change)
- [x] Payload localization enabled (`locales: ['en','ar']`, defaultLocale `en`, `fallback: true`); content fields marked `localized` (products, artists, categories, garment types, pages, plus SiteSettings copy + Navigation labels); `locale` threaded through every storefront query + the cached settings helpers
- [x] UI chrome translated (nav, cart, checkout, order confirmation, footer, product, product cards); locale switcher in the nav
- **To add a 3rd locale (e.g. Japanese `ja`)**: add it to `src/i18n/routing.ts` locales, create `messages/ja.json`, add to `localization.locales` in `payload.config.ts` — RTL set + everything else adapts automatically
- Deferred: homepage-block text + product-image alt localization; a few decorative shop/home strings; localized order emails

---

## Environment Variables Needed

```env
# Payload
PAYLOAD_SECRET=
DATABASE_URI=postgresql://...   # Supabase connection string (pooler URL)

# Supabase Storage (same project as DB)
NEXT_PUBLIC_SUPABASE_URL=https://bdbhygelwizizepxewxv.supabase.co
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=products

# Resend
RESEND_API_KEY=

# WhatsApp Cloud API
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_RECIPIENT_NUMBER=   # team's WhatsApp number

# App
NEXT_PUBLIC_SITE_URL=https://trackid.lb
```

---

## Key Decisions Made

- **No payment gateway** — COD only at launch. Order status tracked manually in admin.
- **Payload Local API** — never call Payload via HTTP from RSC; always use the local API for zero latency.
- **Cursor pagination over offset** — `findMany({ cursor, limit })` not `findMany({ page, limit })`.
- **ISR not SSR for product pages** — product data changes infrequently; edge caching > per-request DB hit.
- **Supabase Storage not Cloudinary** — Cloudinary unavailable in Lebanon; Supabase serves images from same project as DB.
- **Notifications run in `after()`** — email/WhatsApp are dispatched via Next 15's `after()` from `next/server` after the order response, so a notification failure never blocks the order and the serverless function isn't frozen before they complete (a plain `void` can be).
- **Server is authoritative for money** — the orders API resolves prices, delivery fee, and discount from the DB (client sends only `{ productId, quantity, size }` + a discount code); stock is decremented atomically. Never trust client-supplied totals.
- **Globals use `unstable_cache`** — SiteSettings/Navigation cached server-side, tagged (`site-settings`/`navigation`) and busted by afterChange hooks; `getSiteSettings(locale)`/`getNavigation(locale)` cache per locale.
- **CSS vars injected at layout level** — Theme colors/fonts/radius live in SiteSettings; the layout RSC injects a `:root{...}` inline `<style>`, overriding Tailwind `@theme` at runtime with zero client JS.
- **Nav is client, NavWrapper is server** — server wrapper fetches globals and passes props to the client Nav (which needs `useCart`).
- **Fallback defaults on all globals** — fresh install with empty globals still renders via hardcoded fallbacks.
- **No `localStorage`, ever** — customer data must be server-backed via customer accounts. The cart is the only current localStorage user and gets replaced in the accounts phase. (See memory `no-localstorage-use-accounts`.)
- **i18n: English default unprefixed, others prefixed** — `next-intl` `localePrefix: 'as-needed'` (`/shop` = en, `/ar/shop` = ar); routes live under `app/[locale]/`; Payload `localization` for content, next-intl catalogs for UI chrome; RTL driven by a locale set so adding an LTR locale needs no change. Adding a locale = 1 line in `i18n/routing.ts` + a `messages/*.json` + a `payload.config` locale.
- **Schema changes go through migrations, not push** — prod `push: false` (migration-only); dev keeps push against a *disposable* dev DB. The `migrate:*` scripts run `scripts/migrate.mjs` (esbuild-bundled config, no Payload CLI) — works on any Node, locally and on Vercel (Session 20). Localize-field migrations must copy data into the `en` locale or values blank. (See `MIGRATIONS.md` + memory `schema-migrations-workflow`.)

---

## Folder Structure

```
trackid-lb/
├── src/
│   ├── middleware.ts            # next-intl locale routing (excludes api/admin/_next)
│   ├── i18n/                    # routing.ts (locales, as-needed, RTL set) · navigation.ts · request.ts
│   ├── app/
│   │   ├── [locale]/            # locale segment (en unprefixed, /ar prefixed)
│   │   │   └── (frontend)/      # storefront routes
│   │   │       ├── layout.tsx   # async — lang/dir, CSS vars, NextIntlClientProvider, metadata
│   │   │       ├── globals.css  # Tailwind v4 @theme defaults (overridden at runtime by layout)
│   │   │       ├── page.tsx · shop/ · product/[slug]/ · artist/[slug]/
│   │   │       ├── [slug]/ · p/[slug]/   # CMS pages (clean URL + /p alias)
│   │   │       ├── cart/ · checkout/ · custom-request/ · track/
│   │   │       └── order/[orderNumber]/  # order confirmation
│   │   ├── api/                 # orders · custom-requests · discounts/validate · seed
│   │   ├── sitemap.ts · robots.ts · not-found.tsx
│   │   └── (payload)/           # Payload admin routes (auto-generated)
│   ├── collections/             # Products, Artists, Categories, Orders, CustomRequests,
│   │   │                        #   Pages, Media, GarmentTypes, Discounts, Users
│   ├── globals/                 # SiteSettings, Navigation, Homepage (+ blocks/)
│   ├── migrations/              # committed DB migrations (prod is migration-only) — see MIGRATIONS.md
│   ├── components/              # nav/ (Nav, NavWrapper, Footer, LocaleSwitcher) · cart/ (CartContext,
│   │   │                        #   CartDrawer) · product/ · sections/ · checkout/ · custom-request/ ·
│   │   │                        #   admin/ (SalesDashboard, Media views) · Analytics · AnnouncementBar ·
│   │   │                        #   WhatsAppButton · ui/ (Button, FormField)
│   ├── payload.config.ts        # Payload root config (collections, globals, localization, migrations, S3)
│   └── lib/                     # payload · site-settings · notifications · discounts · stock · slug ·
│                                #   revalidate · media-fill · api-guards · access · image · cart
├── messages/                    # en.json · ar.json (UI string catalogs)
├── scripts/seed.mjs             # `npm run seed [-- --reset]`
├── CLAUDE.md · IMPROVEMENTS.md · DEPLOY.md · MIGRATIONS.md
└── .env.local (+ .env.local.example)
```

---

## Session Log

### Session 1 — 2026-05-26
- Defined project scope, stack, and all architecture decisions
- Created CLAUDE.md
- Completed all of Phase 1: scaffolded Next.js 15.4.11 + Payload CMS 3.84.1
- All 7 Payload collections written and type-checked
- Performance architecture baked in from day one (ISR, cursor pagination, RSC, Local API)

### Session 2 — 2026-05-26
- Fixed Payload admin panel (was broken due to missing `ConfigProvider` / double-HTML layout conflict)
  - `(payload)/layout.tsx` now uses `RootLayout` from `@payloadcms/next/layouts` — provides full provider tree + HTML shell
  - Added `import '@payloadcms/next/css'` to load Payload's pre-compiled admin CSS
  - Root `app/layout.tsx` stripped to `return children` — HTML shell owned per route group
  - `(frontend)/layout.tsx` provides `<html><body>` for storefront
- Added `postcss.config.mjs` — required for Tailwind v4 PostCSS processing
- Completed Phase 2 — full storefront UI built:
  - Dark editorial design system via Tailwind v4 `@theme` tokens
  - Homepage (hero + featured products grid)
  - Shop catalog (RSC, cursor pagination, filter by artist + category)
  - Product detail page (ISR, image gallery, sticky details panel)
  - Cart (localStorage, React Context, live count badge in nav)
  - COD Checkout form (client component → `POST /api/orders`)
  - Order confirmation page
- Next up: Phase 3 — Resend email + WhatsApp Cloud API notifications

### Session 3 — 2026-05-28
- Pre-launch audit completed — identified critical bugs and UX gaps
- Fixed admin panel Cloudinary → Supabase Storage descriptions (Products, Artists, Pages collections)
- Fixed "Clear filters" link showing when catalog is empty with no active filter
- Fixed hardcoded `PAYLOAD_SECRET` in `payload.config.ts` — now reads from env
- Fixed order number collision bug: replaced module-level counter (resets on cold start) with `TRK-{ts6}-{rand4}` — stateless, collision-safe across instances
- Completed Phase 3: created `src/lib/notifications.ts`
  - `sendOrderConfirmationEmail` — dark on-brand HTML email via Resend (skips gracefully if key not set)
  - `sendOrderWhatsAppAlert` — team alert via WhatsApp Cloud API (skips gracefully if keys not set)
  - Both calls are fire-and-forget in orders route — notification failures never block orders
- Added `RESEND_FROM` to `.env.local` and `.env.local.example`
- Outstanding pre-launch items: bank transfer instructions on checkout, richer order confirmation page, delivery fee UX, stock decrement on order

### Session 4 — 2026-05-28
- Completed Phase 4 — Content pages
  - `/custom-request` — form page with success state, `POST /api/custom-requests` saves to Payload
  - `/artist/[slug]` — ISR artist profile: photo, genre, bio, product grid; `generateStaticParams` for all artists
  - `/p/[slug]` — generic Payload Pages renderer; `dynamicParams: true` so new pages auto-serve without redeploy
  - `src/components/RichTextRenderer.tsx` — Lexical serializer (paragraphs, headings, lists, links, quotes, bold/italic/underline/code)
  - Nav now shows: Shop · Custom · Cart
  - Artist link on product detail now routes to `/artist/[slug]` instead of shop filter
- Zero new TypeScript errors introduced

### Session 5 — 2026-05-28
- Completed Phase 5 — Polish
  - globals.css: smooth scroll, keyboard focus ring, text selection style, scrollbar-gutter
  - Checkout: order summary renders above the form on mobile (order-1/order-2 CSS)
  - Site metadata: `metadataBase`, `openGraph`, `twitter` card added to frontend layout
  - Product pages: OG image from first product photo + JSON-LD Product schema (price, availability, brand)
  - Artist pages: OG image from artist photo in metadata
  - Custom request: `layout.tsx` exports metadata (workaround for client component page)
  - `src/app/sitemap.ts` + `src/app/robots.ts` — fully dynamic, reads from Payload at build time
  - Instagram section deferred (handle not yet available)
- No new TypeScript errors; sitemap `updatedAt` cast fixed (Payload types not yet generated)
- Button text color fix: `.text-on-accent { color: var(--color-on-accent, #0a0a0a) }` (Tailwind v4 cannot generate text utilities from CSS vars named with reserved prefixes like `bg`)
- Footer component added: `src/components/nav/Footer.tsx` — RSC, dynamically fetches CMS pages

### Session 6 — 2026-05-29
- Agreed on white-label customisation roadmap (Phases 6–10)
- Completed Phase 6 — Site Settings + Navigation Globals
  - `src/globals/SiteSettings.ts` — 5-tab Payload Global (Brand, Announcement Bar, Footer, Theme, SEO)
  - `src/globals/Navigation.ts` — headerLinks[] + footerColumns[] arrays
  - Both registered in `payload.config.ts` under "Site Configuration" admin group
  - `src/lib/site-settings.ts` — `getSiteSettings`, `getNavigation` with 5-min `unstable_cache`; color scheme helpers
  - `src/components/nav/NavWrapper.tsx` — server wrapper that feeds props to Nav; graceful fallback to hardcoded defaults when Navigation global has no data
  - `Nav.tsx` updated to accept `storeName` + `links[]` props — no longer hardcoded
  - `Footer.tsx` fully driven by globals — social links, footer columns, copyright, tagline all from DB
  - `AnnouncementBar.tsx` — toggleable banner above nav, colors controlled from admin
  - `(frontend)/layout.tsx` converted to async RSC; injects inline `<style>` with CSS custom properties from SiteSettings; `generateMetadata` reads from DB
- Completed Phase 7 — Color Scheme System
  - Three presets (dark/light/warm) + Custom with 8 individual color fields
  - `--color-on-accent` added to `@theme` defaults and `.text-on-accent` now uses `var(--color-on-accent)` — button text adapts to any color scheme automatically
  - CSS vars injected via layout `<style>` tag; overrides `@theme` at runtime; zero client JS overhead
- Next: Phase 8 — Homepage Block Builder

### Session 7 — 2026-05-29
- Fixed dev cache TTL: `revalidate: 1` in development, 300 in production — changes appear immediately in dev
- Completed Phase 8 — Homepage Block Builder
  - 7 Payload block definitions in `src/globals/blocks/`
  - `Homepage` Global registered in payload.config.ts under "Site Configuration"
  - 7 matching React section components in `src/components/sections/`
  - `SlideshowSection` is a client component with auto-advance, pause on hover, dot + arrow nav
  - `FeaturedSection` is an async server component — queries Payload directly for "latest" or uses resolved relations for "manual"
  - `BlockRenderer` orchestrates all sections, filters `hidden: true` blocks, shows empty state
  - `page.tsx` now a 10-line RSC — fetches Homepage global (depth: 2) and delegates entirely to BlockRenderer
  - Restart dev server and go to Admin → Site Configuration → Homepage to build the homepage
- Next: Phase 9 — Extended Page Builder

### Session 8 — 2026-06-11
- Full codebase audit + production build verification
- Fixed 6 TypeScript errors (the "zero TS errors" claim had gone stale):
  - `next.config.ts` — removed invalid `configPath` option from `withPayload`
  - `product/[slug]/page.tsx` — typed `tags.map()` params
  - Removed 3 stale `@ts-expect-error` directives in `(payload)/admin` pages
- `npm run build` passes — 16 pages, zero type errors
- Created **`IMPROVEMENTS.md`** (repo root) — the full audit findings + prioritized roadmap. Read it before doing any new work. Highlights:
  - P0: orders API trusts client prices ($0-order exploit), no stock check/decrement, no rate limiting, `void`-ed notifications can be killed on Vercel (use `after()`), HTML injection in email, announcement bar hidden behind fixed nav, order confirmation page fetches nothing, `PAYLOAD_SECRET` fallback still hardcoded, no slug normalization (live `/product/Jeans`), role field enforces nothing
  - P1: delivery fees, bank transfer instructions, product sizes/variants, broken "Load More", search/sort, status-update emails
  - P2 white-label: dead SiteSettings fields (logoUrl/ogImage/contactEmail/tagline/whatsappNumber never rendered), ~10 hardcoded brand strings, no font/radius/favicon settings
  - P3: Media upload collection (replace paste-a-URL workflow), generate payload-types.ts, drafts/preview, instant revalidation hooks
- Proposed execution order: Phases 9a/9b (security + launch UX) → 10 (commerce depth) → 11 (true white-label) → 12 (admin UX) — see IMPROVEMENTS.md
- Doc corrections needed in this file: images are Supabase (two sections still say Cloudinary); `/shop` is dynamic, not ISR; Session 3's PAYLOAD_SECRET fix is incomplete

### Session 9 — 2026-06-11
- Completed **Phase 9a — Trust the server** (all P0 order-integrity items from IMPROVEMENTS.md):
  - `POST /api/orders` rewritten: client now sends only `{ productId, quantity }`; prices, titles, and images are resolved from the DB; unknown/unpublished products rejected; quantities validated (integer 1–99, ≤30 distinct items, duplicates merged)
  - Stock: atomic conditional decrement (`UPDATE products SET stock_quantity = stock_quantity - $1 WHERE … AND stock_quantity >= $1` via `payload.db.pool`, with payload.update fallback); decrements rolled back if a later item is out of stock or order creation fails; 409 with the item name on insufficient stock
  - Orders `afterChange` hook: cancelling restocks items, un-cancelling re-decrements (floored at 0); order delete is now admin-only
  - `src/lib/api-guards.ts` (new): in-memory sliding-window rate limit + string length/shape validators; orders 5/10min/IP, custom requests 3/10min/IP; honeypot field `website` on both forms (bots get fake success)
  - Notifications now run inside `after()` from `next/server` (a `void`-ed promise can be frozen on Vercel before completing); all customer-supplied values in the email HTML are escaped (`escapeHtml`)
  - `payload.config.ts` throws at startup in production if `PAYLOAD_SECRET` is unset (dev-only fallback retained)
  - `src/lib/access.ts` (new) `isAdmin()`; Users collection: only admins create/delete users, users may edit themselves but the `role` field is admin-only (no self-promotion)
  - Cart: `CartItem.maxQuantity` added; add/update clamp to available stock; cart page + button disables at max (UI nicety — server re-validates regardless)
- Build verified passing after all changes; IMPROVEMENTS.md checkboxes updated (1.1, 1.2, 1.4, 1.5, 1.6, 1.9, 1.11 ☑)
- Deliberately skipped: auto-unpublishing one-of-a-kind at stock 0 — page stays live showing "Sold Out" so shared links don't 404
- Completed **Phase 9b — Launch UX** in the same session:
  - Slug normalization: `src/lib/slug.ts` (`slugify` + `formatSlug` beforeValidate hook) on Products/Artists/Categories/Pages; slugs auto-generate from title/name when empty; one-off DB fix normalized existing data (`Jeans` → `jeans`, one category)
  - SiteSettings → new **Commerce** tab: `deliveryZones[] { label, fee }`, `freeDeliveryThreshold`, `bankTransferInstructions`
  - Checkout split into RSC page + `src/components/checkout/CheckoutForm.tsx` (client): area becomes a zone dropdown with live fee in the summary (falls back to free text when no zones configured), bank-transfer instructions box, client phone validation
  - Orders API: delivery fee computed server-side from zones (rejects unknown areas when zones exist, validated **before** stock decrement), generic international phone validation, fee/total + bank instructions passed to email/WhatsApp
  - Email: Delivery + Total rows in totals table; bank instructions rendered (escaped) when set
  - Order confirmation rebuilt at `/order/[orderNumber]` (folder renamed from `[id]`): fetches the order, 404s on bad numbers, shows items/totals/fee/status/address/payment + "How to pay" bank box
  - Header stack fixed: announcement bar + nav share one `sticky top-0` wrapper, nav no longer `fixed`, `pt-14` removed — announcement bar finally visible
  - Mobile nav: hamburger menu (cart + badge stay visible, CMS links collapse into a panel)
  - Shop pagination: honest "Next Page →" / "← First Page" (was a "Load More" that replaced the grid)
  - Product page: quantity selector (clamped to stock, hidden for single-stock pieces) + "Added ✓" button feedback; `CartContext.addItem` accepts a quantity
- Build verified passing after 9a + 9b; IMPROVEMENTS.md updated (1.7, 1.8, 1.10, 2.1, 2.2, 2.4 ☑; 2.5 partial)
- Completed **Phase 10 — Commerce depth** in the same session:
  - **Instant revalidation** (1.3): `src/lib/revalidate.ts` (`safeRevalidatePath`/`safeRevalidateTag`); afterChange/afterDelete hooks on Products/Artists/Categories/Pages and all three globals; `unstable_cache` calls tagged (`site-settings`, `navigation`); the orders route revalidates affected product pages + /shop directly (its raw-SQL decrement bypasses hooks). Admin edits and stock changes now appear immediately — the 1h ISR window is gone.
  - **Sizes/variants** (2.3): `Products.sizes[] { label, stockQuantity }` (hidden for one-of-a-kind; flat stockQuantity used when empty); `src/lib/stock.ts` (`getSizes`, `totalStock`) centralizes semantics; `Orders.items.size` field added. Size picker on product page with per-size sold-out states. Cart lines keyed `product|size` (`cartLineKey` in cart.ts; CartContext remove/update take the line key; old localStorage carts backfilled on read). Orders API validates the size against the catalog and decrements `products_sizes` atomically (SQL conditional update, read-modify-write fallback); restock-on-cancel hook is size-aware. Size shown in cart, checkout summary, confirmation page, email, WhatsApp.
  - **Status updates** (2.6): `sendOrderStatusEmail` in notifications.ts (confirmed/in_production/shipped/delivered/cancelled copy); Orders afterChange hook emails the customer on status transitions (skipped on create). `/track` page (RSC + small client form) redirects to `/order/[orderNumber]`; linked in footer fallback.
  - **Search/sort/discovery** (2.7): shop `?q=` search (title + tags via `like`, plain GET form, zero JS), sort Newest/Price↑/Price↓ (price sorts are single 60-item pages — createdAt cursor only applies to newest), sold-out badge + dimmed image on ProductCard (shop/featured/related), "Only X left" hint (≤2, non-one-of-a-kind), related products on product detail ("More from {artist}", category fallback)
- **Schema note**: new `products_sizes` table + `orders_items.size` column required a dev-server boot to push (Payload only pushes schema in dev) — first prod build failed with `relation "products_sizes" does not exist`, fixed by running `npm run dev` once. Remember this for any future field additions before a production deploy (or set up proper Payload migrations).
- Build verified passing (17 pages incl. /track); deferred from 2.7: artist filter chips → dropdown at scale
- Next: **Phase 11 — True white-label** (IMPROVEMENTS.md §3: dead SiteSettings fields, Copy tab for hardcoded strings, fonts, radius, favicon + §4.2 generate payload-types)

### Session 10 — 2026-06-30
Focus: "launch trackID.lb for real" — wired dead settings, then did the big admin pain point (media uploads). Spans parts of Phase 11 + Phase 12.
- **Clean URLs + 404s**: added `(frontend)/[slug]/page.tsx` (CMS pages now serve at `/about` etc., not just `/p/about`; `/p/[slug]` still works) and `(frontend)/not-found.tsx` + root `app/not-found.tsx` (carries its own `<html>/<body>`) — fixes the "Missing `<html>` and `<body>`" runtime error any bad URL used to throw through the bare root layout.
- **Phase 11 — dead SiteSettings fields wired (3.1, 3.5)**:
  - `logoUrl` → rendered in Nav + Footer (fixed-height `<img>`, true aspect ratio; text logo when blank)
  - `whatsappNumber` → floating WhatsApp button (`src/components/WhatsAppButton.tsx`, in frontend layout; `getWhatsAppLink` sanitizes to a `wa.me` link; renders only when set)
  - `ogImage` → default OG/Twitter image in layout `generateMetadata`; new `faviconUrl` field (SEO tab) → `icons`
- **Phase 12 — Media uploads (4.1) DONE** via `@payloadcms/storage-s3@3.84.1` → Supabase S3 (`forcePathStyle`, public-CDN URLs via `generateFileURL`, `disablePayloadAccessControl`; plugin `enabled` only when S3 creds present, else local-disk fallback):
  - `src/collections/Media.ts` — upload collection, sharp thumbnail/card/feature sizes, `alt` field
  - **Picker pattern (no data migration)**: an `upload`-relation field sits next to every existing URL text field — `products.images[].image`, `artists.photoMedia`, SiteSettings `logo`/`ogImageMedia`/`faviconMedia`, hero/cta-banner `bgImageMedia`, slideshow `slides[].bgImageMedia`, image-text `imageMedia`. A `beforeValidate` hook (`src/lib/media-fill.ts → mediaUrl`) copies the picked media's URL into the text field the storefront already reads → **zero rendering-component changes**, manual URLs still work. Required URL fields relaxed to optional so admin client-side validation doesn't block picking media.
  - **Custom Media admin view** (gallery instead of text table): `src/components/admin/MediaGridView.tsx` (server) registered via `admin.components.views.list` + `admin.importMap.baseDir = src`; tiles are `MediaGridTile.tsx` (client) that link to edit on the normal page but call `useListDrawerContext().onSelect` when rendered inside a relationship/upload select drawer (fixes "clicking a pic opens edit instead of selecting"). `MediaBulkUploadButton.tsx` re-adds Payload's native bulk-upload drawer (the custom view replaced the default toolbar). Still missing vs default list: search box + bulk-select-delete.
  - **Rich-text images**: `RichTextRenderer.tsx` now handles the Lexical `upload` node (embedded Media images), `next/image` when width/height present — fixes embedded images silently dropping on Pages/product descriptions.
- **Env**: added `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `ACCESS_KEY_ID_SUPABASE`, `SECRET_ACCESS_KEY_SUPABASE` to `.env.local` (region `eu-central-1`). `.env.local` is gitignored — set these in Vercel for prod.
- ⚠️ **Schema push**: new `media` table + upload-relation columns only push on `npm run dev` (Payload dev-only sync) — run dev once before any prod build or it fails with `relation "media" does not exist`.
- **Roadmap**: added **4.6 — Admin sales & analytics dashboard** (requested this session) to IMPROVEMENTS.md (slotted into Phase 12). Marked 3.1, 3.5, 4.1 ☑.
- **Launch polish** (chose "launch-critical first"): added `loading.tsx` skeletons (shop/product/artist) + frontend `error.tsx` boundary; `src/lib/image.ts → resolveAlt` (per-use alt → Media library alt → title fallback) applied in shop/artist/featured/product pages.
- **4.2 generate types — BLOCKED**: `npm run payload generate:types` (and `generate:importmap`) fail under Node 25.2.1 + tsx with `ERR_MODULE_NOT_FOUND` on the extensionless imports in payload.config.ts. The Next dev server resolves them fine (it regenerates importMap on boot), but the standalone CLI doesn't. Workaround: run the CLI under Node LTS (20/22), or add explicit extensions. Not a build blocker — app still uses `Record<string, any>` casts.
- ✅ **Production build verified passing this session** — `npm run build`: 19 routes, zero TS errors, clean URLs `/about` + `/contactus` prerendered, no `relation "media" does not exist` (schema already pushed via dev). App is deployable.
- Next: finish **Phase 11** (4.2 types when on Node LTS, 3.2 Copy tab, 3.3 fonts, 3.4 radius), then **Phase 12** (4.6 sales dashboard, 4.3 drafts, 4.5 seed). For deploy: set the `.env.local` vars in Vercel (incl. the new `SUPABASE_S3_*` + `ACCESS_KEY_ID_SUPABASE`/`SECRET_ACCESS_KEY_SUPABASE`).

### Session 11 — 2026-06-30
Focus: **Phase 11 — 3.2 Copy tab** (the last brand-name lock-in before true white-label). The 4 commits earlier today had already landed 3.3 fonts, 3.4 radius, 3.7 garment types, 4.1 media uploads, and 4.6 sales-dashboard v1 — this session closed the hardcoded-strings gap.
- **Fixed broken install first**: `@payloadcms/storage-s3` was missing from `node_modules` (app 500'd with "Can't resolve @payloadcms/storage-s3"). Ran `npm install` → 63 packages added; storage-s3 + payload both `3.84.1`.
- **SiteSettings → new Copy tab** (`src/globals/SiteSettings.ts`): `productBlurb`, `productMetaTagline`, `emptyCartMessage`, `orderThankYouNote`, `emailGreeting`, `emailFooterNote`, `orderNumberPrefix` — each carries its old hardcoded text as `defaultValue`, so a fresh/empty install reads identically.
- **`src/lib/site-settings.ts`**: added `resolveBrandCopy()` + `resolveStoreName()` + `DEFAULT_*` constants; `resolveCopyright(template, storeName?)` now derives the fallback from the store name (Footer passes it).
- **Email** (`notifications.ts`): `OrderNotificationData.brand` + `StatusEmailData.brand` (a `BrandCopy` mirror type, kept local so the file stays a pure renderer). Both email templates now use `brand.storeName` (header + footer) and the confirmation email uses `brand.emailGreeting` / `brand.emailFooterNote`. Orders API (`api/orders/route.ts`) builds `brand` from the settings it already fetched; Orders `afterChange` status hook fetches settings and passes `brand`. **Email shell stays dark** — theme-color derivation deliberately deferred (transactional legibility).
- **Storefront copy**: product page meta/JSON-LD `brand`/`seller` + the blurb paragraph now from `storeName` + Copy fields; artist page meta uses `storeName`; cart empty-state message threaded through `CartProvider` (server layout reads `settings.emptyCartMessage`, passes as prop, exposed via `useCart().emptyCartMessage`); order-confirmation subtitle from `orderThankYouNote`.
- **Order number prefix**: `generateOrderNumber(prefix)` sanitizes `settings.orderNumberPrefix` (default `TRK`).
- **Config-time / client-side bits** (can't read the DB): admin `titleSuffix` → `NEXT_PUBLIC_STORE_NAME`; cart localStorage key → `NEXT_PUBLIC_CART_KEY`; `https://trackid.lb` env fallbacks in layout/sitemap/robots → `http://localhost:3000` (so a fresh clone isn't silently branded). Documented both new optional vars in `.env.local.example`.
- ⚠️ **Schema push**: the new Copy columns are additive, but the same dev-push surfaced a **pre-existing destructive drift** — storage-s3 3.84.1 no longer keeps a per-file `media.prefix` column, so Payload dropped it (21 rows). Confirmed safe (prefix is now the static `'media'` config value; URLs live in `url` and are rebuilt by `generateFileURL`), user approved, pushed. This drop will re-appear on any future schema push until a real migration removes it.
- ✅ **Production build verified passing** — `npm run build`: 25 routes, zero TS errors (`npx tsc --noEmit` also clean), no `column does not exist`. App is deployable.
- Leftover brand-voice nicety: the 5 `STATUS_EMAIL_COPY` lines stay hardcoded tone (not name-locked) — deferred.
- Next: 4.2 generate types (Node LTS), 3.1 leftovers (contactEmail reply-to, tagline), or jump to the live deploy (DEPLOY.md) — code is launch-ready.

### Session 12 — 2026-07-01
Focus: **Phase 12 / 3.6 — Blocks-on-Pages** (the last "build any page from admin" gap — CMS pages could only be rich text). Picked from the deferred-features backlog.
- **Shared the block-media hook**: extracted the homepage's inlined `beforeValidate` switch (picked Media → copy public URL into the text field each section reads) into `src/lib/media-fill.ts → fillBlocksMedia(payload, blocks)`. `Homepage.ts` now calls it (no behavior change, ~35 dup lines gone); `Pages.ts` reuses the same helper so both block builders behave identically.
- **`Pages` collection** (`src/collections/Pages.ts`): added a `sections` blocks field with the same 7 blocks as the homepage (Hero, Slideshow, FeaturedProducts, ImageText, Statement, RichText, CTABanner) + the `fillBlocksMedia` beforeValidate hook. `content` (richText) description now notes it's ignored when sections are present.
- **Renderers** (`(frontend)/[slug]/page.tsx` **and** `(frontend)/p/[slug]/page.tsx` — identical duplicates, both updated): when a page has any visible section (`sections.some(b => !b.hidden)`), render full-width via `BlockRenderer`; otherwise fall back to the classic title + rich-text layout. Backward compatible — existing text-only pages unchanged. Added `depth: 2` to the find so manual FeaturedProducts relations resolve.
- **Fixed a latent revalidation bug**: pages serve at **both** `/p/<slug>` and the clean `/<slug>`, but Pages' afterChange/afterDelete only revalidated `/p/<slug>`. Added a `revalidatePage(slug)` helper that hits both paths.
- ⚠️ **Schema push**: new `pages_blocks_*` tables push only on `npm run dev` (Payload dev-only sync) — user ran dev this session, tables present and working.
- ✅ `npx tsc --noEmit` clean. IMPROVEMENTS.md 3.6 marked ☑; execution-order table updated.
- Next remaining deferred: 4.3 drafts/versions/preview, 4.5 seed script, 4.6 dashboard v2, plus P4 storefront polish (cart drawer, gallery thumbnails, wishlist, a11y) and P5 growth. Code stays launch-ready.

### Session 13 — 2026-07-01
Focus: **4.3 — Draft/publish for Pages** (Pages just became full page builders in Session 12, so staging before going live matters now).
- **Decision**: implemented a plain `status` (draft/published) field on Pages instead of Payload `versions.drafts`. Rationale: Payload versions add a separate `_status` that defaults **existing** live pages to `draft` (they'd vanish from storefront + sitemap until manually re-published), and duplicate Products' existing manual `status`. The simple field fixes the actual bug (pages public/into the sitemap the instant they're created) with **zero migration risk** — new column defaults to `published`, so existing pages stay live. Version history/rollback + live-preview iframe deferred (noted in IMPROVEMENTS.md 4.3). User picked this over the full-versions option when asked.
- **`Pages` collection** (`src/collections/Pages.ts`): added `status` select (Draft/Published, `defaultValue: 'published'`, indexed, sidebar). Added to admin `defaultColumns`.
- **Storefront filters `status: published`** everywhere pages are read: both renderers (`(frontend)/[slug]/page.tsx` + `(frontend)/p/[slug]/page.tsx`) in the main find, `generateMetadata`, and `generateStaticParams`; plus `sitemap.ts`. Draft pages 404 on the storefront and are excluded from the sitemap. Footer lists pages via the Navigation global (not a pages query), so no leak there.
- Mirrors the existing Products `status` pattern for consistency. Pages' afterChange revalidation (both `/p/<slug>` and `/<slug>`, from Session 12) already covers publish/unpublish transitions.
- ⚠️ **Schema push**: new `pages.status` column is additive (default `published`) — pushes only on `npm run dev`. Safe: existing pages auto-published.
- ✅ `npx tsc --noEmit` clean. IMPROVEMENTS.md 4.3 status-field part marked ☑ (versions + live preview deferred).
- Next remaining deferred: 4.5 seed script, 4.6 dashboard v2, P4 storefront polish, P5 growth. Code stays launch-ready.

### Session 14 — 2026-07-01
Focus: **4.5 — Seed script** (demo-able fresh installs).
- **Delivered as a seed API route, not a CLI script**: `src/app/api/seed/route.ts` runs the seed inside the Next server (where payload.config's extensionless imports resolve); `scripts/seed.mjs` just POSTs to `/api/seed`; `npm run seed` runs the script. This deliberately sidesteps the Session 10 blocker where the standalone Payload CLI fails under Node 25 (`ERR_MODULE_NOT_FOUND`). The dev server (or any running instance) must be up.
- **Seeds**: 3 categories (Hoodies/Tees/Accessories), 3 artists (Fairuz, Mashrou' Leila, Marcel Khalife — with bios/genre/photo), 6 products (mix of sized S–XL and one-of-a-kind, all `published`, `placehold.co` demo images). Added `placehold.co` to `next.config.ts` remotePatterns so next/image renders the demo art.
- **Idempotent + non-destructive**: `ensureBySlug` creates catalog rows only when the slug is missing (safe to re-run). Homepage `sections` seeded (Hero + FeaturedProducts[latest] + Statement) only when currently empty. SiteSettings delivery zones + `bankTransferInstructions` + announcement seeded only when commerce is unconfigured — a real store's data is never overwritten.
- **Prod guard**: `authorized()` allows dev freely; in production the route 403s unless `SEED_SECRET` env is set and passed via `x-seed-secret` header / `?secret=`. Documented `SEED_SECRET` + `SEED_URL` in `.env.local.example`.
- ⚠️ Did **not** run it against the live dev DB (it would inject demo catalog rows into the real Supabase project) — left for the user to run on a fresh install.
- ✅ `npx tsc --noEmit` clean. IMPROVEMENTS.md 4.5 marked ☑.
- Next remaining deferred: 4.6 dashboard v2, P4 storefront polish (cart drawer, gallery thumbnails, wishlist, a11y), P5 growth. Code stays launch-ready.

### Session 15 — 2026-07-01
Focus: **4.6 — Sales dashboard v2**.
- **Doc was stale**: `SalesDashboard.tsx` had already grown past what IMPROVEMENTS.md credited as "v1" — the interactive `?range=` selector (Today/7d/30d/90d/All), the 30-day revenue bar chart, top-artists, sales-by-area/zone, revenue+qty per product, and the `isAdmin(props.user)` gate were all already implemented. Corrected 4.6 in IMPROVEMENTS.md to mark them ☑.
- **Added period-over-period comparison** (the real v2 gap): `rangeMsFor(key)` + `pctDelta(cur, prev)` compute the prior equal-length window; Revenue / Orders / AOV KPI cards now show a colored ▲/▼ % delta vs that prior period ("new" when there's no prior data, `±0%` when flat, hidden for All-time). Added a dedicated **Orders** KPI card (was only a sub-line). `Kpi` component extended with an optional `delta` badge. Pure JS over the orders already fetched — no new deps, no schema change, no new queries.
- **Deliberately did NOT add recharts** — the existing dependency-free bar chart is theme-colored and zero-dep; adding a chart lib for one chart isn't worth the bundle. Noted in the doc.
- **Deferred** (scale/infra, not launch-critical): JS→SQL aggregation via `payload.db.pool` at large order volumes; optional weekly email summary (needs a Vercel Cron hitting an API route — best wired at/after deploy).
- ✅ `npx tsc --noEmit` clean. IMPROVEMENTS.md 4.6 marked ☑ v2; execution-order Phase 12 row updated (4.1/3.6/4.3/4.5/4.6 all ☑).
- Phase 12 (Admin experience) is now essentially complete. Next: P4 storefront polish or P5 growth. Code stays launch-ready.

### Session 16 — 2026-07-01
Focus: **P4 storefront polish** — user picked gallery+quick-wins, accessibility, and the cart drawer.
- **Two items were already done** (doc stale): the product gallery (`ProductGallery.tsx`) is already an interactive thumbnail-switching client component, and `loading.tsx`/`error.tsx`/`not-found.tsx` landed in Session 10. Marked ☑.
- **Cart drawer** (slide-over mini-cart): new `src/components/cart/CartDrawer.tsx`, mounted in the frontend layout. CartContext gained `isOpen`/`openCart`/`closeCart`. Opens on add-to-cart (`AddToCart` calls `openCart()` after `addItem`) and from the nav cart button (Nav cart changed from a `/cart` Link to a button that opens the drawer). Drawer has per-line qty steppers + remove, subtotal, Checkout + View-full-cart links, empty state using the CMS `emptyCartMessage`. A11y: `role="dialog"` + `aria-modal`, Esc to close, overlay-click close, body-scroll lock while open, focus moves to the close button on open and returns to the trigger on close. The `/cart` + `/checkout` pages remain the source of truth.
- **Accessibility pass**: Footer social links now render real SVG brand glyphs with `aria-label`+`title` (replaced the "IG"/"TK" text; unknown platforms fall back to a text label). Nav cart badge: visual count is `aria-hidden`, with an `sr-only` `aria-live="polite"` "N items in cart" announcement. Skip-to-content link added in the layout (`sr-only` → visible on focus) targeting `<main id="main-content" tabIndex={-1}>`. *Deferred*: automated contrast check on admin-set announcement-bar colors.
- **Quick wins**: canonical URLs via `alternates.canonical` on product (`/product/<slug>`), artist (`/artist/<slug>`), CMS pages (clean `/<slug>` — dedupes the `/p/<slug>` alias), and `/shop` (base — dedupes filter/search/sort variants). Removed the dead `experimental.reactCompiler: false` from `next.config.ts`. Replaced `/shop`'s misleading `export const revalidate = 30` with `export const dynamic = 'force-dynamic'` (it reads searchParams — always dynamic).
- ✅ `npx tsc --noEmit` clean. IMPROVEMENTS.md §5 updated (mobile nav, loading/error/not-found, gallery, cart drawer, a11y, canonicals, reactCompiler, /shop rendering all ☑).
- **Deferred P4**: wishlist/save-for-later + recently-viewed strip (both localStorage features), announcement-bar contrast check. Next: those, or P5 growth. Code stays launch-ready.

### Session 17 — 2026-07-02
Focus: **P5 growth — discount codes + analytics** (user picked both).
- **Discount codes** (full commerce feature, server-authoritative):
  - `src/collections/Discounts.ts` — code (uppercased via beforeValidate, unique), type (percentage/fixed), value, enabled, minSubtotal, expiresAt, usageLimit, auto-updated readOnly usageCount. Admin group "Commerce", writes gated to `isAdmin`. Registered in payload.config.
  - `src/lib/discounts.ts` — `resolveDiscount(payload, code, subtotal)` (shared) + `computeDiscountAmount` (clamped to subtotal, rounded to cents). Validates enabled/expiry/usage-limit/min-subtotal.
  - `POST /api/discounts/validate` — live checkout feedback (rate-limited, display-only).
  - **Orders API** recomputes the discount from the DB (never trusts the client), applies `total = max(0, subtotal − discount) + deliveryFee`, resolves it **before** touching stock (a now-invalid code fails cleanly with a clear message), stores `discountCode`+`discountAmount` on the order, and bumps `usageCount` after creation (non-fatal, atomic via pool with payload.update fallback).
  - `Orders` collection: readOnly `discountCode` + `discountAmount` fields.
  - `CheckoutForm`: apply/remove code UI (calls validate endpoint), discount summary line, sends `discountCode` in the order POST. Client discount is display-only; recomputed from type/value against the live subtotal.
  - Discount line rendered on the confirmation page and in the email (HTML totals + plain text; code escaped in HTML).
- **Analytics**:
  - SiteSettings → SEO: `gaMeasurementId` (GA4) + `metaPixelId` (Meta Pixel) fields.
  - `src/components/Analytics.tsx` — renders GA4 + Meta Pixel `next/script` tags **only when the matching ID is set** (no IDs → no third-party scripts). Mounted in the frontend layout with IDs from settings.
  - Installed `@vercel/analytics` and mounted `<Analytics />` from `@vercel/analytics/next` (always on; reports on Vercel).
- ⚠️ **Schema push**: new `discounts` table + `orders.discount_code`/`discount_amount` columns push only on `npm run dev` — run dev once before the next prod build.
- ✅ `npx tsc --noEmit` clean. IMPROVEMENTS.md §6 updated (discount codes + analytics ☑).
- Remaining P5 (deferred): newsletter capture (Resend Audiences), i18n/Arabic+RTL, WhatsApp activation (just needs Meta keys), Instagram embed (needs handle), customer accounts. Code stays launch-ready.

### Session 18 — 2026-07-02
Focus: **Phase 10 — Localization (i18n en/ar + RTL)**. User directives: (1) **no localStorage ever** — replace with server-backed **customer accounts** (only current localStorage user is the cart: `src/lib/cart.ts` + `CartContext`; removal deferred to the accounts phase); (2) **localization before accounts**; (3) English stays unprefixed, Arabic at `/ar`; (4) architect so a 3rd locale (Japanese `ja`) is a one-line add later.
- **Phase A — foundation + UI (BUILD VERIFIED)**:
  - `next-intl` v4: `src/i18n/routing.ts` (`localePrefix: 'as-needed'`, locales en/ar, RTL set `['ar']` + `isRtl()`), `navigation.ts` (locale-aware `Link`/`useRouter`/`usePathname`), `request.ts`, `src/middleware.ts` (matcher excludes `api`/`admin`/`_next`), plugin composed in `next.config.ts` as `withPayload(withNextIntl(...))`.
  - **Moved all `(frontend)` routes → `app/[locale]/(frontend)/` via `git mv`** (required the user to stop the dev server — Windows file lock). Fixed root `not-found.tsx` globals.css import path. `[locale]/(frontend)/layout.tsx` now sets `<html lang dir>`, calls `setRequestLocale`, wraps `NextIntlClientProvider`, `generateStaticParams` for locales.
  - Swapped every storefront `next/link`→`@/i18n/navigation` `Link` and the checkout/track `useRouter` (so Arabic nav keeps `/ar`). Admin components + root not-found stay on `next/link`.
  - Message catalogs `messages/{en,ar}.json`; translated chrome: Nav (+ **LocaleSwitcher**), CartDrawer, cart page, AddToCart, CheckoutForm, order-confirmation, Footer fallback, product page labels, ProductCard (made async for `getTranslations`). RTL logical classes (`-end-4`, `start-2`, `ms-2`, `ltr:/rtl:` on skip link).
  - ✅ `npm run build` passed — every page prerenders `/en` + `/ar`, middleware compiled.
- **Phase B — Payload content localization**:
  - `payload.config.ts`: `localization: { locales:[en,ar], defaultLocale:'en', fallback:true }`.
  - `localized: true` on: Products (title, description), Artists (bio, genre), Categories (name), GarmentTypes (name), Pages (title, content), SiteSettings (tagline, announcementText, footerTagline, footerNote, metaDescription, productBlurb, emptyCartMessage, orderThankYouNote), Navigation (header/footer link labels + columnTitle).
  - `getSiteSettings(locale)`/`getNavigation(locale)` are now locale-aware (locale is part of the `unstable_cache` key). `locale` threaded via `getLocale()` (or route param) into **every** storefront query: layout, NavWrapper, AnnouncementBar, Footer, homepage global, FeaturedSection, shop (+artist/category filters), product (meta + main + 2 related), artist, both page renderers, custom-request garment types, order page.
  - `sitemap.ts` now emits `/ar` variants of every URL.
  - ✅ **Full `npm run build` verified** after the schema push — every page prerenders `/en` + `/ar`, no schema errors.
- ⚠️ **Localization schema push is DESTRUCTIVE to existing data**: when a field is newly marked `localized`, Payload moves it to a separate `_locales` table and the dev **push does NOT migrate the old column values** — existing titles/content/nav labels come back **blank** (surfaced as a missing-`alt` error in ProductCard and a missing-`key` error in Footer, both since hardened: `alt={imageAlt || title || ''}`, footer keys fall back to index). For real data, take a Supabase backup first and use a proper Payload **migration** (copy old column → `en` locale) instead of a raw push; for demo data, run **`npm run seed -- --reset`** (new: wipes products/artists/categories/pages then reseeds a clean demo catalog into `en`; orders/media/users/discounts/globals untouched). This session's blanked data was disposable test data — recovered via reset+seed.
- **Memory saved**: `no-localstorage-use-accounts`, `localization-before-accounts`, `schema-migrations-workflow`.
- **Migrations workflow set up** (durable fix for the destructive-push problem): `payload.config.ts` now sets `db.migrationDir = src/migrations` and `push: NODE_ENV!=='production' && PAYLOAD_MIGRATE!=='true'` — **prod is migration-only** (never auto-syncs), dev keeps push. Added `migrate:create`/`migrate`/`migrate:status`/`migrate:down`/`migrate:fresh` npm scripts (all set `PAYLOAD_MIGRATE=true`). New **`MIGRATIONS.md`** documents the workflow + the two-DB recommendation + a data-preserving localize-field migration example. DEPLOY.md updated: Vercel build command → `npm run migrate && npm run build`. ⚠️ The `migrate:*` CLI **fails on the dev's Node 25** (same extensionless-import issue as `generate:types`) — must run under Node LTS or on Vercel. Build re-verified green after the config change (behavior-preserving: prod push was already off during `next build`).
- **Blanked test data recovered**: added an opt-in reset to the seed (`npm run seed -- --reset`) that wipes products/artists/categories/pages then reseeds a clean demo into `en`; the lost data was disposable test data.
- Deferred: homepage-block text + product-image `alt` localization, a few decorative shop/home strings (search placeholder, sort labels, "Shop" heading), localized order emails. **Next: customer accounts** (also removes the localStorage cart — do it as a reviewed migration).

### Session 19 — 2026-07-02
Focus: **Customer accounts — Phase A** (auth + account area + order linking; the localStorage-cart removal is Phase B). Decisions (asked): **guest cart + guest checkout** (server-backed, session cookie — Phase B), account includes **order history + saved addresses + wishlist + profile editing**. Separate `Customers` auth collection (not the staff `Users`).
- **`Customers` collection** (`src/collections/Customers.ts`): `auth` (30-day token, Lax cookie), fields name/phone/addresses[]/wishlist(→products). Access: public register; a customer reads/updates only itself (`user.collection === 'customers'` + id match); admin deletes. `admin.user` stays `Users`, so customer tokens can't reach `/admin`. Registered in payload.config.
- **Auth lib** `src/lib/auth.ts`: `getCustomer()` (reads the Payload auth cookie in an RSC, returns the customer or null), `setAuthCookie`/`clearAuthCookie` (httpOnly `payload-token`). 
- **Auth routes** (`/api/account/*`): `register` (validates, `payload.create` + auto `payload.login` + set cookie; 409 on dup email), `login` (`payload.login` + cookie), `logout` (clear cookie), `profile` (POST — update own name/phone/addresses, `overrideAccess` after verifying the cookie), `wishlist` (POST toggle + GET status; `safeRevalidatePath('/account')`).
- **Account pages** under `[locale]/(frontend)/account/`: `login`/`register` (server, redirect to `/account` if already authed) → `AuthForm` (client, shared login/register). `/account` dashboard (`force-dynamic`): greeting, **order history** (orders where `customer == me`), **wishlist** grid (`WishlistButton` remove), **profile** (`ProfileForm` — name/phone + dynamic saved-addresses list), `LogoutButton`.
- **Orders linked to accounts**: `Orders.customer` relationship (readOnly, indexed); the orders API reads the auth cookie and sets `customer` when a logged-in customer checks out (guest orders have none).
- **Checkout prefill**: checkout page (now `force-dynamic`) reads `getCustomer()` → passes name/phone/email + saved addresses to `CheckoutForm`; a "use a saved address" select fills area + address.
- **Product page wishlist**: `WishlistButton` in `fetchState` mode resolves login+saved state client-side on mount (via `GET /api/account/wishlist`), so **product pages stay statically generated**. Nav gained an **Account** link (desktop + mobile).
- Translations: `account` + `checkout.savedAddress*` namespaces in en/ar.
- ⚠️ **Schema push** (additive — safe, no data loss like localization): new `customers` table + `orders.customer` column + address/wishlist relation tables push on `npm run dev`. For prod, a reviewed (but non-destructive) migration.
- ✅ `npx tsc --noEmit` clean; **`npm run build` verified** (all `/api/account/*` routes + account pages build).
- **Phase B — server-backed cart (localStorage REMOVED — mandate satisfied)**:
  - **`Carts` collection** (`src/collections/Carts.ts`, admin-hidden, public writes blocked): keyed by `sessionId` (guest httpOnly `cart-session` cookie) OR `customer`; `items[]` = { product, size, quantity }.
  - **`src/lib/cart-server.ts`**: `findCart`, `serializeCart` (re-reads each product from the DB → **prices/titles/images/stock are always current**, fixing the old stale-price problem; drops unpublished/deleted products; localized), `mergeItems`, `mergeGuestCart`.
  - **`/api/cart`** route: `GET?locale=` reads the current cart (no cookie set on read → layout stays static); `POST { action: add|update|remove|clear }` mutates (validates product published + size + clamps to stock on add), sets the `cart-session` cookie on first guest add, returns the authoritative serialized cart.
  - **`CartContext` rewritten** off localStorage: fetches `/api/cart` on mount (and on locale change), mutations do an **optimistic** local update then reconcile with the server response. Same `useCart()` interface + new `refreshCart()`. `src/lib/cart.ts` trimmed to just the `CartItem` type + `cartLineKey` (localStorage `readCart`/`writeCart` deleted).
  - **Guest→account merge**: login + register routes call `mergeGuestCart(session cookie → customer)`; `AuthForm`/`LogoutButton` call `refreshCart()` so the client reflects the merged/switched cart.
  - ⚠️ **Schema push** (additive — safe): new `carts` table + items/rels push on `npm run dev`.
  - ✅ `npx tsc --noEmit` clean; **`npm run build` verified** (product pages still SSG; `/api/cart` dynamic). `grep localStorage` → only prose in comments; **zero real usage**.
- Deferred/next: cart re-validation banner when a line goes out of stock or price changes (server already clamps + re-resolves, just no explicit UI notice); newsletter; WhatsApp keys.

### Session 20 — 2026-07-04
Focus: **deferred-items sweep** (user picked "knock out the small deferred items" over deploying).
- **3.1 leftovers closed**: `contactEmail` → Resend `replyTo` on both order emails (added to `BrandCopy`, resolved in `resolveBrandCopy`, validated as email-ish) + mailto link in the footer brand column. `tagline` → appended to the homepage default/OG/Twitter title (`Store — tagline`, inner pages keep the `%s | Store` template) + homepage empty-state headline (`BlockRenderer` gained `emptyHeadline`; homepage passes `settings.tagline`). Admin field descriptions updated.
- **Cart-change notices** (the Session 19 deferred item): `serializeCart` now returns `{ items, notices, kept }` — structured `CartNotice`s (`removed` = product unpublished/deleted → line dropped, with title fetched without the status filter; `sold_out`; `reduced` with available count). `/api/cart` GET + mutations return `notices` and **prune dead lines** from the stored cart (so a `removed` notice shows once, not forever). `CartContext` exposes `notices`/`dismissNotices`; new `CartNotices` banner (dismissible, `role=status`) rendered in the drawer + cart page. Translated (`cart.notice*` in en/ar).
- **Decorative strings localized** (Session 18 leftovers): shop page (heading, `pieceCount` plural, search placeholder/button, sort labels via `labelKey`, All chip, empty states, Clear filters, pagination buttons — also `mr-1`→`me-1` RTL fix), track page + TrackForm, artist page (breadcrumb, no-photo, browse-all CTA, pieces heading), frontend 404 + error boundary, layout skip-link (key existed, was hardcoded). New `shop`/`artist`/`track`/`errors` namespaces in `messages/{en,ar}.json`.
- **4.2 SOLVED — payload-types.ts generated + the CLI/Node blocker eliminated for good**:
  - Machine now runs Node 24 LTS, but the Payload CLI *still* failed: pinned tsx 4.21 can't resolve the config's extensionless imports (fixed by npm `overrides: { tsx: 4.23.0 }`), and even then the CLI's `?namespace=` cache-busted import trips ERR_MODULE_NOT_FOUND.
  - **Workaround that works everywhere**: `scripts/bundle-config.mjs` bundles `src/payload.config.ts` with esbuild (resolves extensionless imports + tsconfig paths; stubs `next/cache|headers|navigation|server` — irrelevant outside a Next server), imports the bundle natively, and fixes the `import.meta.url`-derived paths (`typescript.outputFile`). `scripts/generate-types.mjs` calls `generateTypes()` from `payload/node`; **`scripts/migrate.mjs` drives `payload.db.migrate()/createMigration()/migrateStatus()/migrateDown()/migrateFresh()`** — all `migrate:*` npm scripts now use it. `npm run migrate:status` verified working locally against the dev DB. **MIGRATIONS.md's "Node LTS only" warning is obsolete** (doc updated).
  - `src/payload-types.ts` (53 KB) committed; the module augmentation makes the Local API strictly typed — surfaced 16 latent errors, all fixed: `?? undefined` on nullable image URLs (shop/artist/product cards), `as unknown as` for `SiteSetting`→Record casts (orders route, Orders hook) and Lexical content casts (both page renderers), orders `customerId` → `Number(user.id)`, `mergeGuestCart` normalizes items via `mergeItems` (new `NormalizedItem` type, also used by `serializeCart.kept`), garment-type seeding passes `slug` explicitly, `MediaGridTile` casts `CollectionSlug`. Stale `.next/types` (pre-locale-move paths) deleted.
- **Media grid search + bulk delete** (Session 10 leftover): new `MediaGridClient.tsx` (client) owns the toolbar + grid — search box drives Payload's `?search=` list param (`listSearchableFields: ['alt','filename']` added to Media), Select mode overlays checkboxes on tiles (`pointer-events: none` on the inner tile so clicks toggle selection), Delete Selected calls `DELETE /api/media?where[id][in]=…` with `window.confirm` + Payload `toast`, then `router.refresh()`. Selection UI hidden inside pick-an-image drawers (`useListDrawerContext().isInDrawer`). `MediaGridView` (server) still does fetch/pagination/header.
- ✅ `npx tsc --noEmit` clean **with generated types**; `npm run build` verified passing.
- Next: **deploy** (DEPLOY.md — note the build command `npm run migrate && npm run build` now runs the script-based migrate, and the prod DB needs the MIGRATIONS.md baseline step), or remaining deferred: homepage-block/product-alt localization, localized order emails, wishlist page polish, recently-viewed, newsletter, WhatsApp keys, replacing leftover `AnyRecord` casts.

### Session 21 — 2026-07-06
Focus: **first Vercel deploy failed — diagnosed + fixed** (`Failed query: select … "prefix" … from "media"` while prerendering `/en/artist/gerar`).
- **Root cause — plugin-conditional schema drift**: the s3Storage plugin is `enabled` only when the S3 creds env vars are set, and an enabled plugin (with `prefix: 'media'` configured) adds a **`media.prefix` column** to the runtime schema. `.env.local` no longer contains the four S3 vars (they were there in Session 10; gone since) → local plugin disabled → local schema/DB have no `prefix` → dev + local builds fine. Vercel HAS the creds → schema expects `media.prefix` → the DB (shared Supabase project) lacked it → every media join crashed prerendering. This is the same column the Session 11 push dropped — that drop happened *because* the local plugin was disabled, not because of the plugin version (Session 11's note was wrong about the cause).
- **Fix (applied to the live DB)**: `ALTER TABLE media ADD COLUMN IF NOT EXISTS prefix varchar` + backfill `prefix='media'` for all 21 rows (verified — every media URL lives under `products/media/` in the bucket, so `'media'` is correct and no files were ever uploaded to local disk).
- **Verified**: reproduced Vercel's conditions locally (`npm run build` with dummy S3 creds so the plugin enables) — all 57 pages prerender, including `/en/artist/gerar`. Redeploy should pass.
- **Action for the user**: re-add the four S3 vars to `.env.local` (`SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `ACCESS_KEY_ID_SUPABASE`, `SECRET_ACCESS_KEY_SUPABASE` — same values as Vercel, from Supabase → Project Settings → Storage → S3) so local dev runs the same schema as prod and future uploads land in the bucket, not on disk. Gotcha documented in DEPLOY.md §8.
- **Deploy succeeded** after the fix — trackID.lb is live. 🎉
- **Roadmap decisions (owner, 2026-07-06)**: Phase A hardening (DB split, Resend domain) deliberately skipped for now; **online payments go LAST**; new headline feature: **AI Assistant** — an admin-facing business/KPI copilot + a customer-facing support chat, built on the Claude API (`claude-opus-4-8`, streaming + tool use over Payload's Local API). Full design written into **IMPROVEMENTS.md §8** (shared foundation → admin copilot → support chat; needs `ANTHROPIC_API_KEY`; degrades gracefully when unset; SiteSettings "Assistant" tab keeps it white-label). Next session: build §8.
