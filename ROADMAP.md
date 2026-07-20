# trackID.lb Platform — "Final Boss" Roadmap (v2)

> Created Session 21 (2026-07-03). This supersedes IMPROVEMENTS.md as the forward roadmap —
> IMPROVEMENTS.md stays as the historical audit record; everything still open there is
> folded into Part 0 below.
>
> **The goal**: elevate the current launch-ready e-commerce app into a complete,
> Lebanon-tailored commerce platform that can be sold to any brand — payments
> (Visa/Mastercard, OMT), report generation with printable PDFs, and every capability
> a business could reasonably require. *(Session 22: Whish + AI assistants skipped
> by user decision; generic-taxonomy work added to Part 8.)*
>
> Status legend: ☐ todo · ☑ done · ◐ partial

---

## Vision & positioning

**Product**: a white-label e-commerce platform tailored to the Lebanese market —
online payments that actually work in Lebanon (wallets + cards + cash networks + COD),
Arabic/English with RTL, delivery-zone logistics, and a fully CMS-driven brand identity.
Sold per-client (each brand gets its own deploy + database), with a possible SaaS
multi-tenant evolution later.

**What already sets it apart** (built, Sessions 1–20): full white-label theming/copy/nav
from admin, block-based page builder, server-authoritative commerce (prices, stock,
discounts, delivery fees), per-size atomic inventory, customer accounts + server-backed
carts, en/ar localization with RTL, sales dashboard, media library, SEO plumbing,
transactional email.

**What "final boss" adds** (this roadmap): real payment rails, accounting-grade
reporting, AI assistance on both sides of the counter, returns/reviews/gift-cards
commerce depth, fulfillment operations, and the productization work that makes the
software sellable and supportable.

---

## Part 0 — Current-state leftovers (carried from IMPROVEMENTS.md)

Small items still open from the previous roadmap. None block new work; fold them into
adjacent phases as we go.

- ◐ **Baseline migration** — DONE on dev (Session 22): `src/migrations/20260720_055440_baseline.ts` created + marked applied via `npm run migrate:local -- mark`. **Remaining: run the one-line `payload_migrations` INSERT on prod** (SQL in MIGRATIONS.md §Baselining) **before the next deploy**.
- ☑ **4.2 `payload-types.ts` generation** — DONE (Session 22): `npm run generate:types` (programmatic runner sidesteps the broken CLI); generated types adopted, all strict-type errors fixed, tsc clean
- ☐ **i18n leftovers** — homepage-block text localization, product image `alt` localization, decorative shop strings, localized order emails
- ☐ **4.3 deferred** — Payload versions/rollback + live-preview iframe for Pages/Homepage
- ☐ **Weekly email summary** for the sales dashboard (needs Vercel Cron — lands naturally with Part 4 reports)
- ☐ **Recently-viewed strip** — server-backed design (no localStorage per mandate); fold into customer-account phase polish
- ☐ **2.7 artist filter chips → dropdown/combobox** at scale (~15+ artists)
- ☐ **Announcement-bar contrast check** on admin-set colors
- ☐ **WhatsApp activation** — code ready, needs Meta keys (blocked on business verification)
- ☐ **Instagram embed** — blocked on brand handle

---

## Part 1 — Foundation hardening (prerequisite for money)

You cannot run online payments on the current operational setup. These are not
nice-to-haves — a payment dispute with no audit trail, or a webhook lost to an
in-memory queue, is real money lost.

### 1.1 Split dev/prod databases ⚠️ do this first — ☑ DONE (Session 21)
- ☑ New disposable Supabase project for dev (`lsrmtpazcdksdllfrsqw`, ap-southeast-2); `.env.local` fully repointed (DB + storage + S3 keys), `PAYLOAD_PUSH=true` set
- ☑ Schema pushed (62 tables) + demo catalog seeded; placeholder URLs fixed to `.png` (next/image blocks SVG); `EAI_AGAIN` DNS flake fixed via `dns.setDefaultResultOrder('ipv4first')` in next.config.ts
- ☑ Prod stays on the original project, migration-only
- ☐ Leftover: create the `products` bucket (**Public**) in the dev project — admin image uploads fail until then

### 1.2 Migration discipline
- ◐ Baseline migration created + marked applied — dev ☑ (Session 22); prod needs the one-line INSERT (MIGRATIONS.md §Baselining) before next deploy
- ☐ Every schema change in this roadmap ships as a reviewed migration file

