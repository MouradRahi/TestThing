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

### E2 ☑ DONE (Session 29) 🟢 Free-delivery progress nudge
Settings already hold `freeDeliveryThreshold` + zones. In the drawer and cart page show: "You're $12 away from free delivery" with a thin progress bar; switches to "✓ Free delivery unlocked" past the threshold. Classic AOV lever, zero schema change.
- Data path: thread `freeDeliveryThreshold` from the layout (already fetches settings) into `CartProvider` alongside `emptyCartMessage`.
- Files: `(frontend)/layout.tsx`, `CartContext.tsx`, `CartDrawer.tsx`, `cart/page.tsx`, `messages/{en,ar}.json`.

### E3 ☐ 🟡 Checkout form hardening & polish (IMPROVEMENTS 2.5 leftover)
- Per-field server-side validation errors: orders API returns `{ errors: { field: message } }` on 400; form highlights the exact field (today: one generic red line)
- Render `CartNotices` on the checkout page too (today: drawer + cart only — a reduced/sold-out line is invisible at the very place it matters)
- "Save this address to my account" checkbox for logged-in customers (POSTs to the existing profile route after order success)
- Submit button disabled until required fields valid; scroll-to-first-error
- Files: `api/orders/route.ts`, `CheckoutForm.tsx`, `api/account/profile/route.ts` reuse.

### E4 ☑ DONE (Session 29) 🟢 Toast/feedback channel for cart + wishlist actions
Small dependency-free toast (aria-live polite, auto-dismiss, theme-colored) used by: add-to-cart failures (bug B6), wishlist saved/removed, profile saved. One component, mounted in the frontend layout.
- Files: new `src/components/ui/Toast.tsx` (+ context), consumers above.

---

## B. Product & Discovery UX

### E5 ☑ DONE (Session 29) 🟡 Product page content upgrades
- ☑ Render the per-product rich-text `description` (bug B2 — done Session 22)
- **Size guide**: optional CMS page slug in SiteSettings (`sizeGuidePage`); when set and the product has sizes, "Size guide" link opens it (modal or new tab)
- **Delivery & returns accordion**: localized SiteSettings copy fields (`deliveryInfo`, `returnsInfo`) rendered as collapsible sections under the buy box — answers the two questions every COD customer asks
- **Share**: copy-link + WhatsApp share button (the audience lives on WhatsApp; `wa.me/?text=` needs no SDK)
- **Image lightbox/zoom**: click main image → full-screen overlay with pinch/scroll zoom; hand-painted detail is the product — let people see brushstrokes. Dependency-free (CSS transform + pointer events)
- Files: `product/[slug]/page.tsx`, `ProductGallery.tsx`, `src/globals/SiteSettings.ts` (Copy/Commerce tabs), new `ShareButton.tsx`, `messages/*`.

### E6 ☑ DONE (Session 29) 🟡 Shop filtering that scales (IMPROVEMENTS 2.7 leftover + gaps)
- **Garment-type filter** — the data model has `garmentType` (Session 10) but the shop offers no way to filter by it. Add alongside category chips
- Artist wall-of-chips → searchable `<select>`/combobox once artists > ~10 (progressive: chips under the limit, dropdown over)
- **In-stock only** toggle (`totalStock > 0` needs a where on sizes/stockQuantity — compute simplest server-side variant: `stockQuantity > 0 OR sizes.stockQuantity > 0`)
- Price range: two presets ("Under $X" bands from settings or fixed) rather than a slider — RSC-friendly, zero JS
- Active filters row with × remove chips; ☑ real total count via `totalDocs` (bug B23 — done Session 22)
- Files: `shop/page.tsx`, `messages/*`.

