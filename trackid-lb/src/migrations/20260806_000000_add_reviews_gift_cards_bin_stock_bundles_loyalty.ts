// Hand-written (ROADMAP Part 6.2/6.3/6.4/6.6/6.7), same reasoning as every
// prior hand-written migration this project has needed: the auto-
// generator's interactive rename-detection wizard has no TTY to answer its
// prompts under this runner. Every statement below is additive — new tables
// mirror the shape/naming convention of existing equivalent collections
// (reviews ~ returns, bundles/bundles_locales/bundles_products ~
// products/products_locales/products_sizes, products_specs ~ orders_items),
// checked field-by-field against the corresponding *.ts collection files.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reviews_status" AS ENUM('pending', 'published');
  CREATE TYPE "public"."enum_bundles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_returns_refund_method" AS ENUM('cash', 'store_credit');

  -- Reviews (6.2)
  CREATE TABLE "reviews" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"product_id" integer NOT NULL,
   	"customer_id" integer NOT NULL,
   	"customer_name" varchar NOT NULL,
   	"rating" numeric NOT NULL,
   	"text" varchar NOT NULL,
   	"verified_purchase" boolean DEFAULT false,
   	"status" "enum_reviews_status" DEFAULT 'pending' NOT NULL,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("product_id");
  CREATE INDEX "reviews_customer_idx" ON "reviews" USING btree ("customer_id");
  CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");

  -- Gift cards (6.3)
  CREATE TABLE "gift_cards" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"code" varchar NOT NULL,
   	"initial_balance" numeric NOT NULL,
   	"remaining_balance" numeric,
   	"purchaser_email" varchar,
   	"recipient_email" varchar,
   	"enabled" boolean DEFAULT true,
   	"expires_at" timestamp(3) with time zone,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE UNIQUE INDEX "gift_cards_code_idx" ON "gift_cards" USING btree ("code");
  CREATE INDEX "gift_cards_updated_at_idx" ON "gift_cards" USING btree ("updated_at");
  CREATE INDEX "gift_cards_created_at_idx" ON "gift_cards" USING btree ("created_at");

  -- Back-in-stock requests (6.4)
  CREATE TABLE "back_in_stock_requests" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"product_id" integer NOT NULL,
   	"email" varchar NOT NULL,
   	"customer_id" integer,
   	"notified_at" timestamp(3) with time zone,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "back_in_stock_requests" ADD CONSTRAINT "back_in_stock_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "back_in_stock_requests" ADD CONSTRAINT "back_in_stock_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "back_in_stock_requests_product_idx" ON "back_in_stock_requests" USING btree ("product_id");
  CREATE INDEX "back_in_stock_requests_email_idx" ON "back_in_stock_requests" USING btree ("email");
  CREATE INDEX "back_in_stock_requests_customer_idx" ON "back_in_stock_requests" USING btree ("customer_id");
  CREATE INDEX "back_in_stock_requests_updated_at_idx" ON "back_in_stock_requests" USING btree ("updated_at");
  CREATE INDEX "back_in_stock_requests_created_at_idx" ON "back_in_stock_requests" USING btree ("created_at");

  -- Bundles (6.7 — informational v1, see Bundles.ts)
  CREATE TABLE "bundles_products" (
   	"_order" integer NOT NULL,
   	"_parent_id" integer NOT NULL,
   	"id" varchar PRIMARY KEY NOT NULL,
   	"product_id" integer,
   	"quantity" numeric DEFAULT 1 NOT NULL
  );
  CREATE TABLE "bundles" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"slug" varchar NOT NULL,
   	"bundle_price" numeric NOT NULL,
   	"status" "enum_bundles_status" DEFAULT 'draft' NOT NULL,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "bundles_locales" (
   	"title" varchar NOT NULL,
   	"description" varchar,
   	"id" serial PRIMARY KEY NOT NULL,
   	"_locale" "_locales" NOT NULL,
   	"_parent_id" integer NOT NULL
  );
  ALTER TABLE "bundles_products" ADD CONSTRAINT "bundles_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bundles_products" ADD CONSTRAINT "bundles_products_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bundles_locales" ADD CONSTRAINT "bundles_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "bundles_products_order_idx" ON "bundles_products" USING btree ("_order");
  CREATE INDEX "bundles_products_parent_id_idx" ON "bundles_products" USING btree ("_parent_id");
  CREATE INDEX "bundles_products_product_idx" ON "bundles_products" USING btree ("product_id");
  CREATE UNIQUE INDEX "bundles_slug_idx" ON "bundles" USING btree ("slug");
  CREATE INDEX "bundles_status_idx" ON "bundles" USING btree ("status");
  CREATE INDEX "bundles_updated_at_idx" ON "bundles" USING btree ("updated_at");
  CREATE INDEX "bundles_created_at_idx" ON "bundles" USING btree ("created_at");
  CREATE UNIQUE INDEX "bundles_locales_locale_parent_id_unique" ON "bundles_locales" USING btree ("_locale","_parent_id");

  -- Products: ratings (6.2), preorder (6.4), specs (6.7)
  ALTER TABLE "products" ADD COLUMN "rating_avg" numeric DEFAULT 0;
  ALTER TABLE "products" ADD COLUMN "rating_count" numeric DEFAULT 0;
  ALTER TABLE "products" ADD COLUMN "preorder_enabled" boolean DEFAULT false;
  ALTER TABLE "products_locales" ADD COLUMN "preorder_message" varchar;

  CREATE TABLE "products_specs" (
   	"_order" integer NOT NULL,
   	"_parent_id" integer NOT NULL,
   	"id" varchar PRIMARY KEY NOT NULL,
   	"label" varchar NOT NULL,
   	"value" varchar NOT NULL
  );
  ALTER TABLE "products_specs" ADD CONSTRAINT "products_specs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_specs_order_idx" ON "products_specs" USING btree ("_order");
  CREATE INDEX "products_specs_parent_id_idx" ON "products_specs" USING btree ("_parent_id");

  -- Customers: store credit (6.3), loyalty + referrals (6.6)
  ALTER TABLE "customers" ADD COLUMN "store_credit" numeric DEFAULT 0;
  ALTER TABLE "customers" ADD COLUMN "loyalty_points" numeric DEFAULT 0;
  ALTER TABLE "customers" ADD COLUMN "referred_by_id" integer;
  ALTER TABLE "customers" ADD COLUMN "referral_reward_granted" boolean DEFAULT false;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_referred_by_id_customers_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "customers_referred_by_idx" ON "customers" USING btree ("referred_by_id");

  -- Orders: gift card / store credit / points applied at checkout (6.3/6.6)
  ALTER TABLE "orders" ADD COLUMN "gift_card_code" varchar;
  ALTER TABLE "orders" ADD COLUMN "gift_card_amount" numeric DEFAULT 0;
  ALTER TABLE "orders" ADD COLUMN "store_credit_applied" numeric DEFAULT 0;
  ALTER TABLE "orders" ADD COLUMN "points_redeemed" numeric DEFAULT 0;

  -- Garment types: size guide (6.7)
  ALTER TABLE "garment_types_locales" ADD COLUMN "size_guide" jsonb;

  -- Returns: refund method (6.3)
  ALTER TABLE "returns" ADD COLUMN "refund_method" "enum_returns_refund_method" DEFAULT 'cash';

  -- Site settings: gift card combinability (6.3), loyalty config (6.6)
  ALTER TABLE "site_settings" ADD COLUMN "gift_cards_combinable_with_discounts" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "loyalty_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "loyalty_earn_rate_per_dollar" numeric DEFAULT 1;
  ALTER TABLE "site_settings" ADD COLUMN "loyalty_burn_points_per_dollar" numeric DEFAULT 100;
  ALTER TABLE "site_settings" ADD COLUMN "referral_referrer_points" numeric DEFAULT 200;
  ALTER TABLE "site_settings" ADD COLUMN "referral_referee_points" numeric DEFAULT 100;

  -- payload_locked_documents_rels — one FK column per new collection
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reviews_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gift_cards_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "back_in_stock_requests_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bundles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_cards_fk" FOREIGN KEY ("gift_cards_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_back_in_stock_requests_fk" FOREIGN KEY ("back_in_stock_requests_id") REFERENCES "public"."back_in_stock_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bundles_fk" FOREIGN KEY ("bundles_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_gift_cards_id_idx" ON "payload_locked_documents_rels" USING btree ("gift_cards_id");
  CREATE INDEX "payload_locked_documents_rels_back_in_stock_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("back_in_stock_requests_id");
  CREATE INDEX "payload_locked_documents_rels_bundles_id_idx" ON "payload_locked_documents_rels" USING btree ("bundles_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reviews_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gift_cards_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_back_in_stock_requests_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bundles_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reviews_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gift_cards_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "back_in_stock_requests_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "bundles_id";

  ALTER TABLE "site_settings" DROP COLUMN "gift_cards_combinable_with_discounts";
  ALTER TABLE "site_settings" DROP COLUMN "loyalty_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "loyalty_earn_rate_per_dollar";
  ALTER TABLE "site_settings" DROP COLUMN "loyalty_burn_points_per_dollar";
  ALTER TABLE "site_settings" DROP COLUMN "referral_referrer_points";
  ALTER TABLE "site_settings" DROP COLUMN "referral_referee_points";

  ALTER TABLE "returns" DROP COLUMN "refund_method";
  ALTER TABLE "garment_types_locales" DROP COLUMN "size_guide";

  ALTER TABLE "orders" DROP COLUMN "gift_card_code";
  ALTER TABLE "orders" DROP COLUMN "gift_card_amount";
  ALTER TABLE "orders" DROP COLUMN "store_credit_applied";
  ALTER TABLE "orders" DROP COLUMN "points_redeemed";

  ALTER TABLE "customers" DROP CONSTRAINT "customers_referred_by_id_customers_id_fk";
  ALTER TABLE "customers" DROP COLUMN "store_credit";
  ALTER TABLE "customers" DROP COLUMN "loyalty_points";
  ALTER TABLE "customers" DROP COLUMN "referred_by_id";
  ALTER TABLE "customers" DROP COLUMN "referral_reward_granted";

  ALTER TABLE "products_specs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_specs" CASCADE;
  ALTER TABLE "products" DROP COLUMN "rating_avg";
  ALTER TABLE "products" DROP COLUMN "rating_count";
  ALTER TABLE "products" DROP COLUMN "preorder_enabled";
  ALTER TABLE "products_locales" DROP COLUMN "preorder_message";

  ALTER TABLE "bundles_products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bundles_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bundles" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bundles_products" CASCADE;
  DROP TABLE "bundles_locales" CASCADE;
  DROP TABLE "bundles" CASCADE;

  ALTER TABLE "back_in_stock_requests" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "back_in_stock_requests" CASCADE;

  ALTER TABLE "gift_cards" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "gift_cards" CASCADE;

  ALTER TABLE "reviews" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "reviews" CASCADE;

  DROP TYPE "public"."enum_reviews_status";
  DROP TYPE "public"."enum_bundles_status";
  DROP TYPE "public"."enum_returns_refund_method";`)
}
