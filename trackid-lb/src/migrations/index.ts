import * as migration_20260720_055440_baseline from './20260720_055440_baseline';
import * as migration_20260720_131107_add_rate_limit_and_idempotency from './20260720_131107_add_rate_limit_and_idempotency';
import * as migration_20260721_071235_add_audit_log from './20260721_071235_add_audit_log';

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
    name: '20260721_071235_add_audit_log'
  },
];
