// About-page section blocks: "Process Steps" (a numbered how-it's-made strip)
// and "Founder Note" (a named human with a portrait), plus a `size` option on
// the existing Statement block so one statement can be a signature line and
// another a footnote.
//
// Purely additive. All three block builders — the Homepage global, the Pages
// collection and the Posts collection — share the same block list, so every
// table below exists in a homepage_/pages_/posts_ triplet.
//
// The DDL was generated from what Payload's own Drizzle push produced against
// the dev database, not hand-written — the truncated index names in particular
// (Postgres' 63-char identifier limit bites differently per prefix, e.g.
// `..._locales_locale_parent_id_uniqu` on homepage but `..._unique` on pages)
// are not something to transcribe by hand. Verified by dropping the pushed
// objects and re-running this file, then diffing the resulting schema.
//
// One deliberate data-preservation step: adding `size` with DEFAULT 'display'
// makes Postgres backfill EVERY existing row with 'display', which would
// silently resize statement blocks that are already live. The UPDATE right
// after pins everything that exists at migration time back to 'caption' (their
// current rendering); only blocks created afterwards pick up the new default.
// No new collections are registered here, so — unlike Session 28 part 6 —
// `payload_locked_documents_rels` needs no new column.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_homepage_blocks_statement_size" AS ENUM('display', 'caption');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_statement_size" AS ENUM('display', 'caption');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_posts_blocks_statement_size" AS ENUM('display', 'caption');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TABLE "homepage_blocks_statement" ADD COLUMN IF NOT EXISTS "size" "public"."enum_homepage_blocks_statement_size" DEFAULT 'display';
    ALTER TABLE "pages_blocks_statement" ADD COLUMN IF NOT EXISTS "size" "public"."enum_pages_blocks_statement_size" DEFAULT 'display';
    ALTER TABLE "posts_blocks_statement" ADD COLUMN IF NOT EXISTS "size" "public"."enum_posts_blocks_statement_size" DEFAULT 'display';

    -- Preserve the look of every statement block that already exists.
    UPDATE "homepage_blocks_statement" SET "size" = 'caption';
    UPDATE "pages_blocks_statement" SET "size" = 'caption';
    UPDATE "posts_blocks_statement" SET "size" = 'caption';

