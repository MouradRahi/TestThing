// ROADMAP Part 8.1 — admin-definable taxonomies (de-verticalization).
//
// Adds two collections that let a brand define its own product groupings as
// DATA rather than as code: an underwear brand creates a "Manufacturer"
// taxonomy with terms "Marie France" / "La Senza"; a furniture brand creates
// "Material". No per-client schema change, no deploy, no DDL at runtime.
//
// Purely additive. The existing `artists` collection is deliberately left
// untouched — trackID.lb keeps /artist/ exactly as it is, and an install with
// zero taxonomies defined renders nothing new at all.
//
// The DDL below was transcribed from what Payload's own Drizzle push generated
// against the dev database (rather than hand-written), then verified by
// dropping those tables and re-running this migration to confirm it reproduces
// an identical schema.
//
// Two details worth flagging for future migrations:
//   * `products_rels` is created here for the FIRST time — Products had no
//     hasMany relationship before `taxonomyTerms`, so the table never existed.
//   * `payload_locked_documents_rels` gets a column per new collection. Missing
//     this is what took the whole admin panel down in Session 28 part 6.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_taxonomies_term_fields_field_type" AS ENUM('text', 'textarea', 'number', 'url');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "taxonomies" (
      "id" serial PRIMARY KEY NOT NULL,
      "_order" varchar,
      "slug" varchar NOT NULL,
      "enabled" boolean DEFAULT true,
      "show_in_shop_filters" boolean DEFAULT true,
      "show_on_product_page" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "taxonomies_locales" (
      "label_singular" varchar NOT NULL,
      "label_plural" varchar NOT NULL,
      "description" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "taxonomies_term_fields" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "key" varchar NOT NULL,
      "field_type" "public"."enum_taxonomies_term_fields_field_type" DEFAULT 'text'
    );

    CREATE TABLE IF NOT EXISTS "taxonomies_term_fields_locales" (
      "label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "taxonomy_terms" (
      "id" serial PRIMARY KEY NOT NULL,
      "taxonomy_id" integer NOT NULL,
      "slug" varchar NOT NULL,
      "image_media_id" integer,
      "image" varchar,
      "parent_id" integer,
      "featured" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "taxonomy_terms_locales" (
      "name" varchar NOT NULL,
      "description" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "taxonomy_terms_details" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "key" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "taxonomy_terms_details_locales" (
      "value" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "products_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "taxonomy_terms_id" integer
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "taxonomies_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "taxonomy_terms_id" integer;
  `)

  // Foreign keys are added separately, each guarded, so a partially-applied
  // run isn't blocked by an already-present constraint (Postgres has no
  // ADD CONSTRAINT ... IF NOT EXISTS).
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "taxonomies_locales" ADD CONSTRAINT "taxonomies_locales_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."taxonomies"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "taxonomies_term_fields" ADD CONSTRAINT "taxonomies_term_fields_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."taxonomies"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "taxonomies_term_fields_locales" ADD CONSTRAINT "taxonomies_term_fields_locales_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."taxonomies_term_fields"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "taxonomy_terms" ADD CONSTRAINT "taxonomy_terms_taxonomy_id_taxonomies_id_fk"
        FOREIGN KEY ("taxonomy_id") REFERENCES "public"."taxonomies"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "taxonomy_terms" ADD CONSTRAINT "taxonomy_terms_image_media_id_media_id_fk"
        FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "taxonomy_terms" ADD CONSTRAINT "taxonomy_terms_parent_id_taxonomy_terms_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."taxonomy_terms"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "taxonomy_terms_locales" ADD CONSTRAINT "taxonomy_terms_locales_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."taxonomy_terms"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "taxonomy_terms_details" ADD CONSTRAINT "taxonomy_terms_details_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."taxonomy_terms"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "taxonomy_terms_details_locales" ADD CONSTRAINT "taxonomy_terms_details_locales_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."taxonomy_terms_details"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_taxonomy_terms_fk"
        FOREIGN KEY ("taxonomy_terms_id") REFERENCES "public"."taxonomy_terms"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_taxonomies_fk"
        FOREIGN KEY ("taxonomies_id") REFERENCES "public"."taxonomies"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_taxonomy_terms_fk"
        FOREIGN KEY ("taxonomy_terms_id") REFERENCES "public"."taxonomy_terms"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "taxonomies__order_idx" ON "taxonomies" USING btree ("_order");
    CREATE UNIQUE INDEX IF NOT EXISTS "taxonomies_slug_idx" ON "taxonomies" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "taxonomies_enabled_idx" ON "taxonomies" USING btree ("enabled");
    CREATE INDEX IF NOT EXISTS "taxonomies_updated_at_idx" ON "taxonomies" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "taxonomies_created_at_idx" ON "taxonomies" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "taxonomies_locales_locale_parent_id_unique" ON "taxonomies_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX IF NOT EXISTS "taxonomies_term_fields_order_idx" ON "taxonomies_term_fields" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "taxonomies_term_fields_parent_id_idx" ON "taxonomies_term_fields" USING btree ("_parent_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "taxonomies_term_fields_locales_locale_parent_id_unique" ON "taxonomies_term_fields_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX IF NOT EXISTS "taxonomy_terms_taxonomy_idx" ON "taxonomy_terms" USING btree ("taxonomy_id");
    CREATE INDEX IF NOT EXISTS "taxonomy_terms_slug_idx" ON "taxonomy_terms" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "taxonomy_terms_image_media_idx" ON "taxonomy_terms" USING btree ("image_media_id");
    CREATE INDEX IF NOT EXISTS "taxonomy_terms_parent_idx" ON "taxonomy_terms" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "taxonomy_terms_updated_at_idx" ON "taxonomy_terms" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "taxonomy_terms_created_at_idx" ON "taxonomy_terms" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "taxonomy_terms_locales_locale_parent_id_unique" ON "taxonomy_terms_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX IF NOT EXISTS "taxonomy_terms_details_order_idx" ON "taxonomy_terms_details" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "taxonomy_terms_details_parent_id_idx" ON "taxonomy_terms_details" USING btree ("_parent_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "taxonomy_terms_details_locales_locale_parent_id_unique" ON "taxonomy_terms_details_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX IF NOT EXISTS "products_rels_order_idx" ON "products_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "products_rels_path_idx" ON "products_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "products_rels_taxonomy_terms_id_idx" ON "products_rels" USING btree ("taxonomy_terms_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_taxonomies_id_idx" ON "payload_locked_documents_rels" USING btree ("taxonomies_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_taxonomy_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("taxonomy_terms_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "taxonomies_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "taxonomy_terms_id";
    DROP TABLE IF EXISTS "products_rels" CASCADE;
    DROP TABLE IF EXISTS "taxonomy_terms_details_locales" CASCADE;
    DROP TABLE IF EXISTS "taxonomy_terms_details" CASCADE;
    DROP TABLE IF EXISTS "taxonomy_terms_locales" CASCADE;
    DROP TABLE IF EXISTS "taxonomy_terms" CASCADE;
    DROP TABLE IF EXISTS "taxonomies_term_fields_locales" CASCADE;
    DROP TABLE IF EXISTS "taxonomies_term_fields" CASCADE;
    DROP TABLE IF EXISTS "taxonomies_locales" CASCADE;
    DROP TABLE IF EXISTS "taxonomies" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_taxonomies_term_fields_field_type";
  `)
}
