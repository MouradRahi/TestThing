# trackID.lb — Enhancements Tracker & Implementation Plan

> Created 2026-07-11 (Session 22). Companion to **BUGS.md** (defects) — this file is *improvements*: UI/UX upgrades and new features the store needs.
> **Explicitly excluded for now (owner directive)**: the AI Assistant (IMPROVEMENTS.md §8) and any online payment gateway. Do not pick those up from here.
>
> Status legend: ☐ todo · ☑ done (note the session) · ◐ partial
> Effort: 🟢 small (≤half session) · 🟡 medium (~1 session) · 🔴 large (multi-session)

---

## A. Cart & Checkout UX (the conversion path)

### E1 ☑ DONE (Session 22) — Cart loading state + skeletons
Companion to bug B5. `CartContext` gained `isLoading`; drawer shows a loading line, cart page + checkout render skeletons until the server cart resolves.
- Files: `CartContext.tsx`, `CartDrawer.tsx`, `cart/page.tsx`, `CheckoutForm.tsx`.

### E2 ☐ 🟢 Free-delivery progress nudge
Settings already hold `freeDeliveryThreshold` + zones. In the drawer and cart page show: "You're $12 away from free delivery" with a thin progress bar; switches to "✓ Free delivery unlocked" past the threshold. Classic AOV lever, zero schema change.
- Data path: thread `freeDeliveryThreshold` from the layout (already fetches settings) into `CartProvider` alongside `emptyCartMessage`.
- Files: `(frontend)/layout.tsx`, `CartContext.tsx`, `CartDrawer.tsx`, `cart/page.tsx`, `messages/{en,ar}.json`.

### E3 ☐ 🟡 Checkout form hardening & polish (IMPROVEMENTS 2.5 leftover)
- Per-field server-side validation errors: orders API returns `{ errors: { field: message } }` on 400; form highlights the exact field (today: one generic red line)
- Render `CartNotices` on the checkout page too (today: drawer + cart only — a reduced/sold-out line is invisible at the very place it matters)
- "Save this address to my account" checkbox for logged-in customers (POSTs to the existing profile route after order success)
- Submit button disabled until required fields valid; scroll-to-first-error
- Files: `api/orders/route.ts`, `CheckoutForm.tsx`, `api/account/profile/route.ts` reuse.

### E4 ☐ 🟢 Toast/feedback channel for cart + wishlist actions
Small dependency-free toast (aria-live polite, auto-dismiss, theme-colored) used by: add-to-cart failures (bug B6), wishlist saved/removed, profile saved. One component, mounted in the frontend layout.
- Files: new `src/components/ui/Toast.tsx` (+ context), consumers above.

---

## B. Product & Discovery UX

### E5 ☐ 🟡 Product page content upgrades
- ☑ Render the per-product rich-text `description` (bug B2 — done Session 22)
- **Size guide**: optional CMS page slug in SiteSettings (`sizeGuidePage`); when set and the product has sizes, "Size guide" link opens it (modal or new tab)
- **Delivery & returns accordion**: localized SiteSettings copy fields (`deliveryInfo`, `returnsInfo`) rendered as collapsible sections under the buy box — answers the two questions every COD customer asks
- **Share**: copy-link + WhatsApp share button (the audience lives on WhatsApp; `wa.me/?text=` needs no SDK)
- **Image lightbox/zoom**: click main image → full-screen overlay with pinch/scroll zoom; hand-painted detail is the product — let people see brushstrokes. Dependency-free (CSS transform + pointer events)
- Files: `product/[slug]/page.tsx`, `ProductGallery.tsx`, `src/globals/SiteSettings.ts` (Copy/Commerce tabs), new `ShareButton.tsx`, `messages/*`.

### E6 ☐ 🟡 Shop filtering that scales (IMPROVEMENTS 2.7 leftover + gaps)
- **Garment-type filter** — the data model has `garmentType` (Session 10) but the shop offers no way to filter by it. Add alongside category chips
- Artist wall-of-chips → searchable `<select>`/combobox once artists > ~10 (progressive: chips under the limit, dropdown over)
- **In-stock only** toggle (`totalStock > 0` needs a where on sizes/stockQuantity — compute simplest server-side variant: `stockQuantity > 0 OR sizes.stockQuantity > 0`)
- Price range: two presets ("Under $X" bands from settings or fixed) rather than a slider — RSC-friendly, zero JS
- Active filters row with × remove chips; ☑ real total count via `totalDocs` (bug B23 — done Session 22)
- Files: `shop/page.tsx`, `messages/*`.