CREATE TABLE "homepage_blocks_founder_note" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "photo_media_id" integer,
    "photo" varchar,
    "name" varchar,
    "hidden" boolean DEFAULT false,
    "block_name" varchar
    );
    CREATE TABLE "homepage_blocks_founder_note_locales" (
    "photo_alt" varchar,
    "quote" varchar NOT NULL,
    "role" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );
    CREATE TABLE "homepage_blocks_process_steps" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "hidden" boolean DEFAULT false,
    "block_name" varchar
    );
    CREATE TABLE "homepage_blocks_process_steps_locales" (
    "eyebrow" varchar,
    "heading" varchar,
    "intro" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );
    CREATE TABLE "homepage_blocks_process_steps_steps" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL
    );
    CREATE TABLE "homepage_blocks_process_steps_steps_locales" (
    "title" varchar NOT NULL,
    "description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );
    CREATE TABLE "pages_blocks_founder_note" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "photo_media_id" integer,
    "photo" varchar,
    "name" varchar,
    "hidden" boolean DEFAULT false,
    "block_name" varchar
    );
    CREATE TABLE "pages_blocks_founder_note_locales" (
    "photo_alt" varchar,
    "quote" varchar NOT NULL,
    "role" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );
    CREATE TABLE "pages_blocks_process_steps" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "hidden" boolean DEFAULT false,
    "block_name" varchar
    );
    CREATE TABLE "pages_blocks_process_steps_locales" (
    "eyebrow" varchar,
    "heading" varchar,
    "intro" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );
    CREATE TABLE "pages_blocks_process_steps_steps" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL
    );
    CREATE TABLE "pages_blocks_process_steps_steps_locales" (
    "title" varchar NOT NULL,
    "description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );
    CREATE TABLE "posts_blocks_founder_note" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "photo_media_id" integer,
    "photo" varchar,
    "name" varchar,
    "hidden" boolean DEFAULT false,
    "block_name" varchar
    );
    CREATE TABLE "posts_blocks_founder_note_locales" (
    "photo_alt" varchar,
    "quote" varchar NOT NULL,
    "role" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );
    CREATE TABLE "posts_blocks_process_steps" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "hidden" boolean DEFAULT false,
    "block_name" varchar
    );
    CREATE TABLE "posts_blocks_process_steps_locales" (
    "eyebrow" varchar,
    "heading" varchar,
    "intro" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );
    CREATE TABLE "posts_blocks_process_steps_steps" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL
    );
    CREATE TABLE "posts_blocks_process_steps_steps_locales" (
    "title" varchar NOT NULL,
    "description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
    );

    ALTER TABLE "homepage_blocks_founder_note" ADD CONSTRAINT "homepage_blocks_founder_note_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES homepage(id) ON DELETE CASCADE;
    ALTER TABLE "homepage_blocks_founder_note" ADD CONSTRAINT "homepage_blocks_founder_note_photo_media_id_media_id_fk" FOREIGN KEY (photo_media_id) REFERENCES media(id) ON DELETE SET NULL;
    ALTER TABLE "homepage_blocks_founder_note_locales" ADD CONSTRAINT "homepage_blocks_founder_note_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES homepage_blocks_founder_note(id) ON DELETE CASCADE;
    ALTER TABLE "homepage_blocks_process_steps" ADD CONSTRAINT "homepage_blocks_process_steps_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES homepage(id) ON DELETE CASCADE;
    ALTER TABLE "homepage_blocks_process_steps_locales" ADD CONSTRAINT "homepage_blocks_process_steps_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES homepage_blocks_process_steps(id) ON DELETE CASCADE;
    ALTER TABLE "homepage_blocks_process_steps_steps" ADD CONSTRAINT "homepage_blocks_process_steps_steps_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES homepage_blocks_process_steps(id) ON DELETE CASCADE;
    ALTER TABLE "homepage_blocks_process_steps_steps_locales" ADD CONSTRAINT "homepage_blocks_process_steps_steps_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES homepage_blocks_process_steps_steps(id) ON DELETE CASCADE;
    ALTER TABLE "pages_blocks_founder_note" ADD CONSTRAINT "pages_blocks_founder_note_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES pages(id) ON DELETE CASCADE;
    ALTER TABLE "pages_blocks_founder_note" ADD CONSTRAINT "pages_blocks_founder_note_photo_media_id_media_id_fk" FOREIGN KEY (photo_media_id) REFERENCES media(id) ON DELETE SET NULL;
    ALTER TABLE "pages_blocks_founder_note_locales" ADD CONSTRAINT "pages_blocks_founder_note_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES pages_blocks_founder_note(id) ON DELETE CASCADE;
    ALTER TABLE "pages_blocks_process_steps" ADD CONSTRAINT "pages_blocks_process_steps_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES pages(id) ON DELETE CASCADE;
    ALTER TABLE "pages_blocks_process_steps_locales" ADD CONSTRAINT "pages_blocks_process_steps_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES pages_blocks_process_steps(id) ON DELETE CASCADE;
    ALTER TABLE "pages_blocks_process_steps_steps" ADD CONSTRAINT "pages_blocks_process_steps_steps_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES pages_blocks_process_steps(id) ON DELETE CASCADE;
    ALTER TABLE "pages_blocks_process_steps_steps_locales" ADD CONSTRAINT "pages_blocks_process_steps_steps_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES pages_blocks_process_steps_steps(id) ON DELETE CASCADE;
    ALTER TABLE "posts_blocks_founder_note" ADD CONSTRAINT "posts_blocks_founder_note_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES posts(id) ON DELETE CASCADE;
    ALTER TABLE "posts_blocks_founder_note" ADD CONSTRAINT "posts_blocks_founder_note_photo_media_id_media_id_fk" FOREIGN KEY (photo_media_id) REFERENCES media(id) ON DELETE SET NULL;
    ALTER TABLE "posts_blocks_founder_note_locales" ADD CONSTRAINT "posts_blocks_founder_note_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES posts_blocks_founder_note(id) ON DELETE CASCADE;
    ALTER TABLE "posts_blocks_process_steps" ADD CONSTRAINT "posts_blocks_process_steps_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES posts(id) ON DELETE CASCADE;
    ALTER TABLE "posts_blocks_process_steps_locales" ADD CONSTRAINT "posts_blocks_process_steps_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES posts_blocks_process_steps(id) ON DELETE CASCADE;
    ALTER TABLE "posts_blocks_process_steps_steps" ADD CONSTRAINT "posts_blocks_process_steps_steps_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES posts_blocks_process_steps(id) ON DELETE CASCADE;
    ALTER TABLE "posts_blocks_process_steps_steps_locales" ADD CONSTRAINT "posts_blocks_process_steps_steps_locales_parent_id_fk" FOREIGN KEY (_parent_id) REFERENCES posts_blocks_process_steps_steps(id) ON DELETE CASCADE;

    CREATE INDEX homepage_blocks_founder_note_order_idx ON public.homepage_blocks_founder_note USING btree (_order);
    CREATE INDEX homepage_blocks_founder_note_parent_id_idx ON public.homepage_blocks_founder_note USING btree (_parent_id);
    CREATE INDEX homepage_blocks_founder_note_path_idx ON public.homepage_blocks_founder_note USING btree (_path);
    CREATE INDEX homepage_blocks_founder_note_photo_media_idx ON public.homepage_blocks_founder_note USING btree (photo_media_id);
    CREATE UNIQUE INDEX homepage_blocks_founder_note_locales_locale_parent_id_unique ON public.homepage_blocks_founder_note_locales USING btree (_locale, _parent_id);
    CREATE INDEX homepage_blocks_process_steps_order_idx ON public.homepage_blocks_process_steps USING btree (_order);
    CREATE INDEX homepage_blocks_process_steps_parent_id_idx ON public.homepage_blocks_process_steps USING btree (_parent_id);
    CREATE INDEX homepage_blocks_process_steps_path_idx ON public.homepage_blocks_process_steps USING btree (_path);
    CREATE UNIQUE INDEX homepage_blocks_process_steps_locales_locale_parent_id_uniqu ON public.homepage_blocks_process_steps_locales USING btree (_locale, _parent_id);
    CREATE INDEX homepage_blocks_process_steps_steps_order_idx ON public.homepage_blocks_process_steps_steps USING btree (_order);
    CREATE INDEX homepage_blocks_process_steps_steps_parent_id_idx ON public.homepage_blocks_process_steps_steps USING btree (_parent_id);
    CREATE UNIQUE INDEX homepage_blocks_process_steps_steps_locales_locale_parent_id ON public.homepage_blocks_process_steps_steps_locales USING btree (_locale, _parent_id);
    CREATE INDEX pages_blocks_founder_note_order_idx ON public.pages_blocks_founder_note USING btree (_order);
    CREATE INDEX pages_blocks_founder_note_parent_id_idx ON public.pages_blocks_founder_note USING btree (_parent_id);
    CREATE INDEX pages_blocks_founder_note_path_idx ON public.pages_blocks_founder_note USING btree (_path);
    CREATE INDEX pages_blocks_founder_note_photo_media_idx ON public.pages_blocks_founder_note USING btree (photo_media_id);
    CREATE UNIQUE INDEX pages_blocks_founder_note_locales_locale_parent_id_unique ON public.pages_blocks_founder_note_locales USING btree (_locale, _parent_id);
    CREATE INDEX pages_blocks_process_steps_order_idx ON public.pages_blocks_process_steps USING btree (_order);
    CREATE INDEX pages_blocks_process_steps_parent_id_idx ON public.pages_blocks_process_steps USING btree (_parent_id);
    CREATE INDEX pages_blocks_process_steps_path_idx ON public.pages_blocks_process_steps USING btree (_path);
    CREATE UNIQUE INDEX pages_blocks_process_steps_locales_locale_parent_id_unique ON public.pages_blocks_process_steps_locales USING btree (_locale, _parent_id);
    CREATE INDEX pages_blocks_process_steps_steps_order_idx ON public.pages_blocks_process_steps_steps USING btree (_order);
    CREATE INDEX pages_blocks_process_steps_steps_parent_id_idx ON public.pages_blocks_process_steps_steps USING btree (_parent_id);
    CREATE UNIQUE INDEX pages_blocks_process_steps_steps_locales_locale_parent_id_un ON public.pages_blocks_process_steps_steps_locales USING btree (_locale, _parent_id);
    CREATE INDEX posts_blocks_founder_note_order_idx ON public.posts_blocks_founder_note USING btree (_order);
    CREATE INDEX posts_blocks_founder_note_parent_id_idx ON public.posts_blocks_founder_note USING btree (_parent_id);
    CREATE INDEX posts_blocks_founder_note_path_idx ON public.posts_blocks_founder_note USING btree (_path);
    CREATE INDEX posts_blocks_founder_note_photo_media_idx ON public.posts_blocks_founder_note USING btree (photo_media_id);
    CREATE UNIQUE INDEX posts_blocks_founder_note_locales_locale_parent_id_unique ON public.posts_blocks_founder_note_locales USING btree (_locale, _parent_id);
    CREATE INDEX posts_blocks_process_steps_order_idx ON public.posts_blocks_process_steps USING btree (_order);
    CREATE INDEX posts_blocks_process_steps_parent_id_idx ON public.posts_blocks_process_steps USING btree (_parent_id);
    CREATE INDEX posts_blocks_process_steps_path_idx ON public.posts_blocks_process_steps USING btree (_path);
    CREATE UNIQUE INDEX posts_blocks_process_steps_locales_locale_parent_id_unique ON public.posts_blocks_process_steps_locales USING btree (_locale, _parent_id);
    CREATE INDEX posts_blocks_process_steps_steps_order_idx ON public.posts_blocks_process_steps_steps USING btree (_order);
    CREATE INDEX posts_blocks_process_steps_steps_parent_id_idx ON public.posts_blocks_process_steps_steps USING btree (_parent_id);
    CREATE UNIQUE INDEX posts_blocks_process_steps_steps_locales_locale_parent_id_un ON public.posts_blocks_process_steps_steps_locales USING btree (_locale, _parent_id);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
