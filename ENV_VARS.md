# Environment Variables Reference

> Companion to `.env.local.example` (the file you actually copy) — this is the
> narrative reference: what each variable does, whether it's required, and
> what breaks if it's missing. Written with an eye toward ROADMAP.md Part 8
> (productization — selling this to other brands): each client gets their own
> deploy with their own values for everything in this file except the CI
> secrets. When `ONBOARDING.md` gets written, it should link here rather than
> duplicate this table.
>
> Scope: this covers app-runtime env vars only. Feature *behavior* that's
> configurable from the CMS (delivery zones, brand copy, color scheme, payment
> method toggles, etc.) lives in Payload admin → Site Settings, not here — see
> CLAUDE.md's "Environment Variables Needed" section for the historical list
> and the Site Settings globals for what's actually CMS-driven today.
>
> Verified against the real codebase (`grep -r "process.env\."`) on 2026-07-31,
> not just copied from `.env.local.example` — two stale entries that file had
> (`PAYLOAD_PUSH`, `NEXT_PUBLIC_CART_KEY`) don't correspond to anything the
> code actually reads and have been corrected/removed there too.

---

## Required — the app will not boot or build without these

| Variable | What it's for | What breaks without it |
|---|---|---|
| `PAYLOAD_SECRET` | Payload's encryption/signing secret (sessions, JWTs) | Throws on boot in production (deliberate — `payload.config.ts` refuses to start with no secret set). Dev falls back to an insecure hardcoded value — fine locally, never acceptable in production. **Generate a new random value per deployment** (`openssl rand -hex 32`), never reuse across dev/prod/clients. |
| `DATABASE_URI` | Postgres connection string (Supabase pooler, port 6543) | Nothing works — this is the database. `next build` also fails: product/artist/page pages are statically generated and need a live DB connection at build time. |

---

## Required for a working storefront (uploads, images)

Technically optional — the app boots without them and falls back to storing
uploads on local disk — but that's not viable on Vercel (ephemeral filesystem,
uploads vanish on every deploy). Treat as required for any real deployment.

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public base URL for the Supabase project serving images (same project as `DATABASE_URI`, or a dedicated storage project) |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | Public bucket name (default `products`) — must exist and be marked **Public** with a CORS rule allowing `PUT` from your site's origin (client-direct uploads bypass Vercel's ~4.5MB request-body limit) |
| `SUPABASE_S3_ENDPOINT` | S3-compatible endpoint — Supabase → Project Settings → Storage → S3 Connection |
| `SUPABASE_S3_REGION` | e.g. `eu-central-1` |
| `ACCESS_KEY_ID_SUPABASE` | S3 access key (same S3 Connection panel) |
| `SECRET_ACCESS_KEY_SUPABASE` | S3 secret key — **never** prefix this with `NEXT_PUBLIC_` |

If all four `SUPABASE_S3_*`/`*_SUPABASE` vars are unset, the `s3Storage` plugin
disables itself cleanly (`payload.config.ts` checks for their presence) — the
app still boots, uploads just go to local disk. This is a real footgun if the
four vars are set in Vercel but *not* locally (or vice versa): the runtime
schema differs slightly (a `media.prefix` column only exists when the plugin
is active), which caused a real production incident once — see CLAUDE.md
Session 21. Keep dev and prod either both-configured or both-unconfigured.

---

## App identity

| Variable | What it's for | Default if unset |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL — drives `metadataBase`, sitemap, robots.txt, OG/Twitter card URLs | `http://localhost:3000` (deliberately *not* the trackID.lb production domain, so a fresh clone isn't silently mis-branded) |

---

## Email (Resend) — order confirmations, password resets, status updates

| Variable | What it's for |
|---|---|
| `RESEND_API_KEY` | From resend.com — without it, every email send is skipped with a console warning (orders/checkout still work, no email arrives) |
| `RESEND_FROM` | Sender address. Use `onboarding@resend.dev` for testing (only delivers to your own Resend account email); switch to a verified-domain address (e.g. `orders@yourbrand.com`) once that domain is added + verified in the Resend dashboard |
| `RESEND_AUDIENCE_ID` | (ROADMAP Part 7) Id of a Resend Audience/Segment — newsletter signups get added to it, and the admin broadcast panel sends drop announcements to it. Unset = the newsletter capture forms (footer + optional homepage/page block) and the admin broadcast panel don't render at all — not a broken feature, just off |

