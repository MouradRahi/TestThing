// Theme-adaptive favicon (dark-mode variant) + Apple touch icon — mirrors the
// existing favicon_media_id/favicon_url column shape exactly (see baseline
// migration). Purely additive, all nullable.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN "favicon_media_dark_id" integer;
    ALTER TABLE "site_settings" ADD COLUMN "favicon_url_dark" varchar;
    ALTER TABLE "site_settings" ADD COLUMN "apple_touch_icon_media_id" integer;
    ALTER TABLE "site_settings" ADD COLUMN "apple_touch_icon_url" varchar;

    ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_favicon_media_dark_id_media_id_fk"
      FOREIGN KEY ("favicon_media_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_apple_touch_icon_media_id_media_id_fk"
      FOREIGN KEY ("apple_touch_icon_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "site_settings_favicon_media_dark_idx" ON "site_settings" USING btree ("favicon_media_dark_id");
    CREATE INDEX "site_settings_apple_touch_icon_media_idx" ON "site_settings" USING btree ("apple_touch_icon_media_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "site_settings_apple_touch_icon_media_idx";
    DROP INDEX IF EXISTS "site_settings_favicon_media_dark_idx";
    ALTER TABLE "site_settings" DROP CONSTRAINT IF EXISTS "site_settings_apple_touch_icon_media_id_media_id_fk";
    ALTER TABLE "site_settings" DROP CONSTRAINT IF EXISTS "site_settings_favicon_media_dark_id_media_id_fk";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "apple_touch_icon_url";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "apple_touch_icon_media_id";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "favicon_url_dark";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "favicon_media_dark_id";
  `)
}
