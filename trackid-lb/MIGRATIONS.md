# Database Migrations

> How schema changes are applied safely — so a change never silently drops or blanks data again.

## Why this exists

Payload's dev **push** (drizzle auto-sync) applies schema changes destructively with no data-preservation step. Enabling localization on existing fields (Session 18) blanked every localized value this way — the push moved fields into `_locales` tables **without copying the old values over**.

**Policy:**
- **Production** (`NODE_ENV=production`) **never pushes.** It only runs committed migration files. A prod schema change is impossible without a reviewed migration.
- **Local dev never pushes by default either.** ⚠️ The deployed app currently runs on the **same** database as local dev, so a casual `npm run dev` with schema-changing code checked out must not be able to rewrite the live schema. Push is **opt-in**: set `PAYLOAD_PUSH=true` for that one run, only after reviewing what will change (or once dev points at a disposable database — see below).

Config lives in `src/payload.config.ts` (`db.postgresAdapter`): `push` requires `PAYLOAD_PUSH=true` and is always off in prod; `migrationDir` is `src/migrations`.

**Symptom of a pending, un-pushed schema change:** dev throws `relation "..." does not exist` / `column "..." does not exist`. That's the guard working — decide deliberately: `PAYLOAD_PUSH=true npm run dev` (dev-only, reviewed) or write a migration.

---

## ⚠️ Node version & the local runner scripts

The standalone Payload CLI (what the `migrate:*` scripts call) **fails on this Windows machine on every Node version tried (22/24/25)** — its scoped tsx loader can't resolve the config's extensionless TS imports, and the `--disable-transpile` escape hatch crashes on a `@next/env` CJS-interop bug.

**Use the programmatic runners locally instead** (added Session 22):

```bash
nvm use 22                                  # Node ≤22 required — the scripts guard and exit on newer
npm run migrate:local -- status
npm run migrate:local -- create <name>
npm run migrate:local -- up
npm run migrate:local -- down
npm run generate:types                      # payload-types.ts (was "4.2", blocked since Session 10)
```

They live in `scripts/migrate.mts` / `scripts/generate-types.mts`: same adapter methods the CLI would call, plus a `@next/env` default-export shim and their own `.env.local` loader. Node 23+ silently no-ops `generateTypes` (exits without writing) — hence the hard guard.

Vercel (Linux) is expected to keep working with the standard `npm run migrate` CLI on deploy (the failure looks Windows-specific). If a deploy ever fails the same way, switch the build command to the `migrate:local` runner.

---

## The two-database setup (recommended)

Use **two** Supabase projects:

| Env | DB | Schema strategy |
|---|---|---|
| Local dev | a throwaway **dev** project | `push` (fast, opt-in via `PAYLOAD_PUSH=true`). Blank it and `npm run seed -- --reset` anytime. |
| Production | the **real** project | migrations only (never pushed). |

Point local `.env.local` `DATABASE_URI` at the dev DB. This is the single most effective protection: push can only ever hurt disposable data.

> ✅ **The two-DB setup is live (2026-07-03).** Local dev points at a disposable project
> (`lsrmtpazcdksdllfrsqw`, ap-southeast-2); production stays on the original project
> (`bdbhygelwizizepxewxv`) and is only ever touched by migrations applied on deploy.
> `PAYLOAD_PUSH=true` and `npm run seed -- --reset` are safe locally.

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

1. `npm run migrate:local -- create baseline` — generates a snapshot of the current schema.
2. If the DB already matches the code, mark the baseline as already-applied so `migrate` doesn't try to recreate existing tables: `npm run migrate:local -- mark <migration_name>` (records it in the `payload_migrations` table without running it).
3. From then on, every schema change gets its own migration.

> ✅ **Baseline done (2026-07-20, Session 22)**: `src/migrations/20260720_055440_baseline.ts`
> (62 tables) created and marked applied on the **dev** DB.
>
> ⚠️ **Prod still needs the marker before the next deploy** (the Vercel build runs
> `npm run migrate`, which would otherwise try to re-create every table). Run this once
> in the **prod** project's Supabase SQL editor:
>
> ```sql
> INSERT INTO payload_migrations (name, batch, created_at, updated_at)
> VALUES ('20260720_055440_baseline', 1, now(), now());
> ```
