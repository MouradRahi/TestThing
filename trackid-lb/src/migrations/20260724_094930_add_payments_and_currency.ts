// Hand-written (ROADMAP F1 §2.1/§2.5) — the auto-generator's interactive
// rename-detection wizard (drizzle-kit's TUI) hung indefinitely under this
// runner (no TTY to answer its arrow-key prompts) and risked misreading a
// brand-new column as a rename of an unrelated existing one. Every statement
// below is purely additive (new table, new columns, new enum values) and was
// checked field-by-field against src/collections/Payments.ts, the extended
// Orders/SiteSettings fields, and the equivalent CREATE TABLE/ALTER TYPE
// shapes already committed in the baseline migration for other
// collections/select fields, so there is nothing ambiguous for it to get
// wrong by hand either.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_orders_payment_method" ADD VALUE 'card';
  ALTER TYPE "public"."enum_orders_payment_status" ADD VALUE 'awaiting_payment';
  ALTER TYPE "public"."enum_orders_payment_status" ADD VALUE 'failed';
  ALTER TYPE "public"."enum_orders_payment_status" ADD VALUE 'expired';
  ALTER TYPE "public"."enum_orders_payment_status" ADD VALUE 'refunded';
  ALTER TYPE "public"."enum_orders_payment_status" ADD VALUE 'partially_refunded';
  CREATE TYPE "public"."enum_site_settings_card_payment_provider" AS ENUM('mock');
  CREATE TYPE "public"."enum_site_settings_currency_display_mode" AS ENUM('usd_only', 'both');
  CREATE TYPE "public"."enum_payments_provider" AS ENUM('mock');
  CREATE TYPE "public"."enum_payments_status" AS ENUM('initiated', 'pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded');

  ALTER TABLE "orders" ADD COLUMN "payment_expires_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "exchange_rate_at_purchase" numeric;

  ALTER TABLE "site_settings" ADD COLUMN "card_payments_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "card_payment_provider" "enum_site_settings_card_payment_provider" DEFAULT 'mock';
  ALTER TABLE "site_settings" ADD COLUMN "currency_display_mode" "enum_site_settings_currency_display_mode" DEFAULT 'usd_only';
  ALTER TABLE "site_settings" ADD COLUMN "exchange_rate" numeric;

  CREATE TABLE "payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"provider" "enum_payments_provider" NOT NULL,
  	"provider_ref" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'USD' NOT NULL,
  	"status" "enum_payments_status" DEFAULT 'initiated' NOT NULL,
  	"raw_events" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payments_id" integer;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payments_fk" FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");
  CREATE INDEX "payments_provider_idx" ON "payments" USING btree ("provider");
  CREATE INDEX "payments_provider_ref_idx" ON "payments" USING btree ("provider_ref");
  CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");
  CREATE INDEX "payments_updated_at_idx" ON "payments" USING btree ("updated_at");
  CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("payments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payments_fk";

  DROP INDEX "payload_locked_documents_rels_payments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payments_id";

  ALTER TABLE "orders" DROP COLUMN "payment_expires_at";
  ALTER TABLE "orders" DROP COLUMN "exchange_rate_at_purchase";

  ALTER TABLE "site_settings" DROP COLUMN "card_payments_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "card_payment_provider";
  ALTER TABLE "site_settings" DROP COLUMN "currency_display_mode";
  ALTER TABLE "site_settings" DROP COLUMN "exchange_rate";

  DROP TYPE "public"."enum_site_settings_card_payment_provider";
  DROP TYPE "public"."enum_site_settings_currency_display_mode";
  DROP TYPE "public"."enum_payments_provider";
  DROP TYPE "public"."enum_payments_status";`)
  // Deliberately NOT reverting the ALTER TYPE ... ADD VALUE statements above —
  // Postgres has no DROP VALUE for enums (dropping/recreating the type would
  // require rewriting every dependent column). The extra labels ('card',
  // 'awaiting_payment', 'failed', 'expired', 'refunded', 'partially_refunded')
  // stay in enum_orders_payment_method/enum_orders_payment_status after a
  // down — harmless (unused enum labels don't affect existing rows or the
  // app, since the TS types are already regenerated forward again on the
  // next up), same tradeoff Drizzle itself makes for this case.
}