### 1.3 Durable rate limiting + idempotency
- ☐ Replace the in-memory sliding-window limiter (`api-guards.ts`) with Upstash Redis (or Vercel KV) — the in-memory one resets per serverless instance, useless against a real attack and dangerous around payment endpoints
- ☐ Idempotency-key support on `POST /api/orders` and all payment endpoints (client sends a UUID; duplicate submissions return the original result instead of double-charging/double-decrementing)

### 1.4 Observability
- ☐ Sentry (or equivalent) for server + client error tracking — payment failures must be *seen*, not just logged to a dead console
- ☐ Structured logging on all payment/webhook paths (who, what, provider ref, amount)

### 1.5 Audit log
- ☐ `AuditLog` collection: admin actions on Orders (status changes, refunds), Discounts, SiteSettings — who changed what, when, from/to. Payload `afterChange` hooks. Required for dispute resolution and multi-staff stores.

### 1.6 Admin account security
- ☐ 2FA for admin users (TOTP — Payload supports custom auth strategies) or at minimum enforced strong passwords + login-attempt lockout
- ☐ Role review: granular gates on Products/Pages/Settings (the 1.11 leftover)

### 1.7 Automated test safety-net
- ☐ Playwright smoke suite: browse → add to cart → checkout (COD) → order appears in admin. Runs in CI before deploy.
- ☐ Unit tests for money math: discounts, delivery fees, totals, stock decrement/restock
- Why: a sellable product cannot regress checkout with every feature added; payments make this mandatory

---

## Part 2 — Payments (Lebanon) 🇱🇧 ⚠️ the centerpiece

COD + bank transfer stay. We add: **Visa/Mastercard** (card gateway) and **OMT**
(wallet + pay-cash-at-branch). All behind one abstraction so a brand can toggle
providers from admin, and new providers (Areeba, NetCommerce, MyMonty, Suyool…) are
an adapter each, not a rewrite.

> ⏭ **Whish skipped** (user decision, Session 22) — the Whish wallet/gateway adapter
> is out of scope for now; the card rail goes through a dedicated acquirer (2.3).
> The abstraction keeps Whish addable later as just another adapter.

### 2.1 Payment abstraction layer (build first, provider-agnostic)
- ☐ `src/lib/payments/types.ts` — `PaymentProvider` interface:
  - `initiate(order, opts) → { kind: 'redirect', url } | { kind: 'voucher', code, instructions }`
  - `handleWebhook(req) → PaymentEvent` (signature-verified)
  - `verify(providerRef) → PaymentStatus` (server-to-server poll — never trust the browser redirect)
  - `refund(payment, amount) → RefundResult` (where supported)
- ☐ `Payments` collection: order relation, provider, providerRef, amount, currency,
  status (`initiated | pending | paid | failed | expired | refunded | partially_refunded`),
  idempotencyKey, raw webhook payloads (audit), timestamps. Indexed on order + providerRef + status.
- ☐ Order flow changes:
  - Online-payment orders are created as `awaiting_payment`; **stock is reserved**
    (decremented) at creation with a TTL
  - A Vercel Cron sweep releases stock from expired unpaid orders (30–60 min TTL) and marks them `payment_expired`
  - `paid` transition happens **only** from a verified webhook or server-side `verify()` —
    the customer's return-redirect just shows "confirming…" and polls order status
  - Confirmation email/WhatsApp fire on `paid` (COD keeps current behavior)
- ☐ Security invariants: webhook signature verification per provider, replay protection
  (processed event IDs), amount+currency re-checked against the order, idempotent
  processing (a webhook delivered twice must be harmless)
- ☐ Checkout UI: payment-method selection driven by SiteSettings Commerce tab toggles
  (each provider off until its keys are configured); per-method instructions text

### 2.2 Whish Money adapter — ⏭ SKIPPED (Session 22, user decision)
Kept here for reference; revisit only if a client brand signs with Whish. It would be
one adapter against the 2.1 interface — nothing else in the plan depends on it.

### 2.3 Card gateway (Visa/Mastercard) — decision + adapter
- ☐ **Decision** (during vendor onboarding): a dedicated acquirer — Areeba (MPGS hosted
  checkout) or NetCommerce are the established Lebanese options. The abstraction makes
  this swappable per client brand.