### E7 ☐ 🟢 Global search entry point in the nav
Search only exists buried on /shop. Add a search icon in the nav (desktop + mobile) opening a minimal overlay with one input that submits to `/shop?q=` (locale-aware — bug B8's helper). Zero new backend.
- Files: `Nav.tsx`, small `SearchOverlay.tsx` client component, `messages/*`.

### E8 ☐ 🟢 Breadcrumbs + structured data
- Product page breadcrumb grows Category link (`Shop / Hoodies / Piece`); artist page already has one
- `BreadcrumbList` JSON-LD on product/artist; `Organization` + `WebSite` (with `potentialAction` SearchAction) JSON-LD in the layout — all reads existing settings
- Files: `product/[slug]/page.tsx`, `(frontend)/layout.tsx`.

### E9 ☐ 🟡 Recently-viewed strip (no localStorage — mandate)
Cookie-based: product page fires a tiny client effect → `POST /api/recently-viewed` appends the id to an httpOnly cookie (last 8 ids, no DB). Product page + cart empty state render the strip server-side from the cookie. Honors the "no localStorage, ever" rule without a schema change.
- Files: new `api/recently-viewed/route.ts`, small `RecentlyViewedTracker.tsx` (client, fire-and-forget), `RecentlyViewedStrip.tsx` (RSC), product page + cart page.

---

## C. Account & Order Experience

### E10 ◐ 🔴 Account hardening & completion (contains bug B1)
- ☑ **Forgot/reset password** (B1, Session 22 part 4) **+ change password** on the account page
- Login/register accept `?next=` and return the customer where they started (wishlist tap on a product → login → back on that product, saved)
- Nav shows the customer's name (or "Account") when logged in — needs a lightweight `GET /api/account/me` fetched client-side like WishlistButton does, so pages stay static
- Wishlist cards: price + sold-out badge + add-to-cart (today: image + title only — a wishlist you can't buy from)
- Account order rows link to a detail view — reuse the order page but, when the order belongs to the logged-in customer, show payment status + a "need help? WhatsApp us" CTA
- Optional later: email change (needs re-verification), account deletion request
- Files: `api/account/*`, `AuthForm.tsx`, `account/page.tsx`, `WishlistButton.tsx`, `Nav.tsx`, `notifications.ts`, `messages/*`.

### E11 ☐ 🟢 Order status timeline
The order page prints the status as a word. Render the pipeline (Pending → Confirmed → In production → Shipped → Delivered) as a stepper with the current stage highlighted; cancelled renders distinctly. Pure UI over existing data — pairs with bug B3 (page must be dynamic first, or the timeline lies).
- Files: `order/[orderNumber]/page.tsx`, `messages/*`.

### E12 ☐ 🟡 Localized + brand-complete transactional emails (Session 18/11 leftovers)
- Order confirmation + status emails: Arabic variants (pick language by the storefront locale at checkout — store `locale` on the order, 1 new field)
- The 5 `STATUS_EMAIL_COPY` lines move to the Copy tab (localized)
- Email header uses the logo when set (3.1 leftover noted in IMPROVEMENTS)
- Files: `notifications.ts`, `Orders.ts` (locale field — ⚠️ additive migration), `SiteSettings.ts`, `api/orders/route.ts`.

---

## D. i18n / SEO / A11y / Perf polish

### E13 ☐ 🟡 SEO/i18n correctness batch (companions to bugs B9/B10/B16)
- hreflang `alternates.languages` + locale-aware canonicals everywhere (B9)
- Localized product meta pattern via Copy tab (B10)
- Arabic-capable font option + `preload: false` on unused fonts (B20)
- Homepage-block text + product-image alt localization (Session 18 deferred)
- Files: all `generateMetadata` sites, `site-settings.ts`, `SiteSettings.ts`, block configs (`localized: true` on text fields — ⚠️ localize-migration rules apply, see MIGRATIONS.md).

### E14 ☐ 🟢 A11y batch (companions to bugs B17/B18)
- Focus trap in drawer + mobile menu, Esc closes menu
- `prefers-reduced-motion` respected (slideshow, smooth scroll)
- Form errors get `role="alert"`/`aria-live`
- Announcement-bar contrast: compute contrast of admin-picked colors in the AnnouncementBar RSC; below 4.5:1 → auto-flip text to black/white (kills the long-deferred "owner might pick unreadable colors" risk in code, not process)
- Files: `CartDrawer.tsx`, `Nav.tsx`, `SlideshowSection.tsx`, `globals.css`, `FormField.tsx`, `AnnouncementBar.tsx`.

---

## E. Features (new, necessary — still no AI, no payments)

### F1 ☐ 🟡 Newsletter / drop-list capture (IMPROVEMENTS P5 leftover)
Email capture block (footer + optional homepage block) → `POST /api/newsletter` (rate-limited, honeypot) → Resend Audiences (`RESEND_AUDIENCE_ID` env; degrade gracefully when unset — same pattern as WhatsApp). For a drop-based one-of-a-kind store, the announcement list IS the launch weapon.
- Files: new `api/newsletter/route.ts`, `NewsletterForm.tsx`, footer + new `newsletter` block, `SiteSettings.ts` toggle, `.env.local.example`.

### F2 ☐ 🟡 Admin order ergonomics (IMPROVEMENTS 4.5 leftover)
- Orders list: `useAsTitle` virtual-ish title (hook-maintained `adminTitle` field: `TRK-1234 · Name · $86 COD`), default columns tuned, status filter presets
- **Packing slip / order print view**: printable route (`/admin-print/order/[id]`, admin-cookie-gated) with items, address, phone, COD amount — the team prints or screenshots per delivery today
- CSV export of orders for a date range (route returning `text/csv`, admin-gated) — accountant-friendly
- Files: `Orders.ts`, new print route + small print CSS, new `api/admin/orders-export/route.ts`.

### F3 ☐ 🟢 Cart lifecycle ops (companion to bug B4)
Rate limit + abandoned-guest-cart cleanup (Vercel Cron → guarded route). Include the discounts `usageLimit` atomic fix (B14) in the same hardening pass.
- Files: `api/cart/route.ts`, new `api/cron/cleanup/route.ts`, `vercel.json`, `api/orders/route.ts`.

### F4 ☐ 🟢 Weekly owner email summary (deferred from 4.6)
Vercel Cron (weekly) → guarded route reusing the SalesDashboard aggregation (extract to `src/lib/analytics.ts`) → Resend email: revenue vs last week, orders, top pieces, low stock, pending custom requests. No admin login needed to feel the pulse.
- Files: extract `lib/analytics.ts` from `SalesDashboard.tsx`, new `api/cron/weekly-summary/route.ts`, `vercel.json`.

### F5 ☐ 🔴 Page versions + live preview (IMPROVEMENTS 4.3 deferred — needs owner buy-in)
`versions: { drafts: true }` on Pages/Homepage + Payload Live Preview iframe. ⚠️ Requires the one-time force-publish migration for existing pages (the reason it was deferred). Only schedule when the owner actually asks for undo/history.

### F6 ☐ ⏸ Ops activations (no code, keys only — surface to owner)
- WhatsApp Cloud API keys (order alerts — code ships dark since Session 3)
- Instagram embed (blocked on the handle)
- `SEED_SECRET` should NOT be set in prod Vercel env unless seeding is intended

### F7 ☐ 🟢 Durable rate limiting (only if abuse appears)
Upstash Redis / Vercel KV behind the existing `rateLimit()` signature (in-memory fallback when env unset). Parked: current in-memory guard is accepted risk (B24).

---

## Suggested Execution Order (work top-down)

| # | Session theme | Contents | Why this order |
|---|---|---|---|
| 1 | **Correctness sweep** ☑ DONE (Session 22) | BUGS B2, B3, B5, B6, B7, B8, B11, B13, B15, B16 (◐), B23 | All small, all user-visible wrongness on the live site; zero schema changes |
| 2 | **Account rescue** ◐ (B1 done, Session 22 part 4) | ☑ B1 forgot/reset/change password · remaining: B22, `?next=` redirect (E10 phase 2) | P0 — real customers are creating accounts on the live site *now*; every day without reset = support debt |
| 3 | **Cart/checkout conversion** | E1, E2, E4, E3; F3 hardening (☑ B4 done Session 22 part 5, B12, ☑ B14 done Session 22 part 6) | The money path; toast (E4) unblocks proper B6 fix |
| 4 | **Discovery** | E5 (description first), E6, E7, E8 | Catalog is growing; product storytelling is the brand |
| 5 | **Order experience** | E11, B3 verify, E12 (adds `locale` field — migration) | Post-purchase trust; groundwork for repeat customers |
| 6 | **SEO/i18n batch** | E13 (B9, B10, B20), sitemap sanity pass | Arabic side is currently invisible to Google — fix before content marketing starts |
| 7 | **A11y batch** | E14 (B17, B18, B19, B21) | Bundled — cheap together, disruptive apart |
| 8 | **Growth & admin** | F1 newsletter, F2 admin ergonomics, F4 weekly summary, E9 recently-viewed | Post-stabilization leverage |
| — | *Parked* | F5 versions/preview, F7 KV rate-limit, F6 keys | Trigger-based, not scheduled |

**Standing rules for every session** (from CLAUDE.md/MIGRATIONS.md):
- Schema changes → dev push locally, but prod is migration-only (`npm run migrate:create`, commit `src/migrations/`)
- `npx tsc --noEmit` + `npm run build` before calling anything done; update BUGS.md/ENHANCEMENTS.md checkboxes + CLAUDE.md session log
- Everything stays white-label (new copy → Copy tab, localized) and localized (en/ar + RTL logical properties)
- No localStorage, ever (accounts/cookies instead) · never trust client-supplied money values