---

## WhatsApp Cloud API — staff alerts + customer order confirmation + status updates

`WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` are shared by all three
features below; each feature additionally needs its own destination/template
setting. **All three message types are business-initiated and must use an
approved template** — confirmed for real (2026-08-24): a plain free-text
staff alert was rejected by Meta with error 131047 ("Re-engagement message
... more than 24 hours have passed since the customer last replied to this
number") the first time this was tested against a recipient with no open
session. The 24h "customer service window" exception only applies when the
recipient messaged the business first within the last 24h — not a safe
assumption for an alert that must fire reliably on every order.

| Variable | What it's for |
|---|---|
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | The Cloud API phone number ID sending the message |
| `WHATSAPP_RECIPIENT_NUMBER` | Staff number to notify on new orders, international format (e.g. `+9611234567`) |
| `WHATSAPP_ORDER_ALERT_TEMPLATE_NAME` | Name of an **approved** template (Utility category) used for the staff new-order alert. Deliberately short — the full itemized order lives in admin, this just pings staff to go check it: `"New order {{1}} from {{2}} — total ${{3}}. Check the admin dashboard for full details."` ({{1}} = order number, {{2}} = customer name, {{3}} = total, 2 decimals). Unset = feature off (silent no-op). |
| `WHATSAPP_ORDER_ALERT_TEMPLATE_LANG` | Template language code (default `en`) |
| `WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_NAME` | Name of an **approved** template (Utility category) sent to the *customer* right when their order is placed (immediately for COD/bank-transfer, once payment confirms for card/OMT): `"Hi {{1}}, thank you for your order! We've received order {{2}} — total ${{3}} — and it's being processed. We'll message you here with updates."` ({{1}} = customer name, {{2}} = order number, {{3}} = total, 2 decimals). Unset = feature off. |
| `WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_LANG` | Template language code (default `en`) |
| `WHATSAPP_STATUS_TEMPLATE_NAME` | Name of an **approved** template used to message the *customer* on later order-status changes (confirmed/shipped/delivered/…). Body: `"Update on your order {{1}}: {{2}}."` ({{1}} = order number, {{2}} = status). Unset = feature off. |
| `WHATSAPP_STATUS_TEMPLATE_LANG` | Template language code (default `en`) |

Submit all three template bodies for approval in Meta Business Manager →
WhatsApp Manager → Message Templates (category **Utility** — faster review,
no marketing opt-in required since these are transactional). Each is
independent — activate them as they get approved rather than waiting for
all three; unset ones simply stay silent no-ops.

---

## Payments (ROADMAP F1/F2)

See `SiteSettings` → Commerce tab for the matching CMS-side toggles
(`cardPaymentsEnabled`, `omtPaymentEnabled`, `omtInstructions`,
`currencyDisplayMode`, `exchangeRate`) — these env vars are the deploy-time
half; **both** an env var and its Site Settings checkbox must be satisfied
before Card or OMT ever appears at checkout. This redundancy is deliberate: a
mis-set admin toggle alone can never turn on a payment method before it's
actually confirmed ready (Areeba/OMT/Whish).

| Variable | What it's for | Default |
|---|---|---|
| `ONLINE_PAYMENTS_ENABLED` | Master switch for Card + OMT — must be `true` for either to ever appear or process | **On** in development, **off** in production unless explicitly set |
| `ALLOW_MOCK_PAYMENTS` | Additionally required (on top of the above) to exercise the testing "Mock" card provider outside development (e.g. a Vercel preview deploy) | On in development, off in production unless set |
| `MOCK_PAYMENT_SECRET` | HMAC secret signing the mock provider's webhook payloads | Falls back to a fixed dev-only value if unset — fine since the mock provider itself is gated off in production by default |
| `PAYMENT_RESERVATION_MINUTES` | How long stock stays reserved on an unpaid card order before the expiry cron releases it | `45` |
| `OMT_RESERVATION_HOURS` | Same, for OMT vouchers (a branch visit takes far longer than a card session) | `48` |

**Not yet needed** (no adapter exists to configure): Areeba/NetCommerce API
keys, real OMT merchant credentials, Whish credentials. When any of these get
built, they'll follow the same pattern — provider-specific env vars gated by
the same `ONLINE_PAYMENTS_ENABLED` switch.

---

## Cron & security

| Variable | What it's for |
|---|---|
| `CRON_SECRET` | Protects `/api/cron/*` routes (abandoned-guest-cart cleanup, online-payment expiry sweep — see `vercel.json`) — any long random string. Vercel automatically signs its own scheduled invocations with this value as a Bearer token once set; without it, the cron routes 401 in production (they're open in development for easy manual testing). |

---

## Error monitoring (Sentry) — fully optional

Zero build/runtime cost when unset (verified — bundle sizes are identical
with/without, see CLAUDE.md Session 22 part 7 for how much work went into
guaranteeing that).

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | From a Sentry project → Project Settings → Client Keys. Unset = error monitoring entirely off. |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Optional, only for source-map upload (readable stack traces instead of minified ones). Auth token needs the `project:releases` scope. |

---

## Schema / migrations (dev-only concern — never set in production)

| Variable | What it's for |
|---|---|
| `PAYLOAD_MIGRATE` | Set to `true` to opt a **dev** run into migration-only mode instead of the default fast-iteration schema auto-push. Production always ignores this and is migration-only unconditionally — see `MIGRATIONS.md`. |

---

## Seed script (local/demo convenience, optional)

| Variable | What it's for |
|---|---|
| `SEED_SECRET` | Required in production for `/api/seed` to accept requests at all (open in development). Pass via `x-seed-secret` header or `?secret=`. |
| `SEED_URL` | Overrides the target base URL for `npm run seed` if not `localhost:3000` |
| `SEED_RESET` | Set to `1` as an alternative to `npm run seed -- --reset` — wipes the catalog (products/artists/categories/pages) before reseeding |

---

## White-label

| Variable | What it's for | Default |
|---|---|---|
| `NEXT_PUBLIC_STORE_NAME` | Admin panel's browser-tab title suffix — can't come from the CMS because the admin shell loads before the database is reachable | `trackID.lb` |

Every other white-label knob (store name shown to customers, logo, colors,
fonts, copy, delivery zones, etc.) is CMS-driven via Site Settings — this is
the *only* branding value that has to be an env var.

---

## CI-only secrets (GitHub Actions — not app runtime, not per-client)

Set once on the repo (Settings → Secrets and variables → Actions), always
pointed at a **disposable dev** database — the E2E suite places real test
orders through the real checkout API. See `DEPLOY.md` §5a for the full
rationale and rotation notes.

| Secret | Value |
|---|---|
| `CI_PAYLOAD_SECRET` | any string |
| `CI_DATABASE_URI` | dev project's pooler URL |
| `CI_SUPABASE_URL` | dev project's `NEXT_PUBLIC_SUPABASE_URL` |
| `CI_SUPABASE_STORAGE_BUCKET` | dev project's storage bucket name |
| `CI_SUPABASE_S3_ENDPOINT` / `CI_SUPABASE_S3_REGION` | dev project's S3 connection details |
| `CI_S3_ACCESS_KEY_ID` / `CI_S3_SECRET_ACCESS_KEY` | dev project's S3 keys |

---

## Framework-injected — never set these manually

`NODE_ENV` (set by Next.js/Vercel — many of the toggles above key off
`production` vs. not), `NEXT_RUNTIME` (set by Next.js per-bundle), `CI` (set
by GitHub Actions). Setting these by hand in `.env.local` will cause confusing
behavior — dev-only code paths (mock payments, schema auto-push, open cron
routes, open seed route) all assume `NODE_ENV` reflects reality.

---

## New-client deployment checklist (per ROADMAP Part 8)

For each new brand/client (own Vercel project + own Supabase project, per the
"per-client deploy" recommendation in ROADMAP.md):

1. **Required**: `PAYLOAD_SECRET` (new random value), `DATABASE_URI`
2. **Storage**: all six `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_S3_*`/`*_SUPABASE`
   vars, pointed at that client's own Supabase project + bucket
3. **Identity**: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_STORE_NAME`
4. **Email**: `RESEND_API_KEY` + a verified-domain `RESEND_FROM`
5. **Cron**: `CRON_SECRET` (any random string)
6. Everything else (WhatsApp, Sentry, payments) stays unset until that
   client actually needs it — every one of them degrades gracefully to "off"
   rather than breaking anything.
7. Set the Vercel **Build Command** to `npm run migrate && npm run build`
   (not the framework default) — see `DEPLOY.md` §4 and the incident writeup
   in CLAUDE.md Session 23 part 2 for why this step is easy to forget and
   what happens when it is.