### E7 ☑ DONE (Session 29) 🟢 Global search entry point in the nav
Search only exists buried on /shop. Add a search icon in the nav (desktop + mobile) opening a minimal overlay with one input that submits to `/shop?q=` (locale-aware — bug B8's helper). Zero new backend.
- Files: `Nav.tsx`, small `SearchOverlay.tsx` client component, `messages/*`.

### E8 ☑ DONE 🟢 Breadcrumbs + structured data (done as part of ROADMAP Part 7, Session 28)
- ☑ Product page breadcrumb grows a Category link (`Shop / Hoodies / Piece`)
- ☑ `BreadcrumbList` JSON-LD on product/artist/bundle/blog-post pages; `Organization` +
  `WebSite` (with `potentialAction` SearchAction) JSON-LD site-wide in the layout — all
  reads existing settings (storeName, logoUrl, social links)
- Files: `src/lib/structured-data.ts` (new), `product/[slug]/page.tsx`, `artist/[slug]/
  page.tsx`, `bundle/[slug]/page.tsx`, `blog/[slug]/page.tsx`, `(frontend)/layout.tsx`.

### E9 ☑ DONE (Session 29) 🟡 Recently-viewed strip (no localStorage — mandate)
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

### E11 ☑ DONE (Session 29) 🟢 Order status timeline
The order page prints the status as a word. Render the pipeline (Pending → Confirmed → In production → Shipped → Delivered) as a stepper with the current stage highlighted; cancelled renders distinctly. Pure UI over existing data — pairs with bug B3 (page must be dynamic first, or the timeline lies).
- Files: `order/[orderNumber]/page.tsx`, `messages/*`.

### E12 ☑ DONE (Session 29) 🟡 Localized + brand-complete transactional emails (Session 18/11 leftovers)
- Order confirmation + status emails: Arabic variants (pick language by the storefront locale at checkout — store `locale` on the order, 1 new field)
- The 5 `STATUS_EMAIL_COPY` lines move to the Copy tab (localized)
- Email header uses the logo when set (3.1 leftover noted in IMPROVEMENTS)
- Files: `notifications.ts`, `Orders.ts` (locale field — ⚠️ additive migration), `SiteSettings.ts`, `api/orders/route.ts`.

---

## D. i18n / SEO / A11y / Perf polish

### E13 ☑ DONE 🟡 SEO/i18n correctness batch (companions to bugs B9/B10/B16)
- ☑ hreflang `alternates.languages` + locale-aware canonicals everywhere (B9) — Session 22, part 11
- ☑ Localized product meta pattern via Copy tab (B10) — Session 22, part 11
- ☑ Arabic-capable font option + `preload: false` on unused fonts (B20) — Session 22, part 13
- ☑ Homepage-block text + product-image alt localization (Session 18 deferred) — Session 27
  part 6. `localized: true` added to `products.images[].alt` and the copy fields on all 7
  homepage/page section blocks (hero, slideshow slides, featured-products, image-text,
  statement, rich-text, cta-banner) — hrefs/colors/selects stay unlocalized. Hand-written,
  data-preserving migration (`20260810_120000_localize_blocks_and_image_alt.ts`, following
  MIGRATIONS.md's recipe exactly — create `_locales` table, copy existing values into `en`
  *before* dropping the old column) covers both `homepage_blocks_*` and `pages_blocks_*`
  (Pages shares the identical block configs, so needs the identical treatment). De-risked
  by checking first: `Navigation.ts`'s `headerLinks[].label`/`footerColumns[].links[].label`
  already prove arrays (even nested two levels deep) with localized sub-fields work
  correctly in this exact codebase since Session 18 — the same "uncertain nested shape"
  concern that led Session 27 part 4 to defer `products.specs[]` localization didn't apply
  here. No storefront component code changes needed — locale was already threaded through
  every block-rendering query. Verified against the real dev DB: post-migration row counts
  match pre-migration counts exactly, and every existing English value landed correctly in
  the `en` locale (spot-checked `homepage_blocks_hero_locales`, `_statement_locales`,
  `products_images_locales`); full production build prerenders `/en` and `/ar` clean.
- Files: `Products.ts`, `src/globals/blocks/*.ts`, new migration.

### E14 ☑ DONE 🟢 A11y batch (companions to bugs B17/B18)
- ☑ Focus trap in drawer (new `useFocusTrap` hook) + mobile menu Esc-to-close with focus return (B17) — Session 22, part 13
- ☑ `prefers-reduced-motion` respected — slideshow autoplay (new `useReducedMotion` hook) + a global CSS rule killing transitions/animations/smooth-scroll site-wide (B18) — Session 22, part 13
- ☑ Form errors get `role="alert"` (implicit `aria-live="assertive"`) — Session 27 part 6.
  Added to `FormField.tsx`'s shared `FieldError` (covers every field-level error site for
  free) plus every standalone top-level error banner across the customer-facing forms
  (AuthForm, ChangePasswordForm, ForgotPasswordForm, ProfileForm, ResetPasswordForm,
  ReturnRequestForm, CheckoutForm — both the general error banner and the discount-code
  message, CustomRequestForm, AddToCart's size-required note, NotifyMeForm, WriteReviewForm).
- ☑ Announcement-bar contrast — Session 27 part 6. New `src/lib/contrast.ts`
  (`contrastRatio`/`ensureReadableTextColor`, pure WCAG 2.x luminance math, 9 unit tests) —
  `AnnouncementBar.tsx` now auto-flips the admin-picked text color to black/white
  (whichever contrasts better) whenever the admin's own bg/text pick falls below the 4.5:1
  WCAG AA threshold, rather than trusting the admin to check by eye. Field description
  updated to document the behavior so it doesn't look broken/ignored from the admin side.
- Files: `src/lib/useFocusTrap.ts`, `src/lib/useReducedMotion.ts`, `CartDrawer.tsx`, `Nav.tsx`,
  `SlideshowSection.tsx`, `globals.css`, `FormField.tsx`, `AnnouncementBar.tsx`,
  `src/lib/contrast.ts` (new) + `contrast.test.ts` (new), `SiteSettings.ts`, and every
  customer-facing form component listed above.

---

## E. Features (new, necessary — still no AI, no payments)

### F1 ☑ DONE (Session 28, ROADMAP Part 7) 🟡 Newsletter / drop-list capture (IMPROVEMENTS P5 leftover)
Email capture block (footer + homepage/page block) → `POST /api/newsletter` (rate-limited, honeypot) → Resend segment. Plus an admin drop-announcement broadcast panel. Doc had gone stale — this was built as part of the F7 growth-marketing session, checkboxes just never got flipped here.

### F2 ◐ 🟡 Admin order ergonomics (IMPROVEMENTS 4.5 leftover)
- ☐ Orders list: `useAsTitle` virtual-ish title (hook-maintained `adminTitle` field: `TRK-1234 · Name · $86 COD`), default columns tuned, status filter presets — still genuinely open
- ☑ **Packing slip / order print view** — DONE (Session 27, part 2): `GET /api/admin/packing-slips`, admin-gated, linked from the Sales Overview panel
- ☑ **CSV export of orders** — DONE (Session 24, part 1, F2 reconciliation work): `GET /api/admin/payments/export` covers every order's money fields incl. COD/bank-transfer; the report engine (Session 25) also exports orders as CSV/XLSX/PDF
- Only the orders-list ergonomics sub-item remains; small enough to fold into a future admin-polish pass.

### F3 ☑ DONE (bug B4, Session 22 part 5 + B14, Session 22 part 6) 🟢 Cart lifecycle ops (companion to bug B4)
Rate limit + abandoned-guest-cart cleanup cron both shipped as part of the B4 fix; the discounts `usageLimit` atomic race (B14) was closed the same week. Doc had gone stale.

### F4 ☑ DONE (Session 26, part 2) 🟢 Weekly owner email summary (deferred from 4.6)
Built as ROADMAP Part 4 §4.2 (scheduled reports) — a SiteSettings "Reports" tab controls cadence/recipients/which report types, `GET /api/cron/scheduled-reports` sends a CSV-attached digest. Doc had gone stale.

### F5 ☐ 🔴 Page versions + live preview (IMPROVEMENTS 4.3 deferred — needs owner buy-in)
`versions: { drafts: true }` on Pages/Homepage + Payload Live Preview iframe. ⚠️ Requires the one-time force-publish migration for existing pages (the reason it was deferred). Only schedule when the owner actually asks for undo/history. Still genuinely open — see NEXT_STEPS.md.

### F6 ◐ ⏸ Ops activations (no code, keys only — surface to owner)
- ◐ WhatsApp Cloud API keys — **in progress (Session 29)**: real credentials obtained and
  wired in; two message templates (staff alert, customer confirmation) submitted to Meta for
  approval, not yet live. Along the way, a real bug was found and fixed: the staff alert sent
  plain free-text, which WhatsApp's 24h "customer service window" policy rejects for any
  recipient who hasn't messaged the business first (confirmed via the real delivery webhook,
  error 131047) — converted to an approved-template send.