DROP TABLE IF EXISTS "posts_blocks_process_steps_steps_locales" CASCADE;
    DROP TABLE IF EXISTS "posts_blocks_process_steps_steps" CASCADE;
    DROP TABLE IF EXISTS "posts_blocks_process_steps_locales" CASCADE;
    DROP TABLE IF EXISTS "posts_blocks_process_steps" CASCADE;
    DROP TABLE IF EXISTS "posts_blocks_founder_note_locales" CASCADE;
    DROP TABLE IF EXISTS "posts_blocks_founder_note" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_process_steps_steps_locales" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_process_steps_steps" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_process_steps_locales" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_process_steps" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_founder_note_locales" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_founder_note" CASCADE;
    DROP TABLE IF EXISTS "homepage_blocks_process_steps_steps_locales" CASCADE;
    DROP TABLE IF EXISTS "homepage_blocks_process_steps_steps" CASCADE;
    DROP TABLE IF EXISTS "homepage_blocks_process_steps_locales" CASCADE;
    DROP TABLE IF EXISTS "homepage_blocks_process_steps" CASCADE;
    DROP TABLE IF EXISTS "homepage_blocks_founder_note_locales" CASCADE;
    DROP TABLE IF EXISTS "homepage_blocks_founder_note" CASCADE;

    ALTER TABLE "homepage_blocks_statement" DROP COLUMN IF EXISTS "size";
    ALTER TABLE "pages_blocks_statement" DROP COLUMN IF EXISTS "size";
    ALTER TABLE "posts_blocks_statement" DROP COLUMN IF EXISTS "size";

    DROP TYPE IF EXISTS "public"."enum_homepage_blocks_statement_size";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_statement_size";
    DROP TYPE IF EXISTS "public"."enum_posts_blocks_statement_size";
  `)
}
