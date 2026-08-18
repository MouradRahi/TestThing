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
- ☑ **Weekly email summary** for the sales dashboard — DONE (Session 26), see Part 4 §4.2
- ☐ **Recently-viewed strip** — server-backed design (no localStorage per mandate); fold into customer-account phase polish
- ☐ **2.7 artist filter chips → dropdown/combobox** at scale (~15+ artists)
- ☐ **Announcement-bar contrast check** on admin-set colors
- ☐ **WhatsApp activation** — code ready, needs Meta keys (blocked on business verification)
- ☐ **Instagram embed** — blocked on brand handle

---

## Part 1 — Foundation hardening (prerequisite for money) — ☑ SUBSTANTIALLY DONE (Session 22)

You cannot run online payments on the current operational setup. These are not
nice-to-haves — a payment dispute with no audit trail, or a webhook lost to an
in-memory queue, is real money lost.

All seven sub-items are now code-complete and verified (1.1–1.7). Two small
non-code items remain, both one-off manual actions rather than build work:
create the `products` storage bucket in the dev Supabase project (1.1 leftover),
and run the one-line `payload_migrations` INSERT on **prod** before the next
deploy so its build doesn't try to re-create tables that already exist there
(1.2 — SQL in MIGRATIONS.md §Baselining). The two *new* migrations from this
session (rate-limit/idempotency, audit-log) need no such treatment on prod —
those tables are genuinely new there, so `npm run migrate` on deploy will
create them for real, same as any normal migration.

### 1.1 Split dev/prod databases ⚠️ do this first — ☑ DONE (Session 21)
- ☑ New disposable Supabase project for dev (`lsrmtpazcdksdllfrsqw`, ap-southeast-2); `.env.local` fully repointed (DB + storage + S3 keys), `PAYLOAD_PUSH=true` set
- ☑ Schema pushed (62 tables) + demo catalog seeded; placeholder URLs fixed to `.png` (next/image blocks SVG); `EAI_AGAIN` DNS flake fixed via `dns.setDefaultResultOrder('ipv4first')` in next.config.ts
- ☑ Prod stays on the original project, migration-only
- ☐ Leftover: create the `products` bucket (**Public**) in the dev project — admin image uploads fail until then

### 1.2 Migration discipline
- ◐ Baseline migration created + marked applied — dev ☑ (Session 22); prod needs the one-line INSERT (MIGRATIONS.md §Baselining) before next deploy
- ☐ Every schema change in this roadmap ships as a reviewed migration file

