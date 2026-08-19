// Not imported anywhere — Payload's drizzle adapter scans `migrationDir`
// (set in payload.config.ts) directly off disk at runtime rather than
// reading this file. Kept only because `payload.db.createMigration()`
// regenerates it as a side effect of `npm run migrate:create`; it was
// missing the two most recent migrations, which would have been misleading
// to anyone who assumed this file was authoritative. Rebuilt to match
// src/migrations/*.ts.
import * as migration_20260720_055440_baseline from './20260720_055440_baseline';
import * as migration_20260720_131107_add_rate_limit_and_idempotency from './20260720_131107_add_rate_limit_and_idempotency';
import * as migration_20260721_071235_add_audit_log from './20260721_071235_add_audit_log';
import * as migration_20260724_094930_add_payments_and_currency from './20260724_094930_add_payments_and_currency';
import * as migration_20260731_074810_add_omt_and_refunds from './20260731_074810_add_omt_and_refunds';
import * as migration_20260731_150000_add_analytics_and_scheduled_reports from './20260731_150000_add_analytics_and_scheduled_reports';
import * as migration_20260731_190000_add_vat_settings from './20260731_190000_add_vat_settings';
import * as migration_20260731_210000_add_courier_and_low_stock_alert from './20260731_210000_add_courier_and_low_stock_alert';
import * as migration_20260731_230000_add_returns_and_cart_recovery from './20260731_230000_add_returns_and_cart_recovery';
import * as migration_20260806_000000_add_reviews_gift_cards_bin_stock_bundles_loyalty from './20260806_000000_add_reviews_gift_cards_bin_stock_bundles_loyalty';
import * as migration_20260807_000000_add_2fa_and_login_rate_limit from './20260807_000000_add_2fa_and_login_rate_limit';
import * as migration_20260810_120000_localize_blocks_and_image_alt from './20260810_120000_localize_blocks_and_image_alt';
import * as migration_20260811_140000_add_send_vat_report from './20260811_140000_add_send_vat_report';
import * as migration_20260817_100000_add_utm_newsletter_block_and_posts from './20260817_100000_add_utm_newsletter_block_and_posts';
import * as migration_20260818_120000_fix_missing_posts_locked_documents_rels from './20260818_120000_fix_missing_posts_locked_documents_rels';

export const migrations = [
  {
    up: migration_20260720_055440_baseline.up,
    down: migration_20260720_055440_baseline.down,
    name: '20260720_055440_baseline',
  },
  {
    up: migration_20260720_131107_add_rate_limit_and_idempotency.up,
    down: migration_20260720_131107_add_rate_limit_and_idempotency.down,
    name: '20260720_131107_add_rate_limit_and_idempotency',
  },
  {
    up: migration_20260721_071235_add_audit_log.up,
    down: migration_20260721_071235_add_audit_log.down,
    name: '20260721_071235_add_audit_log',
  },
  {
    up: migration_20260724_094930_add_payments_and_currency.up,
    down: migration_20260724_094930_add_payments_and_currency.down,
    name: '20260724_094930_add_payments_and_currency',
  },
  {
    up: migration_20260731_074810_add_omt_and_refunds.up,
    down: migration_20260731_074810_add_omt_and_refunds.down,
    name: '20260731_074810_add_omt_and_refunds',
  },
  {
    up: migration_20260731_150000_add_analytics_and_scheduled_reports.up,
    down: migration_20260731_150000_add_analytics_and_scheduled_reports.down,
    name: '20260731_150000_add_analytics_and_scheduled_reports',
  },
  {
    up: migration_20260731_190000_add_vat_settings.up,
    down: migration_20260731_190000_add_vat_settings.down,
    name: '20260731_190000_add_vat_settings',
  },
  {
    up: migration_20260731_210000_add_courier_and_low_stock_alert.up,
    down: migration_20260731_210000_add_courier_and_low_stock_alert.down,
    name: '20260731_210000_add_courier_and_low_stock_alert',
  },
  {
    up: migration_20260731_230000_add_returns_and_cart_recovery.up,
    down: migration_20260731_230000_add_returns_and_cart_recovery.down,
    name: '20260731_230000_add_returns_and_cart_recovery',
  },
  {
    up: migration_20260806_000000_add_reviews_gift_cards_bin_stock_bundles_loyalty.up,
    down: migration_20260806_000000_add_reviews_gift_cards_bin_stock_bundles_loyalty.down,
    name: '20260806_000000_add_reviews_gift_cards_bin_stock_bundles_loyalty',
  },
  {
    up: migration_20260807_000000_add_2fa_and_login_rate_limit.up,
    down: migration_20260807_000000_add_2fa_and_login_rate_limit.down,
    name: '20260807_000000_add_2fa_and_login_rate_limit',
  },
  {
    up: migration_20260810_120000_localize_blocks_and_image_alt.up,
    down: migration_20260810_120000_localize_blocks_and_image_alt.down,
    name: '20260810_120000_localize_blocks_and_image_alt',
  },
  {
    up: migration_20260811_140000_add_send_vat_report.up,
    down: migration_20260811_140000_add_send_vat_report.down,
    name: '20260811_140000_add_send_vat_report',
  },
  {
    up: migration_20260817_100000_add_utm_newsletter_block_and_posts.up,
    down: migration_20260817_100000_add_utm_newsletter_block_and_posts.down,
    name: '20260817_100000_add_utm_newsletter_block_and_posts',
  },
  {
    up: migration_20260818_120000_fix_missing_posts_locked_documents_rels.up,
    down: migration_20260818_120000_fix_missing_posts_locked_documents_rels.down,
    name: '20260818_120000_fix_missing_posts_locked_documents_rels',
  },
];