- ☐ Instagram embed (blocked on the handle)
- ☐ `SEED_SECRET` should NOT be set in prod Vercel env unless seeding is intended

### F7 ☑ DONE (ROADMAP F0 §1.3, Session 22 part 10) 🟢 Durable rate limiting (only if abuse appears)
Built as a Postgres-backed fixed-window counter (`src/lib/durable-rate-limit.ts`) rather than
Upstash/Vercel KV — solves the same cross-instance problem using infrastructure every instance
already shares, no new external service needed. All 11 rate-limit call sites use it; the old
in-memory map is now only a same-file fallback if the DB pool is unreachable. Doc had gone stale.

---

## Suggested Execution Order (work top-down)

| # | Session theme | Contents | Why this order |
|---|---|---|---|
| 1 | **Correctness sweep** ☑ DONE (Session 22) | BUGS B2, B3, B5, B6, B7, B8, B11, B13, B15, B16 (◐), B23 | All small, all user-visible wrongness on the live site; zero schema changes |
| 2 | **Account rescue** ◐ (B1 done, Session 22 part 4) | ☑ B1 forgot/reset/change password · ☑ B22 done (part 13) · remaining: `?next=` redirect (E10 phase 2) | P0 — real customers are creating accounts on the live site *now*; every day without reset = support debt |
| 3 | **Cart/checkout conversion** ◐ (E1/E2/E4/F3 done) | ☑ E1, ☑ E2 (Session 29), ☑ E4 (Session 29), ☐ E3 remaining; F3 hardening ☑ done (B4 Session 22 part 5, B12 Session 22 part 11, B14 Session 22 part 6) | The money path; toast (E4) unblocks proper B6 fix |
| 4 | **Discovery** ☑ DONE (Session 29 + Session 28) | E5 ☑, E6 ☑, E7 ☑ (all Session 29), E8 ☑ (Session 28) | Catalog is growing; product storytelling is the brand |
| 5 | **Order experience** ☑ DONE (Session 29) | E11 ☑, B3 ☑ (verified earlier), E12 ☑ (adds `locale` field — migration applied) | Post-purchase trust; groundwork for repeat customers |
| 6 | **SEO/i18n batch** ☑ DONE (Session 27 part 6) | E13 ☑ (B9, B10, B20, homepage-block/alt localization all done) | Arabic side is currently invisible to Google — fix before content marketing starts |
| 7 | **A11y batch** ☑ DONE (Session 27 part 6) | E14 ☑ (B17, B18, B19, B21, form-error `role="alert"`, announcement-bar contrast all done) | Bundled — cheap together, disruptive apart |
| 8 | **Growth & admin** ◐ (F1/F4/E9 done, F2 partial) | ☑ F1 newsletter (Session 28), ◐ F2 admin ergonomics (packing slip + CSV done, orders-list title/filters remaining), ☑ F4 weekly summary (Session 26), ☑ E9 recently-viewed (Session 29) | Post-stabilization leverage |
| — | *Parked* | F5 versions/preview (still parked, needs owner buy-in), ~~F7 KV rate-limit~~ ☑ done via Postgres not KV (Session 22 part 10), F6 keys ◐ (WhatsApp in progress Session 29, Instagram still blocked on handle) | Trigger-based, not scheduled |

**Standing rules for every session** (from CLAUDE.md/MIGRATIONS.md):
- Schema changes → dev push locally, but prod is migration-only (`npm run migrate:create`, commit `src/migrations/`)
- `npx tsc --noEmit` + `npm run build` before calling anything done; update BUGS.md/ENHANCEMENTS.md checkboxes + CLAUDE.md session log
- Everything stays white-label (new copy → Copy tab, localized) and localized (en/ar + RTL logical properties)
- No localStorage, ever (accounts/cookies instead) · never trust client-supplied money values
