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
| Email | Resend | Order confirmation emails, simple API |
| WhatsApp | WhatsApp Cloud API (Meta) | Notify team on new order — free tier |
| Hosting | Vercel | Zero-config Next.js deployment, edge CDN |

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
All product images go through Cloudinary. `next/image` component used everywhere with explicit `width`/`height` and `sizes` to prevent layout shift and over-fetching.

### 6. No Client-Side Data Fetching on Load
Initial page renders are fully server-rendered. Client-side fetching only for interactive actions (add to cart, filter changes).

---

## Data Models

### Product
```
id, title, slug, description (rich text), price (USD), status (draft|published)
images[] → Cloudinary URLs
artist → relation to Artist
category → relation to Category
tags[] (e.g., "hand-painted", "hoodie", "limited")
stock_quantity
is_one_of_a_kind (boolean — for single unique pieces)
created_at, updated_at
```

### Artist
```
id, name, slug, bio, genre, photo → Cloudinary URL
```

### Category
```
id, name, slug (e.g., hoodies, tees, accessories)
```

### Order
```
id, order_number (human-readable, e.g., TRK-0042)
customer_name, customer_phone, customer_email
delivery_address (text), area (Lebanon area/city)
items[] → { product_id, quantity, price_at_purchase, title_at_purchase }
subtotal, delivery_fee, total
payment_method (cod | bank_transfer)
payment_status (pending | paid)
order_status (pending | confirmed | in_production | shipped | delivered | cancelled)
notes (customer notes)
created_at, updated_at
```

### CustomRequest
```
id, name, phone, email
description (what they want)
reference_artist, reference_song
garment_type (hoodie, tee, etc.)
status (new | reviewing | quoted | accepted | rejected)
created_at
```

### Page (CMS content)
```
id, title, slug, content (rich text blocks)
— used for About, Artist Stories, FAQ, etc.
```

### SiteSettings (Payload Global)
```
storeName, logoUrl, tagline
contactEmail, whatsappNumber
announcementEnabled, announcementText, announcementBgColor, announcementTextColor, announcementHref
footerTagline, footerNote, copyrightText ({year} placeholder), socialLinks[]
colorScheme (dark|light|warm|custom), customColors { bg, surface, border, foreground, muted, accent, accentHover, onAccent }
metaDescription, ogImage
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
- [x] ISR configured: homepage `revalidate=60`, catalog `revalidate=30`, product pages `revalidate=3600`
- [x] Cursor-based pagination in shop catalog (avoids offset slowdown at scale)
- [x] `next/image` with Cloudinary remote pattern + AVIF/WebP formats enabled
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

### Phase 9 — Extended Page Builder (PLANNED)
Add same blocks field to Pages collection so CMS pages (`/p/[slug]`) support full layout sections, not just richText.

### Phase 10 — Translation / i18n (OPTIONAL — post-launch)
- Payload built-in localization: `locales: ['en', 'ar']`, all text fields `localized: true`
- `next-intl` for static UI strings
- RTL support via `dir` attribute on `<html>`
- URL structure: `/ar/shop` vs `/shop`

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
- **Notifications are fire-and-forget** — email/WhatsApp calls are `void`-ed after order creation so a notification failure never blocks the order response.
- **Globals use `unstable_cache` (5 min TTL)** — SiteSettings and Navigation are fetched on every layout render but cached server-side. Changes propagate within 5 minutes without a redeploy.
- **CSS vars injected at layout level** — Theme colors live in SiteSettings; the layout RSC builds a `:root{...}` string and injects it as an inline `<style>` tag. This overrides the Tailwind `@theme` defaults at runtime with zero client JS. Changing the color scheme in admin takes effect on next request after cache expiry.
- **Nav is client component, NavWrapper is server** — Nav needs `useCart` (client hook) but also needs nav links from DB. Pattern: server NavWrapper fetches data and passes as props to the client Nav.
- **Fallback defaults on all globals** — if Navigation/SiteSettings global has no data yet (fresh install), every component falls back to sensible hardcoded defaults so nothing breaks.

---

## Folder Structure

```
trackid-lb/
├── src/
│   ├── app/
│   │   ├── (frontend)/          # storefront routes
│   │   │   ├── layout.tsx       # async — injects CSS vars, generates metadata from DB
│   │   │   ├── globals.css      # Tailwind v4 @theme defaults (overridden at runtime by layout)
│   │   │   ├── page.tsx         # homepage
│   │   │   ├── shop/            # catalog
│   │   │   ├── product/[slug]/  # product detail (ISR)
│   │   │   ├── artist/[slug]/   # artist profile (ISR)
│   │   │   ├── p/[slug]/        # generic CMS page renderer
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   ├── custom-request/
│   │   │   └── order/[id]/      # order confirmation
│   │   └── (payload)/           # Payload admin routes (auto-generated)
│   ├── collections/             # Payload collection definitions
│   │   ├── Products.ts
│   │   ├── Artists.ts
│   │   ├── Categories.ts
│   │   ├── Orders.ts
│   │   ├── CustomRequests.ts
│   │   └── Pages.ts
│   ├── globals/                 # Payload Global definitions
│   │   ├── SiteSettings.ts      # brand, announcement bar, footer, theme, SEO
│   │   └── Navigation.ts        # header links + footer columns
│   ├── components/
│   │   ├── nav/
│   │   │   ├── Nav.tsx          # client component (cart badge) — accepts storeName + links props
│   │   │   ├── NavWrapper.tsx   # server wrapper — fetches globals, passes to Nav
│   │   │   └── Footer.tsx       # server component — driven by Navigation + SiteSettings globals
│   │   ├── AnnouncementBar.tsx  # server component — toggleable from SiteSettings
│   │   ├── cart/
│   │   ├── product/
│   │   └── ui/
│   │       ├── Button.tsx       # polymorphic button/link component
│   │       └── FormField.tsx    # shared form field components
│   ├── payload.config.ts        # Payload root config
│   └── lib/
│       ├── payload.ts           # Payload local API client (singleton)
│       ├── site-settings.ts     # getSiteSettings, getNavigation, buildThemeCssVars, COLOR_SCHEMES
│       ├── notifications.ts     # Resend email + WhatsApp Cloud API
│       └── utils.ts
├── CLAUDE.md                    # this file
└── .env.local
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