- ☐ Hosted-checkout integration only (customer enters card on the gateway's PCI-compliant
  page) — we never touch PANs, keeping us out of PCI-DSS scope beyond SAQ-A

### 2.4 OMT adapter
- ☐ **Pay at OMT branch (cash voucher)** — the high-value flow for unbanked customers:
  checkout issues a payment code + instructions, customer pays cash at any of ~1,200 OMT
  locations, confirmation arrives via API/webhook (or manual admin confirmation as the
  v1 fallback with a "mark paid" button that's audit-logged)
- ☐ OMT Pay wallet flow if/when the merchant agreement covers it
- ⚠️ OMT e-commerce APIs are B2B-agreement-gated; v1 can ship as "voucher + manual
  confirm" and upgrade to API confirmation when the agreement lands

### 2.5 Currency (USD/LBP dual display)
- ☐ SiteSettings Commerce: `secondaryCurrency` toggle + admin-set `exchangeRate`
  (LBP per USD) + display mode (USD only / both)
- ☐ Storefront shows LBP equivalents where enabled (catalog, cart, checkout, emails);
  **USD stays the money of record** — LBP is display + the amount sent to LBP-native
  providers, snapshotted per order (`exchangeRateAtPurchase`)

### 2.6 Refunds & disputes
- ☐ Admin refund action on paid orders (full/partial) → provider `refund()` where
  supported, else records a manual refund; restocks items optionally; audit-logged
- ☐ Order timeline UI in admin: every payment event on the order (initiated, webhook
  received, paid, refunded) with timestamps and provider refs

### 2.7 Reconciliation
- ☐ Admin payments view: filter by provider/status/date; daily totals per provider vs
  orders marked paid; flag mismatches (webhook received but order missing, order paid
  with no payment row)
- ☐ Payments export (CSV) for the accountant — feeds into Part 4

---

## Part 3 — Fulfillment, invoicing & tax

### 3.1 Invoices
- ☐ PDF invoice generation per order (order number, line items, VAT breakdown, brand
  logo/details from SiteSettings) — downloadable from admin + customer account +
  attached to confirmation email
- ☐ **VAT support**: SiteSettings `vatEnabled` + `vatRate` (Lebanon: 11%) + registration
  number; prices treated as VAT-inclusive with the VAT share shown on invoice (standard
  retail practice); off by default for unregistered small brands

### 3.2 Courier & delivery operations
- ☐ Order fields: courier name, tracking ref, dispatch date; status emails include them
- ☐ Pick list / packing slip printable view (batch: all `confirmed` orders)
- ☐ Courier adapter interface (mirrors the payments pattern) — first integration with
  whichever courier the launch brand uses (Wakilni and Toters are the common Lebanese
  API-capable options); manual entry is the universal fallback
- ☐ Customer-facing delivery status on `/order/[orderNumber]` (already shows status;
  add courier + tracking when set)

### 3.3 Inventory operations
- ☐ Stock-adjustment admin action with reason (received, damaged, correction) — writes
  to audit log; keeps a movement history so "why is stock wrong" is answerable
- ☐ Low-stock email alert (threshold in SiteSettings; the dashboard widget exists,
  this pushes it)

---

## Part 4 — Reports & analytics 📊

Turns the existing dashboard into accounting-grade output. All reads go through
SQL aggregation (`payload.db.pool`) so it stays fast at volume — this also retires
the dashboard's "JS aggregation at scale" deferred item.

### 4.1 Report engine
- ☐ `src/lib/reports/` — parameterized report definitions (date range, filters) →
  tabular result. Types:
  - **Sales**: revenue/orders/AOV by day/week/month; by product, artist, category, area/zone, payment method
  - **Payments**: per-provider totals, fees, refunds (reconciliation-ready)
  - **Inventory**: current stock value, low stock, sell-through rate, dead stock
  - **Customers**: new vs returning, top customers, repeat rate, order frequency
  - **VAT/tax**: taxable revenue per period (when VAT enabled)
  - **Discounts**: usage + revenue impact per code
- ☐ Export: CSV always; XLSX (via a light lib) and print-friendly PDF for invoices/summaries
  — **PDF via `@react-pdf/renderer`** (pure JS, serverless-safe on Vercel, no headless
  browser); brand logo/name/colors pulled from SiteSettings so every client's PDFs come
  out branded. Same renderer serves Part 3.1 invoices.
- ☐ Admin UI: Reports section — pick report, set params, preview table, download
- Audience note: reports serve three parties — **owner** (sales/AOV by period, product,
  category, area; discount performance; top customers), **accountant** (payments/VAT
  summaries, CSV/XLSX), **operations** (inventory value, low stock, sell-through)
- Sequencing note: sales/inventory/customer/discount reports are buildable **before**
  payments (read-only over existing data; only F0 needed) — payments/VAT reports are
  the only F1-dependent ones

### 4.2 Scheduled reports
- ☐ Vercel Cron → `/api/reports/scheduled`: weekly/monthly summary emailed to
  `contactEmail` (retires the deferred "weekly email summary")
- ☐ Admin-configurable: which reports, what cadence, recipients

### 4.3 Dashboard v3
- ☐ Conversion funnel (sessions → carts → checkouts → orders; carts data already exists,
  sessions from Vercel Analytics API or a lightweight own counter)
- ☐ Cohort/repeat-purchase view (accounts exist, so this is now computable)
- ☐ Payment-method mix and payment-failure rate (new, from Part 2 data)

---

## Part 5 — AI assistants 🤖 — ⏭ SKIPPED (Session 22, user decision)

Entire part out of scope for now (customer chatbot + admin copilot). Spec kept below
for if/when it's revived; nothing else in the roadmap depends on it (F5 was already
a leaf phase — the admin copilot merely *reused* Part 4 report definitions).

