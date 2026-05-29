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
