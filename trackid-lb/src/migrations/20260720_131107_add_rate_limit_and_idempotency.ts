import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "rate_limit_counters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"count" numeric DEFAULT 0 NOT NULL,
  	"window_start" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "idempotency_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"response_status" numeric NOT NULL,
  	"response_body" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rate_limit_counters_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "idempotency_keys_id" integer;
  CREATE UNIQUE INDEX "rate_limit_counters_key_idx" ON "rate_limit_counters" USING btree ("key");
  CREATE UNIQUE INDEX "idempotency_keys_key_idx" ON "idempotency_keys" USING btree ("key");
  CREATE INDEX "idempotency_keys_updated_at_idx" ON "idempotency_keys" USING btree ("updated_at");
  CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rate_limit_counters_fk" FOREIGN KEY ("rate_limit_counters_id") REFERENCES "public"."rate_limit_counters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_idempotency_keys_fk" FOREIGN KEY ("idempotency_keys_id") REFERENCES "public"."idempotency_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_rate_limit_counters_id_idx" ON "payload_locked_documents_rels" USING btree ("rate_limit_counters_id");
  CREATE INDEX "payload_locked_documents_rels_idempotency_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("idempotency_keys_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "rate_limit_counters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "idempotency_keys" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "rate_limit_counters" CASCADE;
  DROP TABLE "idempotency_keys" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_rate_limit_counters_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_idempotency_keys_fk";
  
  DROP INDEX "payload_locked_documents_rels_rate_limit_counters_id_idx";
  DROP INDEX "payload_locked_documents_rels_idempotency_keys_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "rate_limit_counters_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "idempotency_keys_id";`)
}
