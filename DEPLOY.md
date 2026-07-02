# trackID.lb — Deploy Checklist (Vercel + Supabase + Resend)

> First production deploy. Work top to bottom. Boxes are ☐ until done.
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

- ☐ The bucket in `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` (`products`) is set to **Public** (Storage → bucket → Settings). Image URLs are served straight from the public CDN.
- ☐ S3 access key still valid (Project Settings → Storage → S3 Connection). You'll put the keys in Vercel env (below).

## 3. Resend — email (order confirmations)

⚠️ Right now `RESEND_FROM=onboarding@resend.dev`, which **only delivers to your own Resend account email** — real customers will not receive order confirmations.

- ☐ Add and **verify your sending domain** in Resend (DNS records)
- ☐ Set `RESEND_FROM` to an address on that domain, e.g. `orders@trackid.lb`
- ☐ (Optional) set SiteSettings → `contactEmail` for a reply-to once 3.1's reply-to wiring lands

---

## 4. Vercel — project setup

- ☐ Import the GitHub repo into Vercel
- ☐ **Root Directory = `trackid-lb`** (the Next app is in a subfolder, not the repo root)
- ☐ Framework preset: **Next.js** (auto). **Override the Build Command to `npm run migrate && npm run build`** so committed migrations apply to prod before the build (prod never auto-pushes schema — see MIGRATIONS.md). Vercel runs Node LTS, so the migrate CLI works there. Leave Output Directory default.
- ☐ Node version: leave Vercel's default (20/22). *Bonus:* unlike your local Node 25, this means the Payload CLI (`generate:types`) would work here if ever needed.
- ☐ Add your domain (`trackid.lb`) under Project → Domains (point DNS per Vercel's instructions)

## 5. Vercel — environment variables

Add each to **Production** (and Preview if you want preview deploys to work). Paste secrets from your `.env.local`.

| Variable | Value / note |
|---|---|
| `PAYLOAD_SECRET` | ⚠️ **Generate a NEW strong random value for prod** — don't reuse the dev string. (e.g. `openssl rand -hex 32`) |
| `DATABASE_URI` | Supabase **pooler** URL (port 6543) |
| `NEXT_PUBLIC_SITE_URL` | `https://trackid.lb` (your real domain — drives metadata, sitemap, robots, OG) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bdbhygelwizizepxewxv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | `products` |
| `SUPABASE_S3_ENDPOINT` | `https://bdbhygelwizizepxewxv.storage.supabase.co/storage/v1/s3` |
| `SUPABASE_S3_REGION` | `eu-central-1` |
| `ACCESS_KEY_ID_SUPABASE` | from Supabase S3 connection |
| `SECRET_ACCESS_KEY_SUPABASE` | from Supabase S3 connection (server-only — no `NEXT_PUBLIC_`) |
| `RESEND_API_KEY` | from Resend |
| `RESEND_FROM` | your verified-domain sender (see §3) |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_RECIPIENT_NUMBER` | leave blank for now (notifications skip gracefully) |

- ☐ Double-check no secret accidentally has a `NEXT_PUBLIC_` prefix (those ship to the browser)

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

---

## 8. Known gotchas / watch-outs

- **Large image uploads — handled via `clientUploads`.** `clientUploads: true` is set on the `s3Storage` plugin, so the admin uploads images **straight from the browser to Supabase** (presigned URL), bypassing Vercel's ~4.5 MB serverless request-body limit. **Requirement:** the Supabase bucket must allow cross-origin `PUT` from your site. In Supabase → Storage, ensure CORS allows your production origin (and `http://localhost:3000` for dev) with the `PUT` method. **Test it after deploy:** upload a large (>5 MB) image in Admin → Media; if it fails with a CORS error in the browser console, fix the bucket CORS. If browser uploads ever misbehave, the fallback is to remove `clientUploads: true` (server-side upload, but then keep photos under ~4 MB).
- **Schema changes after launch go through migrations, not push.** Production has `push: false` (see `payload.config.ts` + MIGRATIONS.md) — it never auto-syncs schema, which protects prod data from destructive diffs. Workflow: change the code → `npm run migrate:create <name>` on **Node LTS** (the CLI fails on Node 25) → **review/edit the migration to preserve data** (auto-generated diffs can drop columns) → commit → Vercel's build command (`npm run migrate && npm run build`) applies it. ⚠️ A migration that makes an existing field `localized` must copy old values into the `en` locale before dropping the column, or data blanks (this is exactly what bit the localized fields in dev — see MIGRATIONS.md example).
- **Notifications are fire-and-forget** via `after()` — a Resend/WhatsApp failure never blocks an order, but it also means a misconfigured `RESEND_FROM` fails silently. Verify email actually arrives in the smoke test.
- **`PAYLOAD_SECRET`**: the config throws on boot in production if it's unset — good. Just make sure you set a strong one (not the dev value).
- **ISR/revalidate**: product/page edits in admin propagate via revalidate hooks; allow a few seconds. Pricing/stock revalidate immediately.

---

## 9. After a clean launch

- Activate WhatsApp Cloud API (keys → the three `WHATSAPP_*` vars) to get team alerts on new orders
- Generate `payload-types.ts` under Node LTS and commit it (drops the `Record<string, any>` casts)
- Continue the roadmap: IMPROVEMENTS.md (Phase 11 finish → Phase 12, incl. the 4.6 sales dashboard)
