// Hand-written (login-security audit follow-up, Session 27 part 6), same
// reasoning as every prior hand-written migration in this project: the
// auto-generator's interactive rename-detection wizard has no TTY to answer
// its prompts under this runner. Every statement below is purely additive
// (new nullable/defaulted columns on users) — checked field-by-field against
// the new Users.ts twoFactor* fields. The admin-login rate limit itself
// (Users.ts beforeOperation hook) needs no schema change — it reuses the
// existing rate_limit_counters table from the durable-rate-limit migration.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "two_factor_secret" varchar;
  ALTER TABLE "users" ADD COLUMN "two_factor_pending_secret" varchar;
  ALTER TABLE "users" ADD COLUMN "two_factor_enabled_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "two_factor_enabled";
  ALTER TABLE "users" DROP COLUMN "two_factor_secret";
  ALTER TABLE "users" DROP COLUMN "two_factor_pending_secret";
  ALTER TABLE "users" DROP COLUMN "two_factor_enabled_at";`)
}