Two surfaces, one integration: a **customer chatbot** on the storefront and an
**admin copilot** in the Payload admin. Built on the Anthropic TypeScript SDK
(`@anthropic-ai/sdk`) with tool use — the model never touches the DB directly; it
calls the same server-authoritative functions the app already trusts.

### 5.0 Shared foundation
- ☐ `ANTHROPIC_API_KEY` env; `src/lib/ai/client.ts` singleton
- ☐ Model: default `claude-opus-4-8` ($5/$25 per MTok), configurable via env.
  Pricing reality check: a typical chat turn (~2K in / 300 out with a cached system
  prompt) costs well under a cent — with **prompt caching** on the system prompt +
  store context (cache reads are ~0.1× input price), even thousands of customer chats
  a month is single-digit dollars. Cost controls anyway: per-IP rate limit (Upstash from 1.3),
  max-turns per session, monthly spend kill-switch in SiteSettings.
- ☐ Streaming responses (`client.messages.stream`) for chat UX
- ☐ All AI features behind SiteSettings toggles (white-label brands can disable)

### 5.1 Customer chatbot (storefront)
- ☐ Chat widget (client component, lazy-loaded so zero cost on page load) ↔
  `POST /api/assistant` (Edge-friendly streaming route)
- ☐ System prompt assembled server-side from SiteSettings (brand voice, store name,
  policies) + published Pages content (FAQ/about — the CMS is the knowledge base) —
  **stable prefix, cache-controlled**
- ☐ Tools (via `betaZodTool` + tool runner):
  - `searchProducts(query, filters)` → published products only (reuses shop query)
  - `getProduct(slug)` → details, sizes, stock state
  - `getOrderStatus(orderNumber)` → status + items (order numbers are unguessable tokens — same trust model as `/track`)
  - `getDeliveryInfo(area?)` → zones/fees/free-threshold from SiteSettings
  - `getPage(slug)` → published CMS page content (FAQ answers)
- ☐ Bilingual: responds in the locale of the page (en/ar); system prompt instructs RTL-appropriate Arabic
- ☐ Guardrails: scope instruction (store topics only), no invented prices/stock (tools
  are the source of truth), escalation — "talk to a human" hands off to the WhatsApp link
- ☐ Conversation persistence: per-session (httpOnly cookie key, server-stored transcript
  — consistent with the no-localStorage mandate), TTL-expired

### 5.2 Admin copilot (Payload admin)
- ☐ Admin-only chat panel (registered like SalesDashboard, gated by `isAdmin`)
- ☐ Tools (read-mostly; any write requires explicit admin confirmation in the UI):
  - `querySales(params)` → runs Part 4 report definitions ("compare this month's revenue to last")
  - `getOrders(filters)` / `getOrder(number)` → operational Q&A ("what's pending shipment?")
  - `getInventory(lowStockOnly?)`
  - `draftProductCopy(productId, tone?)` → generates title/description/meta in **en and ar** (the i18n gap-filler)
  - `translateContent(text, targetLocale)` → en↔ar content assistance
  - `draftCustomerReply(context)` → reply drafts for custom requests / order issues
