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
- [ ] PostgreSQL connected (Supabase) — needs `.env.local` setup by developer

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

### Phase 3 — Notifications
- [ ] Resend email on order placed (customer confirmation)
- [ ] WhatsApp Cloud API message to team on new order

### Phase 4 — Content
- [ ] Custom Request form page
- [ ] About / Artist Story pages (powered by Payload Pages collection)
- [ ] Drop/Lookbook pages (for collection launches)

### Phase 5 — Polish
- [ ] Full design system (typography, colors, spacing)
- [ ] Mobile-first responsive layout
- [ ] Instagram feed embed
- [ ] SEO metadata (per product, per artist)
- [ ] Sitemap + robots.txt

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
- **Cloudinary not Payload media storage** — offloads image serving to CDN, keeps DB lean.

---

## Folder Structure (once scaffolded)

```
trackid-lb/
├── src/
│   ├── app/
│   │   ├── (frontend)/          # storefront routes
│   │   │   ├── page.tsx         # homepage
│   │   │   ├── shop/            # catalog
│   │   │   ├── product/[slug]/  # product detail (ISR)
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   └── order/[id]/      # order confirmation
│   │   └── (payload)/           # Payload admin routes (auto-generated)
│   ├── collections/             # Payload collection definitions
│   │   ├── Products.ts
│   │   ├── Artists.ts
│   │   ├── Categories.ts
│   │   ├── Orders.ts
│   │   ├── CustomRequests.ts
│   │   └── Pages.ts
│   ├── payload.config.ts        # Payload root config
│   └── lib/
│       ├── payload.ts           # Payload local API client (singleton)
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
