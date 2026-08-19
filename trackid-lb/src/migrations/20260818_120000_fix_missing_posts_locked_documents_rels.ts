// Production incident fix (2026-08-18): the F7 migration
// (20260817_100000_add_utm_newsletter_block_and_posts.ts) created the
// `posts` table itself but missed the one step every prior new-collection
// migration in this project has included — adding that collection's column
// to Payload's own internal `payload_locked_documents_rels` table (used for
// admin edit-lock tracking; every registered collection gets a nullable FK
// column there). Confirmed via a real Vercel runtime log: `column
// payload_locked_documents__rels.posts_id does not exist`, thrown on every
// /admin request (that table is queried unconditionally for the dashboard
// shell, so this took down the entire admin, not just Posts — same failure
// shape as the earlier rate_limit_counters and send_vat_report incidents).
// Dev never showed this because push-mode silently auto-created the column;
// prod, which is migration-only, never got it. Purely additive — mirrors
// the exact ADD COLUMN + FK + index shape every other collection addition
// migration in this project already uses (see e.g.
// 20260731_230000_add_returns_and_cart_recovery.ts's returns_id addition).
import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "posts_id" integer;
  `)
  // Constraint/index added separately so a re-run (if the column already
  // existed from push mode, as on dev) doesn't fail on a duplicate object.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_posts_fk"
        FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_posts_id_idx"
      ON "payload_locked_documents_rels" USING btree ("posts_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_posts_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_posts_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "posts_id";
  `)
}