- ☐ Write actions (v2, each behind a confirm dialog): update stock, change order status,
  create discount code

### 5.3 AI ops
- ☐ Token/cost logging per feature (usage fields from every response → a lightweight
  `AiUsage` collection or log drain); monthly usage view in admin
- ☐ Graceful degradation: no API key → features hidden, never broken

---

## Part 6 — Commerce completeness

The features "any business could possibly require" that aren't payments/reports/AI.

### 6.1 Returns & exchanges (RMA)
- ☐ Customer-initiated return request from order history (reason, items) →
  `Returns` collection (statuses: requested / approved / received / refunded / rejected)
- ☐ Admin workflow + status emails; approved returns restock + optionally trigger
  Part 2 refund or issue store credit (6.3)

### 6.2 Product reviews & ratings
- ☐ `Reviews` collection: rating + text, linked to customer + product,
  **verified-purchase flag** (customer has a delivered order containing the product)
- ☐ Moderation queue in admin (pending → published); rating summary on product page +
  stars in listings; JSON-LD `aggregateRating` for SEO

### 6.3 Gift cards & store credit
- ☐ `GiftCards` collection: unique code, initial/remaining balance, purchaser/recipient,
  expiry; sellable as a (virtual) product; redemption at checkout (server-authoritative,
  same trust model as discounts); combinable with discount codes per admin setting
- ☐ Store credit on customer account (refund destination from 6.1) — applied at checkout

### 6.4 Back-in-stock & availability
- ☐ "Notify me" on sold-out products/sizes (email capture, tied to account when logged in)
  → notification fires from the restock hook path
- ☐ Preorder mode per product (charge on order, fulfil later, clear messaging)

### 6.5 Abandoned-cart recovery
- ☐ Carts collection already exists — Vercel Cron finds carts idle >24h with a known
  email (logged-in customers), sends one recovery email (opt-out honored)
- ☐ This also adds the **cart-cleanup sweep** (delete anonymous carts >60 days — closes
  the unbounded-growth scalability gap noted in Session 20)

### 6.6 Loyalty & referrals (post-core, optional per brand)
- ☐ Points per order value → redeemable as discount at checkout; SiteSettings-configured
  earn/burn rates; referral codes (give X get Y) building on the Discounts engine

### 6.7 Catalog depth
- ☐ Product bundles (bundle price, component stock checks)
- ☐ Size-guide CMS block; per-product custom fields (materials, care) as flexible key/values

---

## Part 7 — Growth & marketing

- ☐ **Newsletter** — capture block (footer + CMS block) → Resend Audiences; drop-announcement broadcast from admin
- ☐ **Campaign links + UTM surfacing** in the dashboard (which campaign drove orders)
- ☐ **Blog/editorial** — `Posts` collection reusing the Pages block builder + RichText (SEO content engine)
- ☐ **WhatsApp order-status messages** (extends Session 10 code once keys active)
- ☐ **Structured-data audit** — Organization, BreadcrumbList, SearchAction schemas
- ☐ Instagram feed embed (blocked on handle)

---

## Part 8 — Productization (making it sellable) 💼

- ☐ **Generic taxonomy / de-verticalization** (added Session 22) — the data model still
  assumes a music/clothing brand, which the Copy tab can't fix. A jewelry (or any other)
  brand needs:
  - **Artist collection → configurable taxonomy**: admin-set singular/plural labels +
    URL segment (SiteSettings or a Features tab field), so "Artist / `/artist/`" can
    become "Designer / `/designer/`" or "Collection / `/collection/`" per client — used
    everywhere the label appears (nav filters, product page, "More from {artist}",
    admin UI labels). The `genre`/`bio` fields become generic subtitle/description.
  - **CustomRequest fields**: `reference_artist` / `reference_song` → generic,
    admin-configurable reference fields (or a flexible field list)
  - **GarmentType** → already admin-managed values, but rename the collection label
    ("Product Type") so it reads vertical-neutral in admin
  - **Vertical-neutral demo seed** (feeds the demo-mode item below) — the current seed
    is music-specific
  - Remaining default strings that assume clothing ("hand-painted piece" etc.) are
    already overridable via the Copy tab — audit defaults, keep them neutral
