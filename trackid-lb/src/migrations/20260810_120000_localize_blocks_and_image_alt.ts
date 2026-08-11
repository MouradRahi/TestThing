// Hand-written (ENHANCEMENTS E13 leftover: homepage-block text + product-
// image alt localization, deferred since Session 10/18) — same reasoning as
// every prior hand-written migration in this project: the auto-generator's
// interactive rename-detection wizard has no TTY to answer its prompts under
// this runner. This one is data-preserving by hand, following MIGRATIONS.md's
// "localize an existing field" recipe: create each new `_locales` table,
// COPY existing column values into the `en` locale, THEN drop the old
// top-level column — never drop first, or every value blanks (the exact
// Session 18 incident this recipe exists to prevent).
//
// Scope: products.images[].alt, plus the localizable copy fields on all 7
// homepage/page section blocks (hero, slideshow slides, featured-products,
// image-text, statement, rich-text, cta-banner) — URLs/hrefs/colors/selects
// stay unlocalized. Pages uses the identical block configs as Homepage
// (src/globals/blocks/*.ts, shared), so both `homepage_blocks_*` and
// `pages_blocks_*` need the same treatment — confirmed against the baseline
// migration's table list before writing this (pages_blocks_hero etc. exist
// as separate tables, not shared with homepage_blocks_hero).
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- products.images[].alt
    CREATE TABLE "products_images_locales" (
      "alt" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "products_images_locales" ("alt", "_locale", "_parent_id")
      SELECT "alt", 'en', "id" FROM "products_images";
    ALTER TABLE "products_images" DROP COLUMN "alt";
    ALTER TABLE "products_images_locales" ADD CONSTRAINT "products_images_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."products_images"("id") ON DELETE cascade ON UPDATE no action;

    -- homepage_blocks_hero / pages_blocks_hero
    CREATE TABLE "homepage_blocks_hero_locales" (
      "eyebrow" varchar,
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "secondary_cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "homepage_blocks_hero_locales" ("eyebrow", "headline", "subline", "cta_label", "secondary_cta_label", "_locale", "_parent_id")
      SELECT "eyebrow", "headline", "subline", "cta_label", "secondary_cta_label", 'en', "id" FROM "homepage_blocks_hero";
    ALTER TABLE "homepage_blocks_hero" DROP COLUMN "eyebrow", DROP COLUMN "headline", DROP COLUMN "subline", DROP COLUMN "cta_label", DROP COLUMN "secondary_cta_label";
    ALTER TABLE "homepage_blocks_hero_locales" ADD CONSTRAINT "homepage_blocks_hero_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;

    CREATE TABLE "pages_blocks_hero_locales" (
      "eyebrow" varchar,
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "secondary_cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "pages_blocks_hero_locales" ("eyebrow", "headline", "subline", "cta_label", "secondary_cta_label", "_locale", "_parent_id")
      SELECT "eyebrow", "headline", "subline", "cta_label", "secondary_cta_label", 'en', "id" FROM "pages_blocks_hero";
    ALTER TABLE "pages_blocks_hero" DROP COLUMN "eyebrow", DROP COLUMN "headline", DROP COLUMN "subline", DROP COLUMN "cta_label", DROP COLUMN "secondary_cta_label";
    ALTER TABLE "pages_blocks_hero_locales" ADD CONSTRAINT "pages_blocks_hero_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;

    -- homepage_blocks_slideshow_slides / pages_blocks_slideshow_slides
    CREATE TABLE "homepage_blocks_slideshow_slides_locales" (
      "eyebrow" varchar,
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "homepage_blocks_slideshow_slides_locales" ("eyebrow", "headline", "subline", "cta_label", "_locale", "_parent_id")
      SELECT "eyebrow", "headline", "subline", "cta_label", 'en', "id" FROM "homepage_blocks_slideshow_slides";
    ALTER TABLE "homepage_blocks_slideshow_slides" DROP COLUMN "eyebrow", DROP COLUMN "headline", DROP COLUMN "subline", DROP COLUMN "cta_label";
    ALTER TABLE "homepage_blocks_slideshow_slides_locales" ADD CONSTRAINT "homepage_blocks_slideshow_slides_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_slideshow_slides"("id") ON DELETE cascade ON UPDATE no action;

    CREATE TABLE "pages_blocks_slideshow_slides_locales" (
      "eyebrow" varchar,
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "pages_blocks_slideshow_slides_locales" ("eyebrow", "headline", "subline", "cta_label", "_locale", "_parent_id")
      SELECT "eyebrow", "headline", "subline", "cta_label", 'en', "id" FROM "pages_blocks_slideshow_slides";
    ALTER TABLE "pages_blocks_slideshow_slides" DROP COLUMN "eyebrow", DROP COLUMN "headline", DROP COLUMN "subline", DROP COLUMN "cta_label";
    ALTER TABLE "pages_blocks_slideshow_slides_locales" ADD CONSTRAINT "pages_blocks_slideshow_slides_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_slideshow_slides"("id") ON DELETE cascade ON UPDATE no action;

    -- homepage_blocks_featured_products / pages_blocks_featured_products
    CREATE TABLE "homepage_blocks_featured_products_locales" (
      "section_title" varchar DEFAULT 'Latest Drops',
      "view_all_label" varchar DEFAULT 'View all →',
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "homepage_blocks_featured_products_locales" ("section_title", "view_all_label", "_locale", "_parent_id")
      SELECT "section_title", "view_all_label", 'en', "id" FROM "homepage_blocks_featured_products";
    ALTER TABLE "homepage_blocks_featured_products" DROP COLUMN "section_title", DROP COLUMN "view_all_label";
    ALTER TABLE "homepage_blocks_featured_products_locales" ADD CONSTRAINT "homepage_blocks_featured_products_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_featured_products"("id") ON DELETE cascade ON UPDATE no action;

    CREATE TABLE "pages_blocks_featured_products_locales" (
      "section_title" varchar DEFAULT 'Latest Drops',
      "view_all_label" varchar DEFAULT 'View all →',
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "pages_blocks_featured_products_locales" ("section_title", "view_all_label", "_locale", "_parent_id")
      SELECT "section_title", "view_all_label", 'en', "id" FROM "pages_blocks_featured_products";
    ALTER TABLE "pages_blocks_featured_products" DROP COLUMN "section_title", DROP COLUMN "view_all_label";
    ALTER TABLE "pages_blocks_featured_products_locales" ADD CONSTRAINT "pages_blocks_featured_products_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_featured_products"("id") ON DELETE cascade ON UPDATE no action;

    -- homepage_blocks_image_text / pages_blocks_image_text
    CREATE TABLE "homepage_blocks_image_text_locales" (
      "image_alt" varchar,
      "eyebrow" varchar,
      "heading" varchar,
      "body" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "homepage_blocks_image_text_locales" ("image_alt", "eyebrow", "heading", "body", "cta_label", "_locale", "_parent_id")
      SELECT "image_alt", "eyebrow", "heading", "body", "cta_label", 'en', "id" FROM "homepage_blocks_image_text";
    ALTER TABLE "homepage_blocks_image_text" DROP COLUMN "image_alt", DROP COLUMN "eyebrow", DROP COLUMN "heading", DROP COLUMN "body", DROP COLUMN "cta_label";
    ALTER TABLE "homepage_blocks_image_text_locales" ADD CONSTRAINT "homepage_blocks_image_text_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;

    CREATE TABLE "pages_blocks_image_text_locales" (
      "image_alt" varchar,
      "eyebrow" varchar,
      "heading" varchar,
      "body" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "pages_blocks_image_text_locales" ("image_alt", "eyebrow", "heading", "body", "cta_label", "_locale", "_parent_id")
      SELECT "image_alt", "eyebrow", "heading", "body", "cta_label", 'en', "id" FROM "pages_blocks_image_text";
    ALTER TABLE "pages_blocks_image_text" DROP COLUMN "image_alt", DROP COLUMN "eyebrow", DROP COLUMN "heading", DROP COLUMN "body", DROP COLUMN "cta_label";
    ALTER TABLE "pages_blocks_image_text_locales" ADD CONSTRAINT "pages_blocks_image_text_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;

    -- homepage_blocks_statement / pages_blocks_statement (required — NOT NULL)
    CREATE TABLE "homepage_blocks_statement_locales" (
      "text" varchar NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "homepage_blocks_statement_locales" ("text", "_locale", "_parent_id")
      SELECT COALESCE("text", ''), 'en', "id" FROM "homepage_blocks_statement";
    ALTER TABLE "homepage_blocks_statement" DROP COLUMN "text";
    ALTER TABLE "homepage_blocks_statement_locales" ADD CONSTRAINT "homepage_blocks_statement_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_statement"("id") ON DELETE cascade ON UPDATE no action;

    CREATE TABLE "pages_blocks_statement_locales" (
      "text" varchar NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "pages_blocks_statement_locales" ("text", "_locale", "_parent_id")
      SELECT COALESCE("text", ''), 'en', "id" FROM "pages_blocks_statement";
    ALTER TABLE "pages_blocks_statement" DROP COLUMN "text";
    ALTER TABLE "pages_blocks_statement_locales" ADD CONSTRAINT "pages_blocks_statement_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_statement"("id") ON DELETE cascade ON UPDATE no action;

    -- homepage_blocks_rich_text / pages_blocks_rich_text
    CREATE TABLE "homepage_blocks_rich_text_locales" (
      "content" jsonb,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "homepage_blocks_rich_text_locales" ("content", "_locale", "_parent_id")
      SELECT "content", 'en', "id" FROM "homepage_blocks_rich_text";
    ALTER TABLE "homepage_blocks_rich_text" DROP COLUMN "content";
    ALTER TABLE "homepage_blocks_rich_text_locales" ADD CONSTRAINT "homepage_blocks_rich_text_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_rich_text"("id") ON DELETE cascade ON UPDATE no action;

    CREATE TABLE "pages_blocks_rich_text_locales" (
      "content" jsonb,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "pages_blocks_rich_text_locales" ("content", "_locale", "_parent_id")
      SELECT "content", 'en', "id" FROM "pages_blocks_rich_text";
    ALTER TABLE "pages_blocks_rich_text" DROP COLUMN "content";
    ALTER TABLE "pages_blocks_rich_text_locales" ADD CONSTRAINT "pages_blocks_rich_text_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_rich_text"("id") ON DELETE cascade ON UPDATE no action;

    -- homepage_blocks_cta_banner / pages_blocks_cta_banner
    CREATE TABLE "homepage_blocks_cta_banner_locales" (
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "homepage_blocks_cta_banner_locales" ("headline", "subline", "cta_label", "_locale", "_parent_id")
      SELECT "headline", "subline", "cta_label", 'en', "id" FROM "homepage_blocks_cta_banner";
    ALTER TABLE "homepage_blocks_cta_banner" DROP COLUMN "headline", DROP COLUMN "subline", DROP COLUMN "cta_label";
    ALTER TABLE "homepage_blocks_cta_banner_locales" ADD CONSTRAINT "homepage_blocks_cta_banner_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_cta_banner"("id") ON DELETE cascade ON UPDATE no action;

    CREATE TABLE "pages_blocks_cta_banner_locales" (
      "headline" varchar,
      "subline" varchar,
      "cta_label" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" varchar NOT NULL
    );
    INSERT INTO "pages_blocks_cta_banner_locales" ("headline", "subline", "cta_label", "_locale", "_parent_id")
      SELECT "headline", "subline", "cta_label", 'en', "id" FROM "pages_blocks_cta_banner";
    ALTER TABLE "pages_blocks_cta_banner" DROP COLUMN "headline", DROP COLUMN "subline", DROP COLUMN "cta_label";
    ALTER TABLE "pages_blocks_cta_banner_locales" ADD CONSTRAINT "pages_blocks_cta_banner_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_cta_banner"("id") ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products_images" ADD COLUMN "alt" varchar;
    UPDATE "products_images" p SET "alt" = l."alt" FROM "products_images_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "products_images_locales";

    ALTER TABLE "homepage_blocks_hero" ADD COLUMN "eyebrow" varchar, ADD COLUMN "headline" varchar, ADD COLUMN "subline" varchar, ADD COLUMN "cta_label" varchar, ADD COLUMN "secondary_cta_label" varchar;
    UPDATE "homepage_blocks_hero" p SET "eyebrow" = l."eyebrow", "headline" = l."headline", "subline" = l."subline", "cta_label" = l."cta_label", "secondary_cta_label" = l."secondary_cta_label" FROM "homepage_blocks_hero_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "homepage_blocks_hero_locales";

    ALTER TABLE "pages_blocks_hero" ADD COLUMN "eyebrow" varchar, ADD COLUMN "headline" varchar, ADD COLUMN "subline" varchar, ADD COLUMN "cta_label" varchar, ADD COLUMN "secondary_cta_label" varchar;
    UPDATE "pages_blocks_hero" p SET "eyebrow" = l."eyebrow", "headline" = l."headline", "subline" = l."subline", "cta_label" = l."cta_label", "secondary_cta_label" = l."secondary_cta_label" FROM "pages_blocks_hero_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "pages_blocks_hero_locales";

    ALTER TABLE "homepage_blocks_slideshow_slides" ADD COLUMN "eyebrow" varchar, ADD COLUMN "headline" varchar, ADD COLUMN "subline" varchar, ADD COLUMN "cta_label" varchar;
    UPDATE "homepage_blocks_slideshow_slides" p SET "eyebrow" = l."eyebrow", "headline" = l."headline", "subline" = l."subline", "cta_label" = l."cta_label" FROM "homepage_blocks_slideshow_slides_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "homepage_blocks_slideshow_slides_locales";

    ALTER TABLE "pages_blocks_slideshow_slides" ADD COLUMN "eyebrow" varchar, ADD COLUMN "headline" varchar, ADD COLUMN "subline" varchar, ADD COLUMN "cta_label" varchar;
    UPDATE "pages_blocks_slideshow_slides" p SET "eyebrow" = l."eyebrow", "headline" = l."headline", "subline" = l."subline", "cta_label" = l."cta_label" FROM "pages_blocks_slideshow_slides_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "pages_blocks_slideshow_slides_locales";

    ALTER TABLE "homepage_blocks_featured_products" ADD COLUMN "section_title" varchar DEFAULT 'Latest Drops', ADD COLUMN "view_all_label" varchar DEFAULT 'View all →';
    UPDATE "homepage_blocks_featured_products" p SET "section_title" = l."section_title", "view_all_label" = l."view_all_label" FROM "homepage_blocks_featured_products_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "homepage_blocks_featured_products_locales";

    ALTER TABLE "pages_blocks_featured_products" ADD COLUMN "section_title" varchar DEFAULT 'Latest Drops', ADD COLUMN "view_all_label" varchar DEFAULT 'View all →';
    UPDATE "pages_blocks_featured_products" p SET "section_title" = l."section_title", "view_all_label" = l."view_all_label" FROM "pages_blocks_featured_products_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "pages_blocks_featured_products_locales";

    ALTER TABLE "homepage_blocks_image_text" ADD COLUMN "image_alt" varchar, ADD COLUMN "eyebrow" varchar, ADD COLUMN "heading" varchar, ADD COLUMN "body" varchar, ADD COLUMN "cta_label" varchar;
    UPDATE "homepage_blocks_image_text" p SET "image_alt" = l."image_alt", "eyebrow" = l."eyebrow", "heading" = l."heading", "body" = l."body", "cta_label" = l."cta_label" FROM "homepage_blocks_image_text_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "homepage_blocks_image_text_locales";

    ALTER TABLE "pages_blocks_image_text" ADD COLUMN "image_alt" varchar, ADD COLUMN "eyebrow" varchar, ADD COLUMN "heading" varchar, ADD COLUMN "body" varchar, ADD COLUMN "cta_label" varchar;
    UPDATE "pages_blocks_image_text" p SET "image_alt" = l."image_alt", "eyebrow" = l."eyebrow", "heading" = l."heading", "body" = l."body", "cta_label" = l."cta_label" FROM "pages_blocks_image_text_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "pages_blocks_image_text_locales";

    ALTER TABLE "homepage_blocks_statement" ADD COLUMN "text" varchar;
    UPDATE "homepage_blocks_statement" p SET "text" = l."text" FROM "homepage_blocks_statement_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    ALTER TABLE "homepage_blocks_statement" ALTER COLUMN "text" SET NOT NULL;
    DROP TABLE "homepage_blocks_statement_locales";

    ALTER TABLE "pages_blocks_statement" ADD COLUMN "text" varchar;
    UPDATE "pages_blocks_statement" p SET "text" = l."text" FROM "pages_blocks_statement_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    ALTER TABLE "pages_blocks_statement" ALTER COLUMN "text" SET NOT NULL;
    DROP TABLE "pages_blocks_statement_locales";

    ALTER TABLE "homepage_blocks_rich_text" ADD COLUMN "content" jsonb;
    UPDATE "homepage_blocks_rich_text" p SET "content" = l."content" FROM "homepage_blocks_rich_text_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "homepage_blocks_rich_text_locales";

    ALTER TABLE "pages_blocks_rich_text" ADD COLUMN "content" jsonb;
    UPDATE "pages_blocks_rich_text" p SET "content" = l."content" FROM "pages_blocks_rich_text_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "pages_blocks_rich_text_locales";

    ALTER TABLE "homepage_blocks_cta_banner" ADD COLUMN "headline" varchar, ADD COLUMN "subline" varchar, ADD COLUMN "cta_label" varchar;
    UPDATE "homepage_blocks_cta_banner" p SET "headline" = l."headline", "subline" = l."subline", "cta_label" = l."cta_label" FROM "homepage_blocks_cta_banner_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "homepage_blocks_cta_banner_locales";

    ALTER TABLE "pages_blocks_cta_banner" ADD COLUMN "headline" varchar, ADD COLUMN "subline" varchar, ADD COLUMN "cta_label" varchar;
    UPDATE "pages_blocks_cta_banner" p SET "headline" = l."headline", "subline" = l."subline", "cta_label" = l."cta_label" FROM "pages_blocks_cta_banner_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'en';
    DROP TABLE "pages_blocks_cta_banner_locales";
  `)
}
