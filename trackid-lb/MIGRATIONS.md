# Database Migrations

> How schema changes are applied safely — so a change never silently drops or blanks data again.

## Why this exists

Payload's dev **push** (drizzle auto-sync) applies schema changes destructively with no data-preservation step. Enabling localization on existing fields (Session 18) blanked every localized value this way — the push moved fields into `_locales` tables **without copying the old values over**.

**Policy:**
- **Production** (`NODE_ENV=production`) **never pushes.** It only runs committed migration files. A prod schema change is impossible without a reviewed migration.
- **Local dev** keeps `push` for speed — but point it at a **disposable dev database** (see below), so a blanking push never touches data you care about.

Config lives in `src/payload.config.ts` (`db.postgresAdapter`): `push` is on in dev, off in prod; `migrationDir` is `src/migrations`.

---

## ⚠️ Node version

The standalone Payload CLI (what the `migrate:*` scripts call) **fails on this machine's Node 25** with `ERR_MODULE_NOT_FOUND` on the config's extensionless imports. Migration commands must run under **Node LTS (20 or 22)** — which is also what Vercel uses, so production migrations work there automatically.

Run migration commands under Node LTS locally (via `nvm-windows` / `fnm`: `fnm use 22`), or let Vercel apply them on deploy.

---

## The two-database setup (recommended)

Use **two** Supabase projects:

| Env | DB | Schema strategy |
|---|---|---|
| Local dev | a throwaway **dev** project | `push` (fast). Blank it and `npm run seed -- --reset` anytime. |
| Production | the **real** project | migrations only (never pushed). |

Point local `.env.local` `DATABASE_URI` at the dev DB. This is the single most effective protection: push can only ever hurt disposable data.

---

## Commands

All require Node LTS (see above).

```bash
npm run migrate:status     # list applied / pending migrations
npm run migrate:create <name>   # generate a migration from the schema diff
npm run migrate            # apply all pending migrations
npm run migrate:down       # roll back the last batch
npm run migrate:fresh      # drop everything + re-run all (DEV ONLY — destroys data)
```

`PAYLOAD_MIGRATE=true` is set by these scripts so the config runs in migration mode even in dev.

---

## Standard workflow for a schema change

1. Make the code change (add a field, mark one `localized`, add a collection, …).
2. **On Node LTS:** `npm run migrate:create describe_the_change`
3. **Open the generated file in `src/migrations/` and review it.** Auto-generated diffs are often destructive — a "make field localized" diff will `DROP` the old column and `CREATE` the `_locales` table with **no data copy**. Edit the `up()` to preserve data first (see example below).
4. Apply locally against the dev DB: `npm run migrate`
5. Commit the migration file.
6. Deploy — Vercel runs `npm run migrate` before the build (see DEPLOY.md), applying it to prod safely.

---

## Data-preserving migration example (localize an existing field)

An auto-generated migration for "make `products.title` localized" will look roughly like:

```sql
CREATE TABLE "products_locales" (... "title" varchar, "_locale" ..., "_parent_id" ...);
ALTER TABLE "products" DROP COLUMN "title";   -- ⚠️ drops the data
```

Edit `up()` to copy the existing values into the `en` locale **before** the drop:

```ts
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 1. create the _locales table (keep what the generator produced)
  await db.execute(sql`CREATE TABLE "products_locales" (...);`)

  // 2. copy existing values into the default locale FIRST
  await db.execute(sql`
    INSERT INTO "products_locales" ("title", "_locale", "_parent_id")
    SELECT "title", 'en', "id" FROM "products";
  `)

  // 3. only now drop the old column
  await db.execute(sql`ALTER TABLE "products" DROP COLUMN "title";`)
}
```

Same pattern for every field that became localized (description, name, bio, genre, page content, SiteSettings copy, Navigation labels).

---

## Baselining an existing database

The prod/dev DBs already have the full schema (built up via pushes). Before switching them to migration mode:

1. On Node LTS, `npm run migrate:create baseline` — generates a snapshot of the current schema.
2. If the DB already matches the code, mark the baseline as already-applied so `migrate` doesn't try to recreate existing tables. Payload tracks applied migrations in the `payload_migrations` table; use `npm run migrate:status` to confirm state, and `payload migrate:refresh`/manual insertion as needed per the Payload docs.
3. From then on, every schema change gets its own migration.
