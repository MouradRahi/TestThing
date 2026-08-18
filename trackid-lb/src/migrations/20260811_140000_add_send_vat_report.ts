// Fixes a migration I forgot to write earlier this session: `sendVatReport`
// was added to SiteSettings.ts's Reports tab but no migration ever created
// its column. Dev's push-mode auto-created it silently (which is exactly
// why this went unnoticed through all of this session's testing), but prod
// never auto-pushes — so the live `site_settings` table never got the
// column, and the admin's Site Settings global 404'd the moment the deployed
// code started expecting a field the DB doesn't have. `IF NOT EXISTS` on the
// way in (dev already silently has it) and `IF EXISTS` on the way out.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "send_vat_report" boolean DEFAULT false;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "send_vat_report";
  `)
}
