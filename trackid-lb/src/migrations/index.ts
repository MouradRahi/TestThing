import * as migration_20260720_055440_baseline from './20260720_055440_baseline';

export const migrations = [
  {
    up: migration_20260720_055440_baseline.up,
    down: migration_20260720_055440_baseline.down,
    name: '20260720_055440_baseline'
  },
];