- ☐ **Deployment model decision — recommendation: per-client deploy** (own Vercel project
  + Supabase project per brand). Zero code changes needed, hard data isolation, aligned
  with the white-label work already done. Multi-tenant SaaS is a major re-architecture
  (tenant scoping on every query) — revisit only if client count makes per-deploy ops painful.
- ☐ **Onboarding wizard** — first-run admin flow (no products yet → guided steps:
  brand → theme → delivery zones → payment providers → first product → publish).
  Turns "deploy for a new client" into an afternoon.
- ☐ **Setup playbook** (`ONBOARDING.md`) — the repeatable per-client checklist: clone,
  env, Supabase, Vercel, domain, Resend domain, payment-provider onboarding, seed, handover
- ☐ **Feature flags** — SiteSettings "Features" tab: toggles for reviews, gift cards,
  loyalty, chatbot, blog, wishlist… so one codebase serves brands of different sizes
- ☐ **Demo mode** — polished seed dataset + demo deployment for sales conversations
- ☐ **Versioned upgrades** — clients on old versions need a documented upgrade path
  (migrations already give us the DB half; add a CHANGELOG.md discipline)
- ☐ **Owner documentation** — non-technical admin guide (manage products, orders,
  refunds, reports, theming) — required for handover to real store owners
- ☐ **Licensing/commercial** — decide pricing model (one-time + maintenance vs monthly);
  out of code scope but the feature-flag work above supports tiering

---

## Execution order & sizing

| Phase | Contents | Size | Depends on |
|---|---|---|---|
| **F0 — Foundation** | Part 1 (DB split, baseline migration, Upstash, Sentry, audit log, Playwright smoke) + Part 0 quick items | M | — |
| **F1 — Payments core + cards** | 2.1 abstraction, 2.3 card gateway (Areeba MPGS / NetCommerce), 2.5 currency, stock reservation + expiry cron *(2.2 Whish skipped)* | L | F0 (hard req) + vendor onboarding ⏳ |
| **F2 — OMT + refunds + reconciliation** | 2.4, 2.6, 2.7 | M | F1 |
| **F3 — Invoicing & fulfillment** | Part 3 (invoices/VAT, courier, inventory ops) | M | F0; invoices richer after F1 |
| **F4 — Reports** | Part 4 (engine, exports, scheduled, dashboard v3) | M | F0; payment/VAT reports need F1 — everything else buildable right after F0 |
| **F5 — AI assistants** | ⏭ SKIPPED (Session 22) | — | — |
| **F6 — Commerce depth** | Part 6 (returns, reviews, gift cards, back-in-stock, abandoned cart) | L (parallelizable chunks) | F0; returns-refunds need F1 |
| **F7 — Growth** | Part 7 | S–M | independent |
| **F8 — Productization** | Part 8 (generic taxonomy, wizard, flags, docs, demo) | M | best last — flags wrap features that exist; generic-taxonomy item can be pulled earlier |

**Start with F0** — it's the only phase everything else depends on, and its riskiest
item (DB split) gets safer the earlier it happens. **Kick off card-acquirer + OMT
merchant onboarding conversations immediately** (F1/F2's external clock — paperwork
typically takes longer than the code).

External blockers to start in parallel today:
1. Card acquirer merchant account — Areeba (MPGS) or NetCommerce — with sandbox/hosted-checkout access
2. OMT merchant/B2B agreement (asks: e-commerce API availability, voucher flow)
3. Meta WhatsApp Cloud API business verification (already known)
4. Resend domain verification for the production sender (already in DEPLOY.md)

---

## Definition of "full and complete"

The software is done — in the "any business can use this" sense — when a brand owner can:

1. **Set up alone**: onboarding wizard → branded, themed, stocked store without a developer
2. **Sell every way Lebanon buys**: COD, bank transfer, Whish, card, OMT cash — toggled from admin
3. **Operate alone**: orders, refunds, returns, stock, couriers, invoices — all in admin, all audit-logged
4. **Understand the business**: dashboards + scheduled reports + exports their accountant accepts
5. **Serve customers**: bilingual storefront (Arabic/English), order tracking, WhatsApp contact *(AI chatbot skipped — Session 22)*
6. **Grow**: newsletter, discounts, gift cards, loyalty, reviews, blog, abandoned-cart recovery
7. **Trust it**: tested checkout, monitored errors, rate-limited APIs, 2FA admin, backups, migration-safe upgrades

*Keep this file updated as phases complete; log sessions in CLAUDE.md as always.*
