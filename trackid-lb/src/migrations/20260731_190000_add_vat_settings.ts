// Hand-written (ROADMAP Part 3.1), same reasoning as the four prior
// hand-written migrations: the auto-generator's interactive rename-detection
// wizard has no TTY to answer its prompts under this runner. Every statement
// below is purely additive (new nullable/defaulted columns on site_settings)
// — checked field-by-field against the new SiteSettings Commerce-tab fields.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "vat_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "vat_rate" numeric DEFAULT 11;
  ALTER TABLE "site_settings" ADD COLUMN "vat_registration_number" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "vat_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "vat_rate";
  ALTER TABLE "site_settings" DROP COLUMN "vat_registration_number";`)
}
