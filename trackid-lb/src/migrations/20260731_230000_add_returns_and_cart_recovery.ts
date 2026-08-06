// Hand-written (ROADMAP Part 6.1/6.5), same reasoning as every prior
// hand-written migration this project has needed: the auto-generator's
// interactive rename-detection wizard has no TTY to answer its prompts under
// this runner. New `returns`/`returns_items` tables mirror the shape of
// `orders`/`orders_items` exactly (same index/constraint naming convention);
// the `carts`/`customers` column additions are purely additive.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_returns_status" AS ENUM('requested', 'approved', 'received', 'refunded', 'rejected');

  CREATE TABLE "returns_items" (
   	"_order" integer NOT NULL,
   	"_parent_id" integer NOT NULL,
   	"id" varchar PRIMARY KEY NOT NULL,
   	"product_id" varchar NOT NULL,
   	"title_at_purchase" varchar NOT NULL,
   	"size" varchar,
   	"price_at_purchase" numeric NOT NULL,
   	"quantity" numeric NOT NULL
  );

  CREATE TABLE "returns" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"order_id" integer NOT NULL,
   	"order_number" varchar NOT NULL,
   	"customer_id" integer NOT NULL,
   	"customer_name" varchar NOT NULL,
   	"customer_email" varchar NOT NULL,
   	"reason" varchar NOT NULL,
   	"status" "enum_returns_status" DEFAULT 'requested' NOT NULL,
   	"refund_amount" numeric,
   	"admin_notes" varchar,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "returns_items" ADD CONSTRAINT "returns_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "returns_items_order_idx" ON "returns_items" USING btree ("_order");
  CREATE INDEX "returns_items_parent_id_idx" ON "returns_items" USING btree ("_parent_id");
  CREATE INDEX "returns_order_idx" ON "returns" USING btree ("order_id");
  CREATE INDEX "returns_customer_idx" ON "returns" USING btree ("customer_id");
  CREATE INDEX "returns_status_idx" ON "returns" USING btree ("status");
  CREATE INDEX "returns_updated_at_idx" ON "returns" USING btree ("updated_at");
  CREATE INDEX "returns_created_at_idx" ON "returns" USING btree ("created_at");

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "returns_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_returns_fk" FOREIGN KEY ("returns_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_returns_id_idx" ON "payload_locked_documents_rels" USING btree ("returns_id");

  ALTER TABLE "carts" ADD COLUMN "recovery_email_sent_at" timestamp(3) with time zone;
  ALTER TABLE "customers" ADD COLUMN "cart_recovery_opt_out" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_returns_fk";
  DROP INDEX "payload_locked_documents_rels_returns_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "returns_id";

  ALTER TABLE "returns_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "returns" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "returns_items" CASCADE;
  DROP TABLE "returns" CASCADE;
  DROP TYPE "public"."enum_returns_status";

  ALTER TABLE "carts" DROP COLUMN "recovery_email_sent_at";
  ALTER TABLE "customers" DROP COLUMN "cart_recovery_opt_out";`)
}