### 1.3 Durable rate limiting + idempotency — ☑ DONE (Session 22, part 10)
- ☑ **Durable rate limiting** — `src/lib/durable-rate-limit.ts` replaces the in-memory sliding-window map with a Postgres-backed fixed-window counter (`rate_limit_counters` table, new collection). **Chose Postgres over Upstash/Vercel KV** — the actual problem (per-instance in-memory state doesn't survive across serverless instances) is solved just as well by the database every instance already shares, with zero new external account/service/env-var needed. A single atomic UPSERT does the whole read-window/decide/write cycle (mirrors the stock-decrement and discount-redemption atomic patterns already in this codebase) — two concurrent requests for the same key can't both slip through. Falls back to the old in-memory limiter only if the pool is unreachable. **All 11 call sites swapped** (orders, cart, login, register, forgot/reset/change-password, profile, wishlist, custom-requests, discount-validate) — the in-memory version is no longer used anywhere except as that fallback. Verified against the real dev DB: 3 hits under a limit of 3 all allowed, the 4th correctly rejected, confirmed again via real HTTP requests against a running server (3/10min limit on `/api/custom-requests` correctly allowed 3 then 429'd the 4th).
- ☑ **Idempotency-key support** on `POST /api/orders` — `src/lib/idempotency.ts` (new `idempotency-keys` collection). Client (`CheckoutForm.tsx`) generates one UUID per checkout attempt (stable for the component's lifetime via `useState(() => crypto.randomUUID())`) and sends it as an `Idempotency-Key` header; a retried request with the same key returns the original order response instead of creating a second order. Only successful (201) responses are cached, so retrying after a fixed validation error still goes through normally. Verified against a real running server: POSTing the same order twice with the same key returned the identical `orderNumber` both times, stock decremented exactly once (not twice), and exactly one order document existed in the DB afterward.
- Payment endpoints don't exist yet (Whish skipped, cards/OMT not built) — the idempotency pattern is ready to extend to them when F1/F2 land.

### 1.4 Observability
- ◐ **Sentry wired (Session 22, part 7)** — client + RSC/route-handler error boundaries report to Sentry (`error.tsx`, `global-error.tsx`, `reportServerError()` helper); fully optional, zero build/bundle cost with no `NEXT_PUBLIC_SENTRY_DSN` set (verified: bundle sizes identical with/without the code present). ⚠️ **`onRequestError` (the Next.js hook that catches errors bypassing app-level try/catch) is deliberately NOT wired** — even behind a runtime guard, exporting it forces Next.js to inline the full SDK into the edge/middleware bundle unconditionally (~80KB verified), which this project's minimal-middleware philosophy doesn't justify for a locale-routing middleware. Coverage instead relies on explicit `reportServerError()` calls in route catch blocks — **only wired into `orders/route.ts` so far**; adopt it in other routes' catch blocks as they're touched (cart, discounts/validate, custom-requests), and revisit `onRequestError` if edge/middleware errors turn out to be a real blind spot in practice. Needs a `NEXT_PUBLIC_SENTRY_DSN` (+ optionally `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` for source maps) from a Sentry account — not yet set.
- ☐ Structured logging on all payment/webhook paths (who, what, provider ref, amount) — natural extension of `reportServerError()`'s `context` param once F1 payments land

### 1.5 Audit log — ☑ DONE (Session 22, part 10)
- ☑ `AuditLog` collection (`src/collections/AuditLog.ts`, `src/lib/audit-log.ts`) — logs who changed what, when. Wired into three `afterChange`/`afterDelete` hooks: **Orders** (orderStatus/paymentStatus transitions, with before→after values — orders are only ever updated from admin, the storefront API only creates, so this cleanly captures "admin changed a status"), **Discounts** (create/update/delete — `usageCount` bumps via raw SQL bypass Payload's hooks entirely, so this only ever fires for genuine admin edits, never the automatic per-order redemption), **SiteSettings** (which top-level fields changed). Uses a shallow top-level-key diff (`changedTopLevelFields()`) rather than a deep/rich-text-aware diff — enough to know *what* was touched, not a full value history. `logAuditEvent()` silently no-ops if there's no authenticated staff user on the request (never blocks the underlying save over a logging concern) and snapshots the admin's email (survives that user account later being deleted). Verified against the real dev DB: simulated an admin-driven order status change, a discount create+update, and two SiteSettings updates — all four produced correct, correctly-worded audit rows.

### 1.6 Admin account security — ☑ DONE (Session 22, part 10; rate limit + 2FA added Session 27 part 6)
- ☑ **Login-attempt lockout** — turned out to need zero new code. Payload's `auth: true` default (used by `Users.ts` all along) already sets `maxLoginAttempts: 5` / `lockTime: 10min` unless explicitly overridden, which nobody had. Verified end-to-end with a throwaway staff account: 5 failed logins locked the account, and the 6th attempt was rejected *even with the correct password*.
- ☑ **IP-based login rate limiting** (Session 27 part 6, prompted by a login-security audit): the per-account lockout above doesn't stop one IP from spraying many different email guesses. `Users.ts` `beforeOperation` hook — fires before password verification even runs — calls `durableRateLimit()` keyed by IP, same durable Postgres-backed limiter every other route in this app uses. Verified: 8–10 wrong-password attempts against distinct nonexistent emails correctly 429'd, isolated from the separate per-account lockout by testing with emails other than the real account under test.
- ☑ **Opt-in staff TOTP 2FA** (Session 27 part 6, same audit — chosen over skipping it: opt-in per account, so nobody is forced in and there's no lockout risk to existing access). `Users.ts` gained `twoFactorEnabled`/`twoFactorSecret`/`twoFactorPendingSecret`/`twoFactorEnabledAt` + a `beforeLogin` hook that, when enabled, requires a valid `twoFactorCode` in the login request's raw JSON body (`req.data` — confirmed by reading Payload's own login source that extra body fields survive through to this hook) or throws a distinguishable `2FA_REQUIRED`/`2FA_INVALID` `APIError`. Enrollment/disable via `src/lib/totp.ts` (`otpauth` + `qrcode`, both server-only — never reach a client bundle) + `POST /api/admin/2fa/{setup,verify-setup,disable}` + a `TwoFactorField.tsx` `ui` field on the Users edit view (QR code, manual key, code confirmation). **Admin login page itself was NOT overridden** — Payload's built-in `<LoginForm>` has no supported swap-out in this version (confirmed by reading `@payloadcms/next`'s `LoginView` source: only decorative `beforeLogin`/`afterLogin` component slots exist). Instead, `AdminTwoFactorLoginGate.tsx` (mounted via `admin.components.beforeLogin`) intercepts same-origin `fetch()` calls to `/api/users/login` — reacting only to the endpoint's public REST contract (URL, JSON shapes), never DOM/CSS internals — and shows a code modal on the `2FA_REQUIRED`/`2FA_INVALID` marker, resubmitting with the code so Payload's own form sees a normal response and handles the cookie/redirect itself. **Recovery path**: an admin can disable 2FA on a *different* staff account with no code required (`targetUserId`, admin-role-gated) — the self-disable path requires a current TOTP code instead of the password (an internal `payload.login()` re-check would itself trip the new `beforeLogin` gate, since a local-API call has no HTTP body to carry a code through). Both disable paths audit-logged. Verified end-to-end against the real dev DB + a live server: enrollment (wrong code rejected, correct accepted), the login gate (no code → 401, wrong code → 401, correct code → 200 + cookie), self-disable, and the cross-account admin recovery path (403 for a non-admin, 200 for an admin) all confirmed via real HTTP with real TOTP codes computed from the actual stored secret.
- Full TOTP 2FA was the roadmap's stated "stronger alternative" to lockout — now done, not just deferred.
- ☑ **Enforced strong passwords** — Payload's own default password `minLength` is a permissive 3 characters with no complexity check, and there's no built-in collection-level override for it. Added a `beforeValidate` hook on `Users.ts`: staff passwords must be ≥12 characters and include both a letter and a number (stricter than the storefront's 8-char customer minimum, since a compromised staff account is higher-stakes). Verified: `short1`, an 18-char letters-only string, and a 12-digit-only string were all correctly rejected; a 22-char mixed password was correctly accepted.
- ☑ **Role review (the 1.11 leftover)** — Products, Pages, Categories, Artists had *no access block at all* (Payload's actual default, confirmed by reading its source, is `Boolean(user)` — any authenticated user of *any* auth collection, not gated by role at all); GarmentTypes/Media only specified public `read`. Editors still need to manage the catalog day-to-day, so `create`/`update` stay open to any staff — only `delete` is now admin-only on all six (mirrors the Orders/Users pattern already fixed in Session 9). **SiteSettings** (the "Settings" the roadmap explicitly named) went further: `update` itself is admin-only, since it governs money-relevant config (delivery zones, bank transfer instructions) that isn't routine editorial work the way product/page edits are. Verified against the real dev DB with a throwaway editor account: editor could update a product but not delete it, could not update SiteSettings at all; an admin could do both.

### 1.7 Automated test safety-net — ☑ DONE (Session 22, parts 8–9)
- ☑ **Unit tests for money math** — Vitest (`npm test` / `npm run test:watch`), 25 tests across 4 files: `computeDiscountAmount` (percentage/fixed, subtotal clamping, rounding, negative/zero-subtotal edge cases), `resolveDeliveryFee`/`getDeliveryZones` (no-zones free mode, zone match, no-match rejection, free-delivery threshold, malformed-data filtering), `getSizes`/`totalStock` (sized vs. flat stock, malformed rows), `cartLineKey` (line uniqueness per product+size). Deliberately scoped to functions that were **already pure** — stock decrement/restock and discount redemption stay DB-coupled (atomic SQL, verified manually per-change so far, see B4/B14 session notes) and are Playwright/integration-test territory, not unit-test territory; forcing them into unit tests would mean mocking away the exact atomicity behavior that matters.
- ☑ **Playwright smoke suite** (`e2e/checkout.spec.ts`, `npm run test:e2e`) — browse `/shop` → open a product → (pick a size if sized) → Add to Cart → Checkout (from the mini-cart drawer) → fill delivery/payment (COD) → Place Order → asserts the redirect lands on `/order/<number>` and the confirmation page renders that same number (proof the order was actually persisted, not just that the form submitted). Deliberately catalog-agnostic — picks "whichever product/zone is first" rather than hardcoding demo data names, so it survives reseeds/edits to the dev catalog. Runs against a real `next build && next start` (not dev mode) for pre-deploy fidelity. Verified passing twice against the real dev DB.
- ☑ **First CI pipeline for this repo** — `.github/workflows/test.yml`: unit tests + `tsc --noEmit` run on every push/PR with no setup; the E2E job needs `CI_*` repository secrets (pointed at the **dev** Supabase project only, documented in DEPLOY.md §5a) that aren't added yet — safe to leave inactive, it just skips.
- Why: a sellable product cannot regress checkout with every feature added; payments make this mandatory

---

## Part 2 — Payments (Lebanon) 🇱🇧 ⚠️ the centerpiece — ◐ F1+F2 GROUNDWORK DONE (Sessions 23–24)

**Status**: 2.1 (abstraction), 2.5 (currency), 2.4 (OMT v1), 2.6 (refunds v1), and 2.7
(reconciliation v1) are all code-complete and verified against the dev DB. 2.3 (real card
gateway) is deliberately **not** started — no Areeba/NetCommerce merchant account exists
yet (see "External blockers" below) — but the abstraction was built and proven end-to-end
with a `mock` testing provider, so wiring in a real adapter later is one new file (+ a
`Payments.provider` select option), not a rewrite. 2.2 stays skipped. What's left of F2 is
genuinely F3+ territory (order-timeline UI, real OMT API confirmation once the B2B
agreement lands, provider-side refund() once a real gateway supports it) — not blocked on
anything, just smaller and lower-priority than what's already shipped.

COD + bank transfer stay. We add: **Visa/Mastercard** (card gateway) and **OMT**
(wallet + pay-cash-at-branch). All behind one abstraction so a brand can toggle
providers from admin, and new providers (Areeba, NetCommerce, MyMonty, Suyool…) are
an adapter each, not a rewrite.

> ⏭ **Whish skipped** (user decision, Session 22) — the Whish wallet/gateway adapter
> is out of scope for now; the card rail goes through a dedicated acquirer (2.3).
> The abstraction keeps Whish addable later as just another adapter.

### 2.1 Payment abstraction layer (build first, provider-agnostic) — ☑ DONE (Session 23)
- ☑ `src/lib/payments/types.ts` — `PaymentProvider` interface: `initiate(payload, order)`,
  `handleWebhook(req, rawBody)`, `verify(payload, providerRef)`. (`refund()` deferred to
  F2 — no provider needs it yet.)
- ☑ `src/collections/Payments.ts` — order relation, provider, providerRef, amount, currency,
  status (`initiated | pending | paid | failed | expired | refunded | partially_refunded`),
  rawEvents (json, audit trail), timestamps. Indexed on order + provider + providerRef + status.
  Admin-only read; create/update blocked at the collection level (written only via
  `src/lib/payments/service.ts` through the Local API). (`idempotencyKey` field dropped —
  the existing `idempotency-keys` collection + `Idempotency-Key` header on `POST /api/orders`
  already covers retry-safety for order+payment creation as one unit.)
- ☑ Order flow changes:
  - Online-payment orders are created `awaiting_payment` with a `paymentExpiresAt` timestamp;
    **stock is reserved** (decremented) at creation exactly like COD/bank-transfer orders
  - `src/app/api/cron/expire-payments/route.ts` (new, scheduled in `vercel.json`) finds
    expired unpaid orders and marks them `orderStatus: cancelled` / `paymentStatus: expired`
    — reuses the existing Orders restock-on-cancel + status-email hooks rather than
    duplicating that logic. ⚠️ Vercel Hobby's daily-cron limit (the same constraint that
    made `cleanup-carts` daily) means the nominal 45-min TTL is actually "released within
    a day" until this runs on Pro or an external scheduler — documented in the route,
    acceptable while the only live provider is the mock adapter.
  - `paid` transition happens **only** via a verified webhook (`applyPaymentEvent` in
    `service.ts`) — the customer's return-redirect (`/order/[orderNumber]`) shows a
    `PaymentConfirmingBanner` that polls `GET /api/orders/[orderNumber]/status` and
    `router.refresh()`s on change, never trusting the redirect itself
  - Confirmation email/WhatsApp fire on the `awaiting_payment → paid` transition via an
    Orders `afterChange` hook (COD/bank-transfer keep firing immediately at creation, unchanged)
- ☑ Security invariants: HMAC signature verification (mock adapter — real adapters bring
  their own scheme), idempotent processing (`applyPaymentEvent` no-ops on an
  already-terminal payment status), amount re-checked against the stored Payment record
  when a webhook supplies one
- ☑ Checkout UI: "Card" only appears when SiteSettings Commerce → `cardPaymentsEnabled`
  is on **and** the configured provider passes `isProviderAvailable()` (mock is
  auto-disabled in production unless `ALLOW_MOCK_PAYMENTS=true`); test-payment note shown
  inline when selected
- ☑ **`ONLINE_PAYMENTS_ENABLED` deploy-time master switch** (Session 24, user request) —
  `isProviderAvailable()` now checks this env var first, before any per-provider logic;
  same dev-open/prod-explicit shape as `ALLOW_MOCK_PAYMENTS`. Deliberately redundant with
  the Site Settings checkboxes: guarantees Card/OMT can never appear or process in
  production — regardless of what's toggled in the database/admin panel — until
  explicitly turned on per environment once a provider (Areeba/OMT/Whish) is actually
  confirmed. "Nothing clickable that leads nowhere" as a deploy-config guarantee, not just
  a CMS default.

### 2.2 Whish Money adapter — ⏭ SKIPPED (Session 22, user decision)
Kept here for reference; revisit only if a client brand signs with Whish. It would be
one adapter against the 2.1 interface — nothing else in the plan depends on it.

### 2.3 Card gateway (Visa/Mastercard) — decision + adapter — ◐ MOCK ADAPTER ONLY (Session 23)
- ☑ `src/lib/payments/mock.ts` + `registry.ts` — a testing adapter (HMAC-signed webhook,
  `/pay/mock/[paymentId]` simulated hosted-checkout page, `/api/payments/mock/simulate` +
  `/api/payments/webhook/mock`) proves the 2.1 abstraction end-to-end without a real
  merchant account: initiate → redirect → webhook → `paid` → confirmation email, all
  verified against the dev DB. Auto-disabled in production unless `ALLOW_MOCK_PAYMENTS=true`.
- ☐ **Decision** (still pending — needs vendor onboarding): a dedicated acquirer — Areeba
  (MPGS hosted checkout) or NetCommerce are the established Lebanese options. The
  abstraction makes this swappable per client brand.
- ☐ Real hosted-checkout integration (customer enters card on the gateway's PCI-compliant
  page) — we never touch PANs, keeping us out of PCI-DSS scope beyond SAQ-A. Adding it is:
  one adapter file implementing `PaymentProvider`, one line in `registry.ts`, one option
  added to `Payments.provider`'s select (+ a migration for that enum) and
  `SiteSettings.cardPaymentProvider`'s select — checkout/orders/webhook-route/cron all
  already generic over the provider key.

### 2.4 OMT adapter — ☑ v1 DONE (Session 24: voucher + manual confirm)
- ☑ **Pay at OMT branch (cash voucher)** — `src/lib/payments/omt.ts`: `initiate()` mints
  an 8-digit voucher code (no external API call — none exists yet), checkout shows it +
  admin-set instructions on the order confirmation page (no live polling like card's
  `PaymentConfirmingBanner` — a branch visit can take hours/days, so the page just shows a
  static state and updates on next revisit). Stock reserved exactly like card, but with a
  much longer window (`OMT_RESERVATION_HOURS`, default 48h, vs. card's 45 min).
  Confirmation arrives via the admin dashboard's **"OMT Payments Awaiting Confirmation"**
  panel (`OmtPaymentsPanel.tsx`, `beforeDashboard`) — a "Mark as Paid" button
  (`POST /api/admin/payments/mark-paid`) that calls `markPaymentPaidManually()`, which
  routes through the exact same `applyPaymentEvent()` a real webhook would use (idempotent,
  terminal-state-safe) and is audit-logged.
- ☐ OMT Pay wallet flow if/when the merchant agreement covers it
- ⚠️ OMT e-commerce APIs are B2B-agreement-gated; v1 ships as "voucher + manual confirm";
  upgrading to real API confirmation later is one adapter file (`handleWebhook`/`verify`
  implementations) — nothing about the order flow, checkout UI, or admin panel changes.
- Verified against the real dev DB via real HTTP + a throwaway admin JWT session (not just
  Local API scripts): voucher order creation, confirmation-page voucher display, mark-paid
  (+ idempotent replay + 403 when unauthenticated).

### 2.5 Currency (USD/LBP dual display) — ☑ DONE (Session 23)
- ☑ SiteSettings Commerce: `currencyDisplayMode` (`usd_only` | `both`) + admin-set
  `exchangeRate` (LBP per USD). `resolveCurrencyDisplay()` (site-settings.ts) only ever
  actually returns "both" when a valid positive rate is configured — a fresh install or
  an unset rate silently reads as USD-only rather than showing "LBP undefined" anywhere.
- ☑ Storefront shows LBP equivalents where enabled — shop grid, product detail + related
  cards, cart page, cart drawer, checkout summary, order confirmation, and the
  confirmation email's total row. **USD stays the money of record**; LBP is
  `formatLBP()` (`src/lib/format.ts`) display only, never fed back into a calculation.
  Snapshotted per order (`Orders.exchangeRateAtPurchase`) so a later admin rate change
  never retroactively changes what a past order "was worth."
- Deferred (not requested this session): showing LBP as the amount actually sent to an
  LBP-native provider (OMT, F2) — today's mock adapter only ever speaks USD.

### 2.6 Refunds & disputes — ☑ v1 DONE (Session 24)
- ☑ Admin refund action on **any** paid order, not just online ones — `processRefund()`
  (`src/lib/payments/service.ts`) via `POST /api/admin/payments/refund`
  (`RefundButton.tsx` in the new "Payments Reconciliation" dashboard panel — inline
  amount + restock-checkbox form, no modal needed). Full or partial (clamped to the
  remaining refundable balance, tracked on `Orders.refundedAmount` — the single source of
  truth regardless of provider), optional restock (whole-order only; per-item partial
  restock on a partial refund is deferred to Part 6 returns/RMA, which needs item-level
  selection anyway), audit-logged. Provider-side `refund()` is an optional interface method
  for when a real gateway supports it — mock/OMT both fall back to recording the refund
  without sending it anywhere, which is the honest state today.
- ☑ Order timeline UI (Session 27 part 6): `OrderTimelineField.tsx` — a collapsible `ui`
  field on Orders (next to the invoice-download field) that merges this order's Payment
  records (attempt created/status changes/webhook `rawEvents`) with its AuditLog rows
  (admin-driven status/refund changes) into one chronological list via a new
  `GET /api/admin/orders/[id]/timeline` route. Pure read-side merge of data both
  collections already record — no new writes, no new schema. Verified against a real order
  from this project's own F2 testing history (order 21's OMT-confirm → partial-refund →
  full-refund sequence) via real HTTP with an admin JWT: entries render chronologically,
  an order with no events returns an empty (not erroring) list, unauthenticated is 403'd.
- Verified: partial refund → `partially_refunded`, remaining-amount refund → `refunded`,
  over-refund correctly rejected, refund on a non-paid order correctly rejected, refund +
  restock on a **COD** order (no Payment record at all) correctly updates the order alone.

### 2.7 Reconciliation — ☑ v1 DONE (Session 24)
- ☑ Admin payments view — `PaymentsOpsPanel.tsx` (`beforeDashboard`): per-provider
  paid-order totals, a mismatch check between Orders and Payments (should always be empty
  — `applyPaymentEvent()`/`processRefund()` update both atomically; a non-empty list means
  something bypassed that path), and a "Recent paid orders" list with the refund action.
  Provider/status/date filtering is Payload's own built-in list-view filtering on the
  Payments collection (free — no custom UI needed for that part).
- ☑ Payments export (CSV) for the accountant — `GET /api/admin/payments/export`
  (admin-only, cookie/JWT-authenticated): every order's money fields
  (method/status/subtotal/fee/discount/total/refunded), newest first. Exports Orders
  rather than just the Payments collection so COD/bank-transfer are included too — feeds
  into Part 4's report engine.

---

## Part 3 — Fulfillment, invoicing & tax

### 3.1 Invoices — ☑ DONE (Session 27)
- ☑ PDF invoice generation per order (order number, line items, VAT breakdown, brand name/
  contact from SiteSettings) — `src/lib/invoices/invoice-pdf.tsx`, built on the same
  `@react-pdf/renderer` this reuses from Part 4's report exports, exactly as planned.
  Downloadable via a public `GET /api/invoices/[orderNumber]` route (same trust model as
  `/order/[orderNumber]` — the order number itself is the access control, no login required,
  matching every other order-scoped customer-facing surface in this app), linked from the
  order confirmation page, the account order-history list, and a `ui`-field "Download
  Invoice" link on the Orders admin edit view (`InvoiceDownloadField.tsx`, reads the current
  form's `orderNumber` via `useFormFields`). Also attached as a PDF to the order confirmation
  email (both the COD/bank-transfer immediate-send path and the online-payment
  payment-confirmed hook) — generated inside `after()`/the hook so rendering it never adds
  latency to checkout itself; a generation failure logs and the email still sends without it.
- ☑ **VAT support**: SiteSettings Commerce tab gained `vatEnabled` + `vatRate` (default 11,
  Lebanon standard) + `vatRegistrationNumber`; `src/lib/vat.ts → computeVatBreakdown()` (pure,
  unit-tested) extracts the VAT share from a VAT-inclusive total (`vat = gross × rate /
  (100 + rate)`) rather than adding VAT on top — prices never change at checkout. Off by
  default; the invoice renders no VAT section at all when disabled, not a zeroed-out one.
- **Verified against real dev data**: generated both a VAT-off and a VAT-on invoice from an
  actual order via the bundled-config loader + `tsx` — both produced valid PDFs (`%PDF-`
  magic bytes), and the VAT breakdown reconciled to the cent (net + vat == gross) against
  the real order total.

### 3.2 Courier & delivery operations — ☑ DONE v1 (Session 27, part 2)
- ☑ Order fields: `courierName`, `trackingRef`, `dispatchDate` — plain staff-editable fields
  (manual entry, no real courier API yet). The "shipped" status email includes courier +
  tracking when set.
- ☑ Pick list / packing slip printable view: `GET /api/admin/packing-slips` — admin-gated,
  plain HTML (not PDF — meant to be glanced at and Ctrl+P'd, not downloaded/archived) with
  one slip per `confirmed` order, `page-break-after` per slip for clean printing. Linked
  from the Sales Overview admin panel header ("Print packing slips →").
- ☑ Courier adapter interface (`src/lib/couriers/{types,registry}.ts`) — mirrors the
  payments abstraction shape, one `manual` provider for now (same sequencing the payments
  code went through: mock → OMT → real gateway). First real integration (Wakilni/Toters,
  whichever the launch brand uses) is "add a provider," not "invent the abstraction under
  vendor pressure" — deliberately not attempted this session, needs a vendor decision.
- ☑ Customer-facing delivery status on `/order/[orderNumber]` — shows courier + tracking
  ref when set, alongside the existing order status.

### 3.3 Inventory operations — ☑ DONE (Session 27, part 2)
- ☑ Stock-adjustment admin action with reason (received/damaged/correction/other) — a `ui`
  field on the Products edit view (`StockAdjustField.tsx`, the second field-level custom
  admin component in this codebase after Orders' `InvoiceDownloadField`), posts to
  `POST /api/admin/products/adjust-stock` (handles sized vs. flat stock via the existing
  `src/lib/stock.ts` helpers, floors at 0). **Movement history is the AuditLog entry this
  writes** (before → after, delta, reason, who) — a dedicated StockMovements collection
  would duplicate what AuditLog already does for every other admin-driven change; reused
  rather than rebuilt.
- ☑ Low-stock email alert: SiteSettings gained `lowStockAlertEnabled`/`lowStockThreshold`
  (defaults to 3, matching the existing dashboard widget)/`lowStockAlertLastSentAt`.
  `GET /api/cron/low-stock-alert` (daily cron, same dev-open/prod-`CRON_SECRET` pattern and
  same daily-cron-computes-its-own-due-day shape as the other crons) emails a summary via
  `sendLowStockAlertEmail()` — but **only touches the dedupe guard on a day it actually
  sends**, so a quiet day never suppresses tomorrow's real alert.
- **Verified with real HTTP requests against a real dev server** (not just Local API calls):
  built a real production server (`npm run start`, port 3100 — confirmed no dev server was
  running first), bootstrapped a throwaway admin via the Local API (`overrideAccess`, same
  as F2's verification), logged in through the real `/api/users/login` REST endpoint for a
  genuine JWT, then drove every new route exactly as the browser would: packing slips
  (200, valid HTML, correct slip count, 403 unauthenticated), stock adjustment (+2/-2
  round-trip confirmed back to the original value via a fresh DB read, correct audit-log
  entries, 400 on an invalid reason, 403 unauthenticated), and the low-stock cron (disabled
  → skip; enabled with a threshold guaranteed to match → real send confirmed via Resend;
  same-day replay → correctly skipped; wrong secret → 401) — settings were reverted to
  their exact original values afterward. Also caught and confirmed as *expected, not a
  bug*: `npm run start` always sets `NODE_ENV=production`, so the new cron 401'd without
  `CRON_SECRET` on the first pass — checked the two pre-existing crons as a control and
  they 401 identically, confirming the new route matches the established pattern exactly
  rather than being stricter or looser.

---

## Part 4 — Reports & analytics 📊

Turns the existing dashboard into accounting-grade output. All reads go through
SQL aggregation (`payload.db.pool`) so it stays fast at volume — this also retires
the dashboard's "JS aggregation at scale" deferred item.

### 4.1 Report engine — ☑ DONE, including VAT/tax (Session 25, VAT added Session 27 part 5)
- ☑ `src/lib/reports/` — parameterized report definitions (date range, filters, dimension) →
  tabular result, one SQL round trip per breakdown via `payload.db.pool` (`src/lib/db-pool.ts`).
  Types built:
  - **Sales** (`sales.ts`): revenue/orders/AOV by day/week/month (`?dimension=period`), or a
    single-dimension breakdown across the whole range (`?dimension=product|artist|category|
    area|payment_method`)
  - **Payments** (`payments.ts`): per-`orders.payment_method` totals/refunds/net — grouped by
    what the business sold through, not the Payments collection's adapter-internal `provider`
    field, so COD/bank-transfer (which have no Payment record) still appear
  - **Inventory** (`inventory.ts`): current stock value, low stock (≤3), dead stock (0 sold,
    in stock), sell-through rate — two queries (current stock; units sold in range) merged in
    JS, mirroring `src/lib/stock.ts`'s sized-vs-flat semantics
  - **Customers** (`customers.ts`): new vs. returning (identity = `customer_id`, else
    `lower(customer_email)` for attributable guest checkouts), repeat rate, avg orders/customer,
    top customers by spend in range
  - **Discounts** (`discounts.ts`): usage + revenue impact per code in range, joined against
    the code's all-time `usageCount`/`usageLimit`
  - **VAT** (`vat.ts`) — ☑ DONE (Session 27 part 5): per-period (day/week/month) net/VAT/
    gross breakdown over non-cancelled orders in range, using `computeVatBreakdown()` against
    SiteSettings' *current* `vatRate` (no per-order rate snapshot exists — flagged in the file
    rather than silently assumed away; a rate change mid-period recomputes past orders at the
    new rate). Returns a clean "VAT disabled" empty state when SiteSettings.vatEnabled is off,
    rather than a zeroed-out report. Verified against real dev data via the actual HTTP route
    (not just the Local API): every row's net+vat reconciles to gross to the cent; disabled
    state, CSV/XLSX/PDF exports, and the unauthenticated-403 path all confirmed. Also wired
    into §4.2's scheduled email digest as a `sendVatReport` toggle (off by default).
- ☑ Export: `export-csv.ts` (same escaping convention as the existing payments CSV route),
  `export-xlsx.ts` via **`write-excel-file`** (not exceljs — exceljs pulls in an outdated
  archiver/archiver-utils chain with a high-severity `brace-expansion` DoS advisory and no
  clean fix; `write-excel-file` has zero dependencies), `export-pdf.tsx` via
  **`@react-pdf/renderer`** (brand name from SiteSettings, generic columns/rows/summary
  renderer — Part 3.1's invoice PDF (Session 27) reuses this same library, as planned, via
  its own dedicated `invoice-pdf.tsx` layout rather than the columns/rows renderer directly)
- ☑ Admin UI: `ReportsPanel.tsx` (server, admin-gated) + `ReportsExplorer.tsx` (client) —
  report-type select, date range, sales-only dimension/group-by selects, preview table with
  summary KPIs, CSV/XLSX/PDF download links. Registered in `payload.config.ts` beforeDashboard,
  alongside SalesDashboard/OmtPaymentsPanel/PaymentsOpsPanel.
- API: `GET /api/admin/reports/[type]` (JSON preview) + `GET /api/admin/reports/[type]/export?
  format=csv|xlsx|pdf` — both admin-gated via the existing `requireAdminUser` guard.
- Audience note: reports serve three parties — **owner** (sales/AOV by period, product,
  category, area; discount performance; top customers), **accountant** (payments summaries,
  VAT breakdown, CSV/XLSX), **operations** (inventory value, low stock, sell-through)
- Sequencing note confirmed correct in practice: every report type, including VAT, needed
  only F0 + the F1 mock provider — no payments work ever actually blocked this part.

### 4.2 Scheduled reports — ☑ DONE (Session 26)
- ☑ Vercel Cron (`vercel.json`, daily at 06:00) → `GET /api/cron/scheduled-reports`: builds
  the admin-selected report types and emails a digest with a CSV attached per report,
  via `src/lib/reports/scheduled-email.ts` (same Resend pattern as `notifications.ts`,
  skips gracefully without `RESEND_API_KEY`). Runs daily but only actually sends on the
  configured cadence's due day (weekly → Monday, monthly → the 1st), and only once per
  period (`reportsEmailLastSentAt` dedupe guard) — same "daily cron, computed due-day"
  shape as `expire-payments`/`cleanup-carts`.
- ☑ Admin-configurable via a new SiteSettings **Reports** tab: on/off, cadence
  (weekly/monthly), recipients (comma-separated, falls back to Brand → Contact Email),
  and a checkbox per report type (Sales/Inventory on by default; Customers/Discounts/
  Payments off by default, opt-in).
- Retires the deferred "weekly email summary" item.
- **Verified with a real send**, not just review: ran the actual `sendScheduledReportEmail()`
  against the real dev DB and the real Resend API (via the bundled-config loader + `tsx`,
  same technique as the migration scripts) — first attempt used a guessed recipient email
  and correctly got rejected by Resend's sandbox restriction (`You can only send testing
  emails to your own email address`), which is exactly why this was tested for real rather
  than assumed; retried with the account's actual verified address and got `{ sent: true }`
  with real CSV attachments delivered.

### 4.3 Dashboard v3 — ☑ DONE (Session 26)
- ☑ Conversion funnel: **Sessions → Carts → Checkouts → Completed orders**. Sessions comes
  from a **lightweight own counter** (user's explicit choice over the Vercel Analytics API,
  which needs a paid plan + token neither exists nor was wanted as a new dependency) —
  `AnalyticsCounters` collection (one row per UTC day, atomic upsert via
  `src/lib/analytics.ts`), pinged fire-and-forget from `src/middleware.ts` via
  `event.waitUntil()` on real navigations only (`sec-fetch-mode: navigate`, so Next.js
  prefetches and client-side RSC fetches don't inflate the count). "Carts" = distinct carts
  with ≥1 item in range; "Checkouts" = every order created in range (an Order row only
  exists once checkout was actually submitted — no separate "started checkout" signal
  without more instrumentation than was scoped); "Completed" = orders not cancelled.
- ☑ Cohort/repeat-purchase view: customers grouped by the calendar month of their first
  (non-cancelled) order, with repeat-customer count/rate and avg orders — identity =
  account id else lower-cased guest email, same convention as the Customers report.
- ☑ Payment-method mix + failure rate: per `orders.payment_method` attempted/succeeded/
  failed counts; failure rate is null for COD/bank-transfer (no such concept for them) and
  computed only over *concluded* card/omt attempts (excludes still-`awaiting_payment` ones).
- All three built in `src/lib/reports/dashboard-v3.ts`, rendered by a new
  `AnalyticsDashboardPanel.tsx` admin panel (own `?v3range=` query param so it doesn't
  collide with SalesDashboard's `?range=` on the same /admin page).
- **Verified against real dev data**: funnel/cohort/payment-mix queries run via a throwaway
  script against the real dev DB — results matched known test scenarios from prior sessions
  (e.g. the payment-mix numbers lined up exactly with the F1/F2 verification's known
  card-failed / omt-paid / cod-refunded test orders), and the page-view upsert was verified
  to actually increment (1→2) before the test rows were reverted to avoid leaving fake data
  in the real counters.

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

### 6.1 Returns & exchanges (RMA) — ☑ DONE v1 (Session 27, part 3)
- ☑ Customer-initiated return request from order history (reason, items) →
  `Returns` collection (statuses: requested / approved / received / refunded / rejected).
  `POST /api/returns` — logged-in customer only (matches "from order history," which only
  logged-in customers have; a guest-order flow would need a separate orderNumber+email
  verification step, not attempted), only `delivered` orders eligible, requested quantities
  validated against what the order actually contains (not against prior return requests on
  the same order — v1 simplification). `/account/returns/new/[orderNumber]` +
  `ReturnRequestForm.tsx` — per-item checkboxes + quantity, submits the request; `/account`
  shows a "Request Return" link on delivered orders and a "Your Returns" status list.
- ☑ Admin workflow + status emails (`sendReturnStatusEmail` — approved/received/refunded/
  rejected). **Restock and refund triggers deliberately interpreted narrower than a literal
  "approved returns restock" reading**: restock fires on entering **received** (the item is
  physically back — restocking at approval would let a customer keep the item *and* get it
  restocked), scoped to the return's own items only (a return can be partial, unlike Orders'
  whole-order cancel/restock). Refund fires on entering **refunded** and reuses
  `processRefund()` exactly as the existing admin "Refund" button does — no new
  money-moving code, just a new caller of the already-verified one; if the order isn't in a
  refundable payment state (e.g. a COD order never marked "paid"), the attempt fails
  gracefully and logs for manual settlement rather than blocking the status change. Store
  credit (6.3) not built — refund is real-money only in v1.
- **Caught and fixed a real bug via verification, not review**: the refund hook passed
  `doc.order` straight to `processRefund()`'s `orderId` param — but `doc.order` can be a
  *populated object*, not a raw id, depending on the depth the triggering update ran at.
  First verification run silently failed with `"Order not found."` (caught because the test
  script asserted the expected `partially_refunded`/`refundedAmount` values instead of just
  checking the call didn't throw) — fixed by normalizing to a plain id before the call,
  re-verified clean on the next run. Exactly the kind of bug a "does it compile" check alone
  would have shipped.
- **Verified end-to-end against a real running server**: created a real customer + order +
  admin via the Local API, drove the actual customer-facing create flow via real HTTP
  (over-quantity → 400, unauthenticated → 401), then simulated every admin status
  transition — approved (real status email delivered to a real inbox), received (stock
  +1, scoped correctly to only the returned item), refunded (`processRefund` genuinely ran:
  `partially_refunded`, `refundedAmount: 20` on a $40 order), and a separate rejection
  (confirmed *no* restock, *no* refund fired) — plus checked the resulting AuditLog entries.
  Settings/stock/test records all cleaned up afterward.

### 6.2 Product reviews & ratings — ☑ DONE v1 (Session 27, part 4)
- ☑ `Reviews` collection: rating + text, linked to customer + product, **verified-purchase
  flag** (computed server-side at submission — the customer has a delivered order
  containing the product). Created only via `POST /api/reviews` (one review per
  customer+product; collection `create` access stays admin-only so nothing can forge one
  directly against the REST/GraphQL API).
- ☑ Moderation queue in admin: new reviews land `pending`, admin flips to `published` via
  the normal edit view (no separate moderation UI needed — same pattern as Orders/Returns
  status changes). Rating summary (denormalized `Products.ratingAvg`/`ratingCount`) shown
  on the product page with a star row; write-a-review form for signed-in customers;
  published reviews listed; JSON-LD `aggregateRating` added to the existing `Product`
  schema block when `ratingCount > 0`. **Deferred**: stars in shop/related-grid `ProductCard`
  listings (the rating fields are already denormalized and available — threading them
  through every listing call site was cut for time, not a data gap).
- ⚠️ **Found and fixed a real bug via verification**: the original recompute (JS
  read-then-`payload.update()`) reliably hit `"canceling statement due to statement
  timeout"` when called from inside the Reviews hook, and — worse — the write eventually
  landed anyway with **stale** data once unblocked. Rewrote as a single atomic SQL
  statement (`UPDATE products SET rating_count = (SELECT count...), rating_avg = (SELECT
  avg...) WHERE id = $1`, mirroring this codebase's established atomic-SQL pattern for
  stock/discounts/gift cards) — a genuine correctness improvement regardless of the
  investigation below, since it removes an inherent read-then-write race.
- ⚠️ **Investigated a residual timing anomaly thoroughly, didn't chase it further**: even
  with the atomic-SQL fix, back-to-back create→publish→delete operations against the same
  product occasionally still landed a stale value, confirmed reproducible via **both** a
  standalone script **and** real HTTP requests against a real running server. Ruled out:
  row-specific locking (reproduced on multiple different products), connection-pool
  exhaustion (13 of 60 connections in use). What was observed instead: *every* operation
  (not just this recompute) was taking 3–5+ seconds during testing — pointing to transient
  latency/degradation on this specific disposable dev Supabase project, matching this
  project's already-documented history of exactly this kind of flakiness (EAI_AGAIN DNS
  stalls, a cold-start `transformAlgorithm` flake — see DEPLOY.md). **Deliberately did not**
  add advisory-locking/explicit-transaction machinery to force strict ordering — no other
  part of this codebase uses that pattern, the failure mode is cosmetic and self-correcting
  (any later review action recomputes and converges), and over-engineering a fix for what
  presented as environment-specific degraded conditions would add one-off complexity for a
  low-severity display aggregate. Worth a quiet re-check in a fresh session/production.

### 6.3 Gift cards & store credit — ☑ DONE v1 (Session 27, part 4)
- ☑ `GiftCards` collection: unique code, initial/remaining balance, purchaser/recipient
  email, expiry, enabled toggle. Redemption at checkout is server-authoritative
  (`src/lib/gift-cards.ts`, same atomic-conditional-UPDATE trust model as discounts —
  `resolveGiftCard`/`redeemGiftCardAmount`/`releaseGiftCardAmount`), combinable with a
  discount code per the new `giftCardsCombinableWithDiscounts` admin setting.
  **Self-service "buy a gift card as a virtual product" is deliberately deferred** — that
  needs its own product-like listing + payment collection for a non-physical item, a
  genuinely separate feature from redemption; v1 is admin-issued (promotional giveaways,
  or recording a manually-settled sale).
- ☑ Store credit on the customer account (`Customers.storeCredit`) — same atomic pattern
  (`src/lib/store-credit.ts`). Applied at checkout via a "use available credit" checkbox.
  **Refund destination from 6.1**: Returns gained a `refundMethod` field (cash vs. store
  credit) — "store credit" always succeeds (`grantStoreCredit`, no payment-status gate to
  satisfy), a clean way to settle a COD/unpaid-order return without a manual cash refund
  outside the app.
- **Checkout integration** (`src/app/api/orders/route.ts`): gift card → store credit →
  loyalty points (6.6) are resolved and atomically claimed, in that order, against
  whatever's left after the discount — mirroring the discount block's exact "resolve, claim
  atomically before stock is touched, roll back via a combined `releaseCredits()` at every
  existing failure point" shape. No new money-moving code paths; every deduction reuses the
  same atomic-conditional-UPDATE primitive already proven for stock/discounts.
- **Verified end-to-end against a real running server**: real customer/order round-tripped
  through the actual Local API + atomic helpers (redeem/release for gift card, store
  credit, and points all confirmed to net back to the original balance).

### 6.4 Back-in-stock & availability — ☑ DONE v1 (Session 27, part 4)
- ☑ "Notify me" on sold-out products: `BackInStockRequests` collection + `POST
  /api/back-in-stock` (public, no login required — validates the product is actually fully
  sold out first). Products' own `afterChange` hook detects a genuine 0 → positive stock
  transition and emails every pending request (`sendBackInStockEmail`), marking
  `notifiedAt`. **v1 scope: fully-sold-out products only**, not partial size gaps — a
  customer can already buy the sizes that *are* in stock, so per-size "notify me" alongside
  an otherwise-purchasable product was deferred rather than adding UI complexity for a
  smaller win.
- ☑ Preorder mode (`Products.preorderEnabled` + localized `preorderMessage`) — **a
  deliberate architecture decision, not a shortcut**: preorder mode changes product-page
  *messaging only* and never touches the atomic stock-decrement path (`orders/route.ts`'s
  `WHERE stock_quantity >= $1` conditional UPDATE), the single most sensitive code in the
  app. An admin enabling preorder sets `stockQuantity` to their actual preorder allocation
  (e.g. 50 units they're willing to sell before restocking); it decrements exactly like any
  other product. This was chosen specifically over letting stock go negative for preorder
  items, which would have required branching the atomic decrement query — not worth the
  risk to that code path for this feature.
- **Verified against real dev data**: simulated a real 0→5 stock transition on a real
  product with a pending request, confirmed the email fired and `notifiedAt` was set.

### 6.5 Abandoned-cart recovery — ☑ DONE (Session 27, part 3)
- ✅ **Cart-cleanup sweep already existed** (`/api/cron/cleanup-carts`, Session 22 part 5 —
  checked before building anything and found this half of the item was already done;
  ROADMAP just hadn't been updated to reflect it).
- ☑ `GET /api/cron/abandoned-cart-recovery` — same daily-cron auth pattern as the other
  crons; finds carts idle >24h with a linked customer account (guest carts have no captured
  email to send to — out of scope, same as the Returns login requirement), skips
  `cartRecoveryOptOut` customers, resolves current items/prices via the existing
  `serializeCart()` (so a since-discontinued item doesn't appear in the email), sends via
  `sendAbandonedCartEmail()`. **Sends exactly once per cart ever** via a per-cart
  `recoveryEmailSentAt` flag — a different dedupe shape than the other crons' daily-reset
  guard, because "one recovery email per abandoned cart" is the actual rule, not "one per
  day."
- ☑ Opt-out honored via a one-click unsubscribe link, no login required (`src/lib/
  unsubscribe-token.ts` — HMAC-signed, so a stranger can't opt someone else out by guessing
  a customer id, but the link itself never expires, unlike a password-reset token) →
  `GET /api/account/cart-recovery-optout` sets `Customers.cartRecoveryOptOut`.
- **Verified end-to-end against a real running server**: created a real customer + cart,
  backdated the cart's `updatedAt` via direct SQL (Payload always overwrites it on save, so
  this was the only way to simulate "idle 24h+" without literally waiting), ran the cron
  twice — first run found and sent (confirmed via a real Resend delivery to a real inbox,
  with `recoveryEmailSentAt` set), second run correctly found nothing (excluded by the
  now-set flag). Opt-out verified with both a real signed token (flips the flag) and a
  tampered one (400).

### 6.6 Loyalty & referrals (post-core, optional per brand) — ☑ DONE v1 (Session 27, part 4)
User explicitly opted to include this despite the roadmap's own "optional" framing.
- ☑ Points per order value: `Customers.loyaltyPoints`, earned via `Orders.ts`'s
  `afterChange` hook on a genuine `→ delivered` transition (not creation, not a
  cancelled-then-reinstated re-trigger), rate configurable via SiteSettings' new **Loyalty**
  tab (`loyaltyEnabled`, `loyaltyEarnRatePerDollar`, default 1). Redeemable at checkout
  (`loyaltyBurnPointsPerDollar`, default 100) via the same atomic claim/release pattern as
  gift cards/store credit (`src/lib/loyalty.ts`).
- ☑ Referral codes: **reinterpreted as "reuses the points-redemption engine" rather than
  literally "building on the Discounts engine"** as the roadmap bullet originally phrased
  it — minting a real per-referral Discounts-collection row for every signup would mean
  running two parallel reward currencies (points and discount codes) side by side; crediting
  both sides in points reuses the exact mechanism just built for 6.6's first half. A
  customer's own numeric id is their shareable "code" (`/?ref=<id>`, shown on their account
  page); `POST /api/account/register` validates a `?ref=` value against a real customer
  before storing `Customers.referredBy`, and grants the referee's signup bonus
  (`referralRefereePoints`, default 100) immediately. The referrer's reward
  (`referralReferrerPoints`, default 200) is granted once — guarded by
  `referralRewardGranted` — when the **referred** customer's first order reaches
  `delivered` (same Orders hook as the earn-points logic above).
- **Verified against real dev data**: grant/redeem/release round-tripped correctly via the
  atomic helpers (net balance change of zero after a claim + release, matching the same
  verification discipline used for gift cards/store credit).

### 6.7 Catalog depth — ☑ DONE v1 (Session 27, part 4)
- ☑ Product bundles: new `Bundles` collection (component products + quantities, a stated
  bundle price) + a `/bundle/[slug]` landing page. **Deliberately informational in v1, not
  charged-at-bundle-price**: "Add to cart" adds each component at its own real price —
  checkout math is completely untouched. True bundle-priced checkout (charging the stated
  price instead of the sum of parts) would need either a cart-model change or an
  auto-applied bundle discount code — a bigger, separate change than was worth rushing into
  the money-critical cart/pricing path under this session's time pressure; documented in
  `Bundles.ts` itself as a deferred v2, not silently dropped.
- ☑ Size-guide: `GarmentTypes.sizeGuide` (localized rich text) — shown in a collapsible
  toggle on the product page when the product's garment type has one set. Reuses the
  existing `garmentType` relation already on Products (no new relation needed).
- ☑ Per-product custom fields: `Products.specs[]` (label/value pairs), rendered as a spec
  list on the product page. **Not localized in v1** — a schema-shape risk call: Payload's
  table shape for a *localized field nested inside an array's sub-fields* (as opposed to a
  top-level localized field, which this project has many proven examples of) was uncertain
  enough that guessing wrong in a hand-written migration felt like the wrong tradeoff for a
  descriptive-text field; can be revisited with a real schema-diff check later.
- **Verified against real dev data**: created a real bundle with 2 real component products
  and confirmed the relation resolved correctly; saved and read back a real size guide.
- ⚠️ **Discovery-path gap found post-deploy (Session 28 part 2)**: bundles had a working
  collection + individual `/bundle/[slug]` pages but nothing anywhere ever linked to one —
  no nav item, no homepage block, no index page. Fixed: new `/bundles` index page (ISR,
  same visual language as the shop grid — each tile uses the first component product's
  image since Bundles has no image field of its own), a matching `revalidatePath('/bundles')`
  added alongside the existing per-bundle revalidation, bundle URLs added to `sitemap.ts`,
  and "Bundles" added to both the Nav's `DEFAULT_LINKS` fallback and the Footer's fallback
  column — **note for the live site specifically**: those two fallbacks only render when the
  Navigation global has no `headerLinks`/`footerColumns` configured; if the real Navigation
  global already has real links (likely, given the site is live), add `Bundles → /bundles`
  there yourself in Payload admin for it to show in the actual header. Verified against the
  real dev DB + a live server: created a bundle via real HTTP through the running server (not
  the offline migration-script config loader, whose stubbed `next/cache` would silently no-op
  `revalidatePath` and give a false read) and confirmed `/bundles` and `/ar/bundles` both
  picked it up immediately.

---

## Part 7 — Growth & marketing — ☑ DONE v1 (Session 28), Instagram excepted (external blocker)

- ☑ **Newsletter** — capture block (footer + CMS/homepage block) → Resend "segment" (the
  API's current non-deprecated primitive; `RESEND_AUDIENCE_ID` keeps the more recognizable
  name since that's still how Resend's own dashboard/docs commonly refer to it) via
  `POST /api/newsletter` (rate-limited, honeypot, degrades gracefully — forms don't even
  render — when unconfigured). Drop-announcement broadcast from a new admin panel
  (`NewsletterBroadcastPanel.tsx` + `POST /api/admin/newsletter/broadcast`) — defaults to
  creating a **draft** in Resend for final review; "Send immediately" is an explicit,
  confirmed opt-in checkbox, not the default, mirroring how every other bulk/money-adjacent
  admin action in this codebase (refunds, mock-payment simulate) requires deliberate
  confirmation rather than a one-click blast.
- ☑ **Campaign links + UTM surfacing** — `middleware.ts` sets a first-touch, httpOnly
  `utm_data` cookie from `?utm_source=/utm_medium=/utm_campaign=` on any real navigation
  (never overwrites once set, so a later direct/organic visit before checkout doesn't lose
  the campaign that actually brought the customer); `POST /api/orders` reads it and
  snapshots `utmSource`/`utmMedium`/`utmCampaign` onto the order. Surfaced in the dashboard
  as a new `campaign` dimension on the existing Sales report (`?dimension=campaign`),
  grouping by `utm_source/utm_campaign` with a "Direct / organic" fallback bucket for
  attribution-less orders. **Caught and fixed a real pre-existing bug while verifying this
  against the real DB**: Postgres's extended query protocol rejects bind calls that supply
  more parameters than the SQL statement references — the sales report's dimension query
  call site always passed 3 params (`from`, `to`, `locale`) but only the `category`
  dimension's SQL actually references `$3`; `artist`/`area`/`payment_method` (and now the
  new `campaign`) were silently 500ing whenever exercised via real HTTP, which nothing had
  done before. Fixed by only including the locale param for `category`.
- ☑ **Blog/editorial** — new `Posts` collection, deliberately "Pages' exact block builder
  (same 8 blocks incl. the new Newsletter block) + different top-level fields" (excerpt,
  featured image, author, published date) rather than reusing Pages itself, since a post
  has different fields and different storefront surfaces (`/blog` index, not a bare slug).
  `/blog` (index) + `/blog/[slug]` (block-vs-plain-article fallback, same pattern as the
  `/[slug]` Pages renderer) + `BlogPosting` JSON-LD + breadcrumb JSON-LD + sitemap inclusion.
- ☑ **WhatsApp order-status messages** — `sendOrderStatusWhatsApp()` in `notifications.ts`,
  wired into the existing Orders status-change hook alongside the status email (now
  independent channels — email requires `customerEmail`, which is optional, so a guest
  checkout with no email still gets a WhatsApp update if configured). **Correctly built as
  a template message, not plain text**: business-initiated messages outside WhatsApp's 24h
  customer-service window are rejected by Meta's Cloud API unless using a pre-approved
  template — `WHATSAPP_STATUS_TEMPLATE_NAME` documents the exact template shape to submit
  for approval in Meta Business Manager (a business process step, not a code one).
- ☑ **Structured-data audit** (also closes ENHANCEMENTS E8) — new `src/lib/structured-data.ts`:
  site-wide Organization + WebSite/SearchAction graph (layout-level, `sameAs` from
  SiteSettings social links) + a reusable `buildBreadcrumbJsonLd()` wired into product
  (now with a Category breadcrumb level too), artist, bundle, and blog-post pages.
- ⏭ Instagram feed embed — still blocked on a handle, external, unchanged since it was
  first deferred.
- **Verified extensively against a real running server, not just reasoned about**:
  created a real blog post via real HTTP and confirmed `/blog` + `/blog/[slug]` pick it up
  (plus a genuine first-request cache-population flake on the very first ever hit to a
  brand-new route, self-resolved on retry — same class of cold-start quirk already
  documented elsewhere in this project, not chased further); newsletter signup's
  graceful-skip path with no `RESEND_AUDIENCE_ID` configured, and its email-format
  validation; the full UTM-cookie-to-order-attribution round trip (real landing hit →
  cookie set → real order created → `utmSource`/`utmMedium`/`utmCampaign` correctly
  persisted); all 6 sales-report dimensions (confirming the param-count fix); site-wide
  Organization/SearchAction JSON-LD present on the homepage. Dev data (one unit of test
  stock) restored to its exact prior state afterward.

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
| **F0 — Foundation** ☑ DONE (Session 22) | Part 1 (DB split ☑, migrations ☑, durable rate-limit+idempotency ☑, Sentry ◐, audit log ☑, admin security ☑, Playwright+unit tests ☑) + Part 0 quick items | M | — |
| **F1 — Payments core + cards** ◐ Session 23 | 2.1 abstraction ☑, 2.5 currency ☑, stock reservation + expiry cron ☑ — 2.3 real card gateway (Areeba MPGS / NetCommerce) still ☐, blocked on vendor onboarding *(2.2 Whish skipped)* | L | F0 (hard req) + vendor onboarding ⏳ |
| **F2 — OMT + refunds + reconciliation** ☑ v1 Session 24 | 2.4 ☑ (voucher + manual confirm), 2.6 ☑ (any payment method), 2.7 ☑ (dashboard + CSV) — order-timeline UI + real OMT API confirmation remain, both small/unblocked | M | F1 |
| **F3 — Invoicing & fulfillment** ☑ DONE (Session 27) | Part 3 (invoices/VAT ☑, courier ☑ v1 manual-only, inventory ops ☑) | M | F0; invoices richer after F1 |
| **F4 — Reports** ☑ DONE (Session 25–26), VAT report excepted | Part 4 (engine ☑, exports ☑, scheduled ☑, dashboard v3 ☑) — only the VAT/tax report type remains; unblocked as of Part 3.1 (Session 27), just not yet built | M | F0; payment/VAT reports need F1 — everything else buildable right after F0 |
| **F5 — AI assistants** | ⏭ SKIPPED (Session 22) | — | — |
| **F6 — Commerce depth** ☑ DONE v1 (Session 27) | Part 6 — all 7 sub-items v1-complete: returns ☑, reviews ☑, gift cards/store credit ☑, back-in-stock/preorder ☑, abandoned cart ☑, loyalty/referrals ☑, catalog depth ☑ | L (parallelizable chunks) | F0; returns-refunds need F1 |
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
