// Hand-written (ROADMAP Part 3.2/3.3), same reasoning as every prior
// hand-written migration this project has needed: the auto-generator's
// interactive rename-detection wizard has no TTY to answer its prompts under
// this runner. Every statement below is purely additive (new nullable/
// defaulted columns) — checked field-by-field against the new Orders
// courier fields and the new SiteSettings low-stock-alert fields.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ADD COLUMN "courier_name" varchar;
  ALTER TABLE "orders" ADD COLUMN "tracking_ref" varchar;
  ALTER TABLE "orders" ADD COLUMN "dispatch_date" timestamp(3) with time zone;

  ALTER TABLE "site_settings" ADD COLUMN "low_stock_alert_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "low_stock_threshold" numeric DEFAULT 3;
  ALTER TABLE "site_settings" ADD COLUMN "low_stock_alert_last_sent_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP COLUMN "courier_name";
  ALTER TABLE "orders" DROP COLUMN "tracking_ref";
  ALTER TABLE "orders" DROP COLUMN "dispatch_date";

  ALTER TABLE "site_settings" DROP COLUMN "low_stock_alert_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "low_stock_threshold";
  ALTER TABLE "site_settings" DROP COLUMN "low_stock_alert_last_sent_at";`)
}
