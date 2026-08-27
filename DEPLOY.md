# trackID.lb — Deploy Checklist (Vercel + Supabase + Resend)

> ⚠️ **trackID.lb is already live in production** at `https://trackid-lb.com` (domain cutover
> completed Session 29 — DNS, SSL, Resend sending domain all verified). This checklist was
> originally written for the *first* deploy and is kept as reference for future re-deploys
> (or, per ROADMAP Part 8, as the starting template for a new client's deploy) — most boxes
> below are already checked in practice for this specific deployment. For the live site's
> actual current status, see CLAUDE.md's session log, not this file.
>
> Work top to bottom. Boxes are ☐ until done.
> Stack: Next.js 15 + Payload 3 on Vercel · Postgres + Storage on Supabase · email via Resend.

---

## 0. Pre-flight (local)

- ☐ `npm run build` passes locally (verified Session 10 — keep it green before each deploy)
- ☐ Working tree committed; `.env.local` is gitignored and **not** committed (confirmed)
- ☐ You're deploying from a branch you can merge to `main` (currently on `General-UI-Enhancements`)

---

## 1. Supabase — database

You've been developing against **one** Supabase project, and Payload's dev server already pushed every table (products, media, orders, …) into it. If you point production at this **same** database, the schema is already there — no migration step needed for the first deploy.

- ☐ Decide: reuse the current Supabase project for prod (simplest), or create a separate prod project
  - If **separate prod project**: you must get the schema into it. Easiest path with this codebase — temporarily set your local `DATABASE_URI` to the prod DB and run `npm run dev` once (Payload pushes schema), then switch back. (Long-term: set up real Payload migrations.)
- ☐ Use the **pooler** connection string for `DATABASE_URI` (port `6543`, host `...pooler.supabase.com`) — required for serverless/Vercel. Do **not** use the direct `:5432` connection.
- ☐ Confirm an admin user exists (same DB = your existing dev admin works). If new DB, you'll create one at `/admin` on first load.

## 2. Supabase — storage (images)

- ☐ The bucket in `SUPABASE_STORAGE_BUCKET` (`products`) is set to **Public** (Storage → bucket → Settings). Image URLs are served straight from the public CDN.
- ☐ S3 access key still valid (Project Settings → Storage → S3 Connection). You'll put the keys in Vercel env (below).

## 3. Resend — email (order confirmations)

⚠️ Right now `RESEND_FROM=onboarding@resend.dev`, which **only delivers to your own Resend account email** — real customers will not receive order confirmations.

- ☑ Add and **verify your sending domain** in Resend (DNS records) — done for `trackid-lb.com` (Session 29): DKIM + SPF both verified
- ☑ Set `RESEND_FROM` to an address on that domain, e.g. `orders@trackid-lb.com`
- ☐ Set SiteSettings → `contactEmail` — it's now the reply-to on all order emails and shows in the footer (wired Session 20)

---

## 4. Vercel — project setup

- ☐ Import the GitHub repo into Vercel
- ☐ **Root Directory = `trackid-lb`** (the Next app is in a subfolder, not the repo root)
- ☐ Framework preset: **Next.js** (auto). **Override the Build Command to `npm run migrate && npm run build`** so committed migrations apply to prod before the build (prod never auto-pushes schema — see MIGRATIONS.md). `migrate` runs `scripts/migrate.mjs` (esbuild-bundled config — works on any Node, Session 20). Leave Output Directory default.
- ☐ Node version: leave Vercel's default.
- ☑ Add your domain (`trackid-lb.com`) under Project → Domains (point DNS per Vercel's instructions) — done Session 29. Note: GoDaddy's DNS records take priority over any "Domain Forwarding" setting — if you ever see the apex domain resolving to a `Server: cloudflare` response instead of `Server: Vercel`, check Forwarding is off, not just DNS Records.

## 5. Vercel — environment variables

Add each to **Production** (and Preview if you want preview deploys to work). Paste secrets from your `.env.local`.

| Variable | Value / note |
|---|---|
| `PAYLOAD_SECRET` | ⚠️ **Generate a NEW strong random value for prod** — don't reuse the dev string. (e.g. `openssl rand -hex 32`) |
| `DATABASE_URI` | Supabase **pooler** URL (port 6543) |
| `SITE_URL` | `https://trackid-lb.com` (your real domain — drives metadata, sitemap, robots, OG) |
| `SUPABASE_URL` | `https://bdbhygelwizizepxewxv.supabase.co` |
| `SUPABASE_STORAGE_BUCKET` | `products` |
| `SUPABASE_S3_ENDPOINT` | `https://bdbhygelwizizepxewxv.storage.supabase.co/storage/v1/s3` |
| `SUPABASE_S3_REGION` | `eu-central-1` |
| `ACCESS_KEY_ID_SUPABASE` | from Supabase S3 connection |
| `SECRET_ACCESS_KEY_SUPABASE` | from Supabase S3 connection (server-only — no `NEXT_PUBLIC_`) |
| `RESEND_API_KEY` | from Resend |
| `RESEND_FROM` | your verified-domain sender (see §3) |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_RECIPIENT_NUMBER` | real values obtained Session 29 — copy from `.env.local`. Notifications skip gracefully if left blank. |
| `WHATSAPP_ORDER_ALERT_TEMPLATE_NAME` / `WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_NAME` (+ `_LANG` each) | leave blank until Meta approves the two templates submitted Session 29 (see ENV_VARS.md for the exact bodies) — both features are silent no-ops until set |
| `CRON_SECRET` | any long random string — protects `/api/cron/*` (Vercel signs its own Cron Job requests with it automatically once set; without it, cron routes 401 in production) |
| `NEXT_PUBLIC_SENTRY_DSN` | optional — error monitoring is off entirely without it. Sentry → Project Settings → Client Keys |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | optional, only for source-map upload (readable stack traces) — omit and error tracking still works, just with minified traces |

- ☐ Double-check no secret accidentally has a `NEXT_PUBLIC_` prefix (those ship to the browser)
- ☐ `vercel.json` (repo root of the `trackid-lb` project) schedules the daily abandoned-guest-cart cleanup — no action needed, Vercel picks it up automatically on deploy once `CRON_SECRET` is set

---

## 5a. GitHub Actions — automated tests ✅ ACTIVE (Session 22)

`.github/workflows/test.yml` runs on every push/PR to `main`/`General-UI-Enhancements`:
- **Unit tests** (`npm test` — Vitest, money-math functions) + `tsc --noEmit` — no secrets needed, always runs.
- **E2E smoke suite** (`npm run test:e2e` — Playwright: browse → add to cart → COD checkout → order confirmation, against a real `next build && next start`) — needs DB/storage secrets. Automates the manual checklist in §7 below.

**Both jobs are green** — the required repository secrets (Settings → Secrets and variables → Actions) are set, all pointed at the **dev** Supabase project (`lsrmtpazcdksdllfrsqw`), never prod:

| Secret | Value |
|---|---|
| `CI_PAYLOAD_SECRET` | any string (can differ from dev/prod) |
| `CI_DATABASE_URI` | dev project's pooler URL |
| `CI_SUPABASE_URL` | dev project's `SUPABASE_URL` |
| `CI_SUPABASE_STORAGE_BUCKET` | dev project's storage bucket name |
| `CI_SUPABASE_S3_ENDPOINT` / `CI_SUPABASE_S3_REGION` | dev project's S3 connection details |
| `CI_S3_ACCESS_KEY_ID` / `CI_S3_SECRET_ACCESS_KEY` | dev project's S3 keys |

⚠️ **These must stay pointed at the disposable dev project, never prod** — the E2E suite places real test orders through the real checkout API, exactly the reason the dev/prod split exists (MIGRATIONS.md). If the dev Supabase project is ever recreated/rotated, update these 8 secret values to match.

Rotate/update a secret anytime from the same Settings page, or locally with `gh secret set NAME` if the `gh` CLI is installed. Both suites can also be run locally before pushing: `npm test` (fast, seconds) and `npm run test:e2e` (slower — builds + starts the app, ~2–3 min).

## 5b. Vercel — Preview / demo environment (dev database)

Purpose: a shareable deployment running the **dev** Supabase project, so the app can be
demoed and freely messed with without touching real orders or customers. Same
per-client-deploy model ROADMAP Part 8.2 settles on, in miniature.

**How it works**: Vercel scopes every variable to Production / Preview / Development
independently, so Preview can point somewhere else entirely. Every branch already gets its
own URL automatically — `<project>-git-<branch>-<scope>.vercel.app` — with no setup.
**Do not change the Production Branch setting** to achieve this: `...-git-main-...` is the
production branch's own URL and will always track production.

### First, unblock the link

- ☐ **Settings → Deployment Protection → turn off Vercel Authentication for Preview.**
  Until you do, preview URLs 302 to `vercel.com/sso-api` and anyone not on your Vercel team
  hits a login wall. Preview deployments already send `X-Robots-Tag: noindex`, so opening
  them up does not risk a duplicate of the store being indexed.

### Set these to Preview scope (dev project values)

| Variable | Preview value |
|---|---|
| `DATABASE_URI` | dev pooler URI (copy from `.env.local`) |
| `PAYLOAD_SECRET` | any strong random value — need not match production |
| `SITE_URL` | the preview URL, e.g. `https://trackid-lb-git-<branch>-<scope>.vercel.app` |
| `SUPABASE_URL` | `https://lsrmtpazcdksdllfrsqw.supabase.co` |
| `SUPABASE_STORAGE_BUCKET` | `products` |
| `SUPABASE_S3_ENDPOINT` | `https://lsrmtpazcdksdllfrsqw.storage.supabase.co/storage/v1/s3` |
| `SUPABASE_S3_REGION` | `ap-southeast-2` ⚠️ **differs from production** (`eu-central-1`) |
| `ACCESS_KEY_ID_SUPABASE` / `SECRET_ACCESS_KEY_SUPABASE` | dev project's S3 keys |

⚠️ The S3 endpoint and region are project-specific and must match `SUPABASE_URL`. Mixing a
dev URL with prod S3 credentials fails at upload time, not at build time — so it looks fine
until someone tries to add an image during a demo.

### Deliberately leave UNSET on Preview

So a demo order never reaches real people or pollutes real dashboards. Every one of these
degrades to a silent no-op when absent — by design throughout the codebase.

`RESEND_API_KEY` · `RESEND_FROM` · `RESEND_AUDIENCE_ID` · all nine `WHATSAPP_*` ·
`NEXT_PUBLIC_SENTRY_DSN` · `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` ·
`CRON_SECRET` (Vercel Cron only runs on production deployments, so it is not needed here)

### Optional — worth setting for a good demo

| Variable | Value | Why |
|---|---|---|
| `ONLINE_PAYMENTS_ENABLED` | `true` | Required for Card / OMT to appear at checkout at all |
| `ALLOW_MOCK_PAYMENTS` | `true` | Enables the mock provider, so you can walk someone through a card payment |
| `MOCK_PAYMENT_SECRET` | any random string | Signs the mock webhook |
| `SEED_SECRET` | any random string | Lets you reset demo catalog data via `npm run seed` |
| `STORE_NAME` | e.g. a prospect's brand | Rebrands the admin tab title when demoing white-label |

### Gotchas specific to this setup

1. **The build command runs `npm run migrate` against whatever `DATABASE_URI` points at** —
   so deploying a branch carrying a new migration applies it to the **dev** database
   automatically. Desirable, but know it is happening.
2. **`NODE_ENV` is `production` on Preview too.** Payload's schema push stays off (good — no
   accidental sync), which is also why `SEED_SECRET` is required to seed there.
3. **A variable restricted to Production is `undefined` on Preview, and some fall back
   silently.** `SITE_URL` in particular falls back to `http://localhost:3000`, putting
   localhost into canonicals, the sitemap, invoice links and emails with no error shown. Set
   a Preview value for everything in the table above — do not merely restrict Production.
4. **Values are read at build time — edit, then redeploy.** Changing a variable in the
   dashboard does nothing to an already-built deployment.
5. **The dev database is not a clean demo dataset.** As of 2026-08-26 it holds ~6 products,
   3 artists and ~73 test orders accumulated from verification work. `npm run seed -- --reset`
   refreshes the catalog but deliberately leaves orders alone — clear those separately for a
   presentable demo.

### For a permanent demo rather than a branch preview

Consider a **separate Vercel project** on the same repo/branch with its own variables and a
stable domain (e.g. `demo.yourbrand.com`). Cleaner than preview URLs: no chance of confusing
Preview and Production scopes, and a link that does not change. That is the shape ROADMAP
Part 8.6 ("demo deployment for sales conversations") assumes.

---

## 6. Deploy

- ☐ Trigger the deploy (push to the connected branch, or Vercel "Deploy")
- ☐ Build succeeds on Vercel (watch the build log — it connects to the DB during build for `generateStaticParams`)

## 7. Post-deploy smoke test (on the live domain)

- ☐ Homepage loads; theme/colors correct
- ☐ `/admin` loads, you can log in
- ☐ `/shop` lists products; a product page opens; images load (from Supabase CDN)
- ☐ Add to cart → checkout → place a **test COD order** → confirmation page shows it
- ☐ Order appears in `/admin` Orders; **order-confirmation email received** (real inbox, not just your Resend account)
- ☐ WhatsApp floating button opens a chat (if `whatsappNumber` set in SiteSettings)
- ☐ Upload a new image in **Admin → Media**, then pick it on a product → it renders on the storefront
- ☐ `robots.txt` and `sitemap.xml` show your real domain
- ☐ Google Search Console: SiteSettings → SEO → Google Site Verification (admin field, not an env var, Session 29) → verify ownership → submit `sitemap.xml`

---

## 8. Known gotchas / watch-outs

- **S3 creds change the schema — keep local + Vercel in sync.** The storage plugin is `enabled` only when `ACCESS_KEY_ID_SUPABASE`/`SECRET_ACCESS_KEY_SUPABASE` are set, and an enabled plugin adds a `media.prefix` column to the schema. If local dev runs without creds (plugin off) while Vercel has them, the DB won't have the column and **every media query fails in prod** (this exact mismatch broke the first deploy — fixed 2026-07-06 by re-adding the column + backfilling `'media'`). Always keep the four S3 vars in `.env.local` too. Bonus reason: with the plugin disabled, local uploads go to your machine's disk, not the bucket — those images would 404 in production.

- **Large image uploads — handled via `clientUploads`.** `clientUploads: true` is set on the `s3Storage` plugin, so the admin uploads images **straight from the browser to Supabase** (presigned URL), bypassing Vercel's ~4.5 MB serverless request-body limit. **Requirement:** the Supabase bucket must allow cross-origin `PUT` from your site. In Supabase → Storage, ensure CORS allows your production origin (and `http://localhost:3000` for dev) with the `PUT` method. **Test it after deploy:** upload a large (>5 MB) image in Admin → Media; if it fails with a CORS error in the browser console, fix the bucket CORS. If browser uploads ever misbehave, the fallback is to remove `clientUploads: true` (server-side upload, but then keep photos under ~4 MB).
- **Schema changes after launch go through migrations, not push.** Production has `push: false` (see `payload.config.ts` + MIGRATIONS.md) — it never auto-syncs schema, which protects prod data from destructive diffs. Workflow: change the code → `npm run migrate:create <name>` (script-based since Session 20 — works on any Node) → **review/edit the migration to preserve data** (auto-generated diffs can drop columns) → commit → Vercel's build command (`npm run migrate && npm run build`) applies it. ⚠️ A migration that makes an existing field `localized` must copy old values into the `en` locale before dropping the column, or data blanks (this is exactly what bit the localized fields in dev — see MIGRATIONS.md example).
- **Notifications are fire-and-forget** via `after()` — a Resend/WhatsApp failure never blocks an order, but it also means a misconfigured `RESEND_FROM` fails silently. Verify email actually arrives in the smoke test.
- **`PAYLOAD_SECRET`**: the config throws on boot in production if it's unset — good. Just make sure you set a strong one (not the dev value).
- **ISR/revalidate**: product/page edits in admin propagate via revalidate hooks; allow a few seconds. Pricing/stock revalidate immediately.
- **Observed cold-start flake (Session 22, not yet root-caused)**: the very first request to a freshly-started `next start` process sometimes logs `TypeError: controller[kState].transformAlgorithm is not a function` server-side. Seen twice while building the Playwright E2E suite locally (Node 25) — both times the server recovered immediately and every subsequent request (including the one right after) succeeded normally; one of the two runs still passed the full checkout flow end to end. Looks like a Node/Next streams warm-up hiccup rather than a real bug, but hasn't been traced to a root cause. If it ever shows up as an actual user-facing failure (not just a log line) after a deploy or restart, that's the thread to pull.

---

## 9. After a clean launch

- ◐ WhatsApp Cloud API — credentials obtained and wired Session 29; two message templates
  (staff new-order alert, customer order confirmation) submitted to Meta for approval — set
  `WHATSAPP_ORDER_ALERT_TEMPLATE_NAME` / `WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_NAME` once
  approved to activate both
- ~~Generate `payload-types.ts`~~ done (Session 20) — `npm run generate:types`, file committed
- ~~Homepage-block localization~~ done (Session 27) · ~~localized order emails~~ done
  (Session 29 — `Orders.locale` + `notifications.ts` en/ar dictionary) · ~~newsletter~~ done
  (Session 28, ROADMAP Part 7)
- See NEXT_STEPS.md for what's actually still open
