// Hand-written (ROADMAP Part 4 §4.2/§4.3), same reasoning as the two prior
// hand-written migrations (F1 payments, F2 omt/refunds): the auto-generator's
// interactive rename-detection wizard has no TTY to answer its prompts under
// this runner. Every statement below is purely additive (new table, new
// enum, new nullable/defaulted columns) — nothing ambiguous for it to have
// gotten wrong by hand either. Checked field-by-field against
// src/collections/AnalyticsCounters.ts and the new SiteSettings Reports tab.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "analytics_counters" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"date" varchar NOT NULL,
   	"page_views" numeric DEFAULT 0 NOT NULL
   );

  CREATE UNIQUE INDEX "analytics_counters_date_idx" ON "analytics_counters" USING btree ("date");

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "analytics_counters_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_counters_fk" FOREIGN KEY ("analytics_counters_id") REFERENCES "public"."analytics_counters"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_analytics_counters_id_idx" ON "payload_locked_documents_rels" USING btree ("analytics_counters_id");

  CREATE TYPE "public"."enum_site_settings_reports_email_cadence" AS ENUM('weekly', 'monthly');

  ALTER TABLE "site_settings" ADD COLUMN "reports_email_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "reports_email_cadence" "enum_site_settings_reports_email_cadence" DEFAULT 'weekly';
  ALTER TABLE "site_settings" ADD COLUMN "reports_email_recipients" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "send_sales_report" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "send_inventory_report" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "send_customers_report" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "send_discounts_report" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "send_payments_report" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "reports_email_last_sent_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_analytics_counters_fk";
  DROP INDEX "payload_locked_documents_rels_analytics_counters_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "analytics_counters_id";

  ALTER TABLE "analytics_counters" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "analytics_counters" CASCADE;

  ALTER TABLE "site_settings" DROP COLUMN "reports_email_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "reports_email_cadence";
  ALTER TABLE "site_settings" DROP COLUMN "reports_email_recipients";
  ALTER TABLE "site_settings" DROP COLUMN "send_sales_report";
  ALTER TABLE "site_settings" DROP COLUMN "send_inventory_report";
  ALTER TABLE "site_settings" DROP COLUMN "send_customers_report";
  ALTER TABLE "site_settings" DROP COLUMN "send_discounts_report";
  ALTER TABLE "site_settings" DROP COLUMN "send_payments_report";
  ALTER TABLE "site_settings" DROP COLUMN "reports_email_last_sent_at";

  DROP TYPE "public"."enum_site_settings_reports_email_cadence";`)
}
