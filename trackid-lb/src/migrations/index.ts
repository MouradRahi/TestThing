// Not imported anywhere — Payload's drizzle adapter scans `migrationDir`
// (set in payload.config.ts) directly off disk at runtime rather than
// reading this file. Kept only because `payload.db.createMigration()`
// regenerates it as a side effect of `npm run migrate:create`; it is NOT
// authoritative. Rebuilt from disk on 2026-08-26 (it had drifted again,
// missing the four 2026-08-24 migrations) — if you hand-write a migration,
// regenerate this too or it goes stale silently.

import * as migration_20260720_055440_baseline from './20260720_055440_baseline'
import * as migration_20260720_131107_add_rate_limit_and_idempotency from './20260720_131107_add_rate_limit_and_idempotency'
import * as migration_20260721_071235_add_audit_log from './20260721_071235_add_audit_log'
import * as migration_20260724_094930_add_payments_and_currency from './20260724_094930_add_payments_and_currency'
import * as migration_20260731_074810_add_omt_and_refunds from './20260731_074810_add_omt_and_refunds'
import * as migration_20260731_150000_add_analytics_and_scheduled_reports from './20260731_150000_add_analytics_and_scheduled_reports'
import * as migration_20260731_190000_add_vat_settings from './20260731_190000_add_vat_settings'
import * as migration_20260731_210000_add_courier_and_low_stock_alert from './20260731_210000_add_courier_and_low_stock_alert'
import * as migration_20260731_230000_add_returns_and_cart_recovery from './20260731_230000_add_returns_and_cart_recovery'
import * as migration_20260806_000000_add_reviews_gift_cards_bin_stock_bundles_loyalty from './20260806_000000_add_reviews_gift_cards_bin_stock_bundles_loyalty'
import * as migration_20260807_000000_add_2fa_and_login_rate_limit from './20260807_000000_add_2fa_and_login_rate_limit'
import * as migration_20260810_120000_localize_blocks_and_image_alt from './20260810_120000_localize_blocks_and_image_alt'
import * as migration_20260811_140000_add_send_vat_report from './20260811_140000_add_send_vat_report'
import * as migration_20260817_100000_add_utm_newsletter_block_and_posts from './20260817_100000_add_utm_newsletter_block_and_posts'
import * as migration_20260818_120000_fix_missing_posts_locked_documents_rels from './20260818_120000_fix_missing_posts_locked_documents_rels'
import * as migration_20260824_120000_add_dark_favicon_and_apple_touch_icon from './20260824_120000_add_dark_favicon_and_apple_touch_icon'
import * as migration_20260824_140000_add_google_site_verification from './20260824_140000_add_google_site_verification'
import * as migration_20260824_150000_add_delivery_returns_info from './20260824_150000_add_delivery_returns_info'
import * as migration_20260824_160000_add_order_locale from './20260824_160000_add_order_locale'
import * as migration_20260826_120000_add_admin_defined_taxonomies from './20260826_120000_add_admin_defined_taxonomies'
import * as migration_20260903_100000_add_process_steps_and_founder_note_blocks from './20260903_100000_add_process_steps_and_founder_note_blocks'

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
  {
    up: migration_20260824_120000_add_dark_favicon_and_apple_touch_icon.up,
    down: migration_20260824_120000_add_dark_favicon_and_apple_touch_icon.down,
    name: '20260824_120000_add_dark_favicon_and_apple_touch_icon',
  },
  {
    up: migration_20260824_140000_add_google_site_verification.up,
    down: migration_20260824_140000_add_google_site_verification.down,
    name: '20260824_140000_add_google_site_verification',
  },
  {
    up: migration_20260824_150000_add_delivery_returns_info.up,
    down: migration_20260824_150000_add_delivery_returns_info.down,
    name: '20260824_150000_add_delivery_returns_info',
  },
  {
    up: migration_20260824_160000_add_order_locale.up,
    down: migration_20260824_160000_add_order_locale.down,
    name: '20260824_160000_add_order_locale',
  },
  {
    up: migration_20260826_120000_add_admin_defined_taxonomies.up,
    down: migration_20260826_120000_add_admin_defined_taxonomies.down,
    name: '20260826_120000_add_admin_defined_taxonomies',
  },
  {
    up: migration_20260903_100000_add_process_steps_and_founder_note_blocks.up,
    down: migration_20260903_100000_add_process_steps_and_founder_note_blocks.down,
    name: '20260903_100000_add_process_steps_and_founder_note_blocks',
  },
];
