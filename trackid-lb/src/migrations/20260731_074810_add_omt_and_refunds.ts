// Hand-written (ROADMAP F2 §2.4/§2.6), same reasoning as the F1 payments
// migration (20260724_094930_add_payments_and_currency.ts): the auto-
// generator's interactive rename-detection wizard has no TTY to answer its
// prompts under this runner. Every statement below is purely additive (new
// enum values, new nullable/defaulted columns) — nothing ambiguous for it to
// have gotten wrong by hand either.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_orders_payment_method" ADD VALUE 'omt';
  ALTER TYPE "public"."enum_payments_provider" ADD VALUE 'omt';

  ALTER TABLE "orders" ADD COLUMN "refunded_amount" numeric DEFAULT 0;

  ALTER TABLE "site_settings" ADD COLUMN "omt_payment_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "omt_instructions" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP COLUMN "refunded_amount";
  ALTER TABLE "site_settings" DROP COLUMN "omt_payment_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "omt_instructions";`)
  // Deliberately NOT reverting the ALTER TYPE ... ADD VALUE statements —
  // Postgres has no DROP VALUE for enums (see the F1 migration's down() for
  // the full rationale). The extra 'omt' labels stay harmlessly unused.
}
