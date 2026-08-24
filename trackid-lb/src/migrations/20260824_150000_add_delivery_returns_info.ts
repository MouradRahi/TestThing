// Delivery/returns info (E5, ENHANCEMENTS.md) — localized text shown as a
// collapsible section on product pages. Mirrors product_blurb's column shape
// (both are localized textarea fields living in site_settings_locales).
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings_locales" ADD COLUMN "delivery_info" varchar;
    ALTER TABLE "site_settings_locales" ADD COLUMN "returns_info" varchar;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings_locales" DROP COLUMN IF EXISTS "delivery_info";
    ALTER TABLE "site_settings_locales" DROP COLUMN IF EXISTS "returns_info";
  `)
}
