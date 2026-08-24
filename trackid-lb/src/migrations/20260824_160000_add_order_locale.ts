// Order locale (E12, ENHANCEMENTS.md) — the storefront locale at checkout,
// so confirmation/status emails render in the matching language. Mirrors
// the enum-select column shape every other Orders select field already uses.
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_orders_locale" AS ENUM('en', 'ar');
    ALTER TABLE "orders" ADD COLUMN "locale" "enum_orders_locale" DEFAULT 'en';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "locale";
    DROP TYPE IF EXISTS "public"."enum_orders_locale";
  `)
}
