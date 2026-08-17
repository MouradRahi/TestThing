// Hand-written (ROADMAP Part 7 — growth & marketing), same reasoning as
// every prior hand-written migration in this project: the auto-generator's
// interactive rename-detection wizard has no TTY to answer its prompts under
// this runner. Three additive pieces, all checked field-by-field against a
// real, already-migrated equivalent before writing (queried the live dev DB's
// current pages_blocks_* shapes — post the Session 28 localization migration
// — rather than trusting the older baseline migration file, since several of
// those tables' shapes changed since then):
//   1. orders.utm_source/utm_medium/utm_campaign — campaign attribution
//   2. homepage_blocks_newsletter / pages_blocks_newsletter (+ locales) — the
//      new Newsletter block, added to both existing block builders
//   3. The full Posts collection — mirrors Pages' schema shape exactly
//      (same block set, same localized fields), since Posts is deliberately
//      "Pages' block builder, different top-level fields"
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Campaign attribution on orders
    ALTER TABLE "orders" ADD COLUMN "utm_source" varchar;
    ALTER TABLE "orders" ADD COLUMN "utm_medium" varchar;
    ALTER TABLE "orders" ADD COLUMN "utm_campaign" varchar;
    CREATE INDEX "orders_utm_source_idx" ON "orders" ("utm_source");
    CREATE INDEX "orders_utm_campaign_idx" ON "orders" ("utm_campaign");

    -- 2a. Newsletter block — Homepage
    CREATE TABLE "homepage_blocks_newsletter" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "bg_color" varchar,
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "homepage_blocks_newsletter_locales" (
      "heading" varchar DEFAULT 'Stay in the loop',
      "subtext" varchar DEFAULT 'New drops, restocks, and the occasional discount code — no spam.',
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    ALTER TABLE "homepage_blocks_newsletter" ADD CONSTRAINT "homepage_blocks_newsletter_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "homepage_blocks_newsletter_locales" ADD CONSTRAINT "homepage_blocks_newsletter_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_newsletter"("id") ON DELETE cascade ON UPDATE no action;

    -- 2b. Newsletter block — Pages
    CREATE TABLE "pages_blocks_newsletter" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "bg_color" varchar,
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "pages_blocks_newsletter_locales" (
      "heading" varchar DEFAULT 'Stay in the loop',
      "subtext" varchar DEFAULT 'New drops, restocks, and the occasional discount code — no spam.',
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    ALTER TABLE "pages_blocks_newsletter" ADD CONSTRAINT "pages_blocks_newsletter_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_blocks_newsletter_locales" ADD CONSTRAINT "pages_blocks_newsletter_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_newsletter"("id") ON DELETE cascade ON UPDATE no action;

    -- 3. Posts collection — enums
    CREATE TYPE "enum_posts_blocks_hero_text_align" AS ENUM('left', 'center', 'right');
    CREATE TYPE "enum_posts_blocks_hero_min_height" AS ENUM('50vh', '70vh', '80vh', '100vh');
    CREATE TYPE "enum_posts_blocks_slideshow_height" AS ENUM('60vh', '70vh', '80vh', '100vh');
    CREATE TYPE "enum_posts_blocks_featured_products_source" AS ENUM('latest', 'manual');
    CREATE TYPE "enum_posts_blocks_image_text_image_position" AS ENUM('left', 'right');
    CREATE TYPE "enum_posts_status" AS ENUM('draft', 'published');

    -- 3a. posts_blocks_hero
    CREATE TABLE "posts_blocks_hero" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "cta_href" varchar,
      "secondary_cta_href" varchar,
      "bg_image_media_id" integer,
      "bg_image" varchar,
      "bg_color" varchar,
      "overlay_opacity" numeric DEFAULT 0,
      "text_align" "enum_posts_blocks_hero_text_align" DEFAULT 'center',
      "min_height" "enum_posts_blocks_hero_min_height" DEFAULT '80vh',
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "posts_blocks_hero_locales" (
      "eyebrow" varchar,
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "secondary_cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    -- 3b. posts_blocks_slideshow / _slides
    CREATE TABLE "posts_blocks_slideshow" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "height" "enum_posts_blocks_slideshow_height" DEFAULT '80vh',
      "autoplay_interval" numeric DEFAULT 5000,
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "posts_blocks_slideshow_slides" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "bg_image_media_id" integer,
      "bg_image" varchar,
      "bg_color" varchar DEFAULT '#0a0a0a',
      "overlay_opacity" numeric DEFAULT 40,
      "cta_href" varchar
    );
    CREATE TABLE "posts_blocks_slideshow_slides_locales" (
      "eyebrow" varchar,
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    -- 3c. posts_blocks_featured_products
    CREATE TABLE "posts_blocks_featured_products" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "view_all_href" varchar DEFAULT '/shop',
      "source" "enum_posts_blocks_featured_products_source" DEFAULT 'latest',
      "limit" numeric DEFAULT 6,
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "posts_blocks_featured_products_locales" (
      "section_title" varchar DEFAULT 'Latest Drops',
      "view_all_label" varchar DEFAULT 'View all →',
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    -- 3d. posts_blocks_image_text
    CREATE TABLE "posts_blocks_image_text" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_media_id" integer,
      "image" varchar,
      "cta_href" varchar,
      "image_position" "enum_posts_blocks_image_text_image_position" DEFAULT 'left',
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "posts_blocks_image_text_locales" (
      "image_alt" varchar,
      "eyebrow" varchar,
      "heading" varchar,
      "body" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    -- 3e. posts_blocks_statement
    CREATE TABLE "posts_blocks_statement" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "posts_blocks_statement_locales" (
      "text" varchar NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    -- 3f. posts_blocks_rich_text
    CREATE TABLE "posts_blocks_rich_text" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "posts_blocks_rich_text_locales" (
      "content" jsonb,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    -- 3g. posts_blocks_cta_banner
    CREATE TABLE "posts_blocks_cta_banner" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "cta_href" varchar,
      "bg_image_media_id" integer,
      "bg_image" varchar,
      "bg_color" varchar,
      "overlay_opacity" numeric DEFAULT 0,
      "text_color" varchar,
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "posts_blocks_cta_banner_locales" (
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    -- 3h. posts_blocks_newsletter
    CREATE TABLE "posts_blocks_newsletter" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "bg_color" varchar,
      "hidden" boolean DEFAULT false,
      "block_name" varchar
    );
    CREATE TABLE "posts_blocks_newsletter_locales" (
      "heading" varchar DEFAULT 'Stay in the loop',
      "subtext" varchar DEFAULT 'New drops, restocks, and the occasional discount code — no spam.',
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );

    -- 3i. posts (top-level) + posts_locales + posts_rels
    CREATE TABLE "posts" (
      "id" serial PRIMARY KEY NOT NULL,
      "slug" varchar NOT NULL,
      "featured_image_media_id" integer,
      "featured_image" varchar,
      "author" varchar,
      "published_date" timestamp(3) with time zone,
      "status" "enum_posts_status" DEFAULT 'draft' NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" ("slug");
    CREATE INDEX "posts_status_idx" ON "posts" ("status");

    CREATE TABLE "posts_locales" (
      "title" varchar NOT NULL,
      "excerpt" varchar,
      "featured_image_alt" varchar,
      "content" jsonb,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );

    CREATE TABLE "posts_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "products_id" integer
    );

    -- FK constraints (block tables → posts; each block's own _locales table;
    -- media picks; posts_locales/posts_rels → posts)
    ALTER TABLE "posts_blocks_hero" ADD CONSTRAINT "posts_blocks_hero_bg_image_media_id_media_id_fk" FOREIGN KEY ("bg_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "posts_blocks_hero" ADD CONSTRAINT "posts_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_hero_locales" ADD CONSTRAINT "posts_blocks_hero_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "posts_blocks_slideshow_slides" ADD CONSTRAINT "posts_blocks_slideshow_slides_bg_image_media_id_media_id_fk" FOREIGN KEY ("bg_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "posts_blocks_slideshow_slides" ADD CONSTRAINT "posts_blocks_slideshow_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_slideshow"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_slideshow_slides_locales" ADD CONSTRAINT "posts_blocks_slideshow_slides_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_slideshow_slides"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_slideshow" ADD CONSTRAINT "posts_blocks_slideshow_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "posts_blocks_featured_products" ADD CONSTRAINT "posts_blocks_featured_products_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_featured_products_locales" ADD CONSTRAINT "posts_blocks_featured_products_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_featured_products"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "posts_blocks_image_text" ADD CONSTRAINT "posts_blocks_image_text_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "posts_blocks_image_text" ADD CONSTRAINT "posts_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_image_text_locales" ADD CONSTRAINT "posts_blocks_image_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "posts_blocks_statement" ADD CONSTRAINT "posts_blocks_statement_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_statement_locales" ADD CONSTRAINT "posts_blocks_statement_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_statement"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "posts_blocks_rich_text" ADD CONSTRAINT "posts_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_rich_text_locales" ADD CONSTRAINT "posts_blocks_rich_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_rich_text"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "posts_blocks_cta_banner" ADD CONSTRAINT "posts_blocks_cta_banner_bg_image_media_id_media_id_fk" FOREIGN KEY ("bg_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "posts_blocks_cta_banner" ADD CONSTRAINT "posts_blocks_cta_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_cta_banner_locales" ADD CONSTRAINT "posts_blocks_cta_banner_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_cta_banner"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "posts_blocks_newsletter" ADD CONSTRAINT "posts_blocks_newsletter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_blocks_newsletter_locales" ADD CONSTRAINT "posts_blocks_newsletter_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_newsletter"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "posts" ADD CONSTRAINT "posts_featured_image_media_id_media_id_fk" FOREIGN KEY ("featured_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_products_id_products_id_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "posts_rels_parent_idx" ON "posts_rels" ("parent_id");
    CREATE INDEX "posts_rels_path_idx" ON "posts_rels" ("path");
    CREATE INDEX "posts_rels_products_id_idx" ON "posts_rels" ("products_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "posts_rels";
    DROP TABLE IF EXISTS "posts_locales";
    DROP TABLE IF EXISTS "posts_blocks_newsletter_locales";
    DROP TABLE IF EXISTS "posts_blocks_newsletter";
    DROP TABLE IF EXISTS "posts_blocks_cta_banner_locales";
    DROP TABLE IF EXISTS "posts_blocks_cta_banner";
    DROP TABLE IF EXISTS "posts_blocks_rich_text_locales";
    DROP TABLE IF EXISTS "posts_blocks_rich_text";
    DROP TABLE IF EXISTS "posts_blocks_statement_locales";
    DROP TABLE IF EXISTS "posts_blocks_statement";
    DROP TABLE IF EXISTS "posts_blocks_image_text_locales";
    DROP TABLE IF EXISTS "posts_blocks_image_text";
    DROP TABLE IF EXISTS "posts_blocks_featured_products_locales";
    DROP TABLE IF EXISTS "posts_blocks_featured_products";
    DROP TABLE IF EXISTS "posts_blocks_slideshow_slides_locales";
    DROP TABLE IF EXISTS "posts_blocks_slideshow_slides";
    DROP TABLE IF EXISTS "posts_blocks_slideshow";
    DROP TABLE IF EXISTS "posts_blocks_hero_locales";
    DROP TABLE IF EXISTS "posts_blocks_hero";
    DROP TABLE IF EXISTS "posts";

    DROP TYPE IF EXISTS "enum_posts_status";
    DROP TYPE IF EXISTS "enum_posts_blocks_image_text_image_position";
    DROP TYPE IF EXISTS "enum_posts_blocks_featured_products_source";
    DROP TYPE IF EXISTS "enum_posts_blocks_slideshow_height";
    DROP TYPE IF EXISTS "enum_posts_blocks_hero_min_height";
    DROP TYPE IF EXISTS "enum_posts_blocks_hero_text_align";

    DROP TABLE IF EXISTS "pages_blocks_newsletter_locales";
    DROP TABLE IF EXISTS "pages_blocks_newsletter";
    DROP TABLE IF EXISTS "homepage_blocks_newsletter_locales";
    DROP TABLE IF EXISTS "homepage_blocks_newsletter";

    ALTER TABLE "orders" DROP COLUMN IF EXISTS "utm_source";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "utm_medium";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "utm_campaign";
  `)
}
