/**
 * Runs Payload migrations without the `payload` CLI (whose tsx loader chain
 * fails on this machine's Node — see bundle-config.mjs). Drives the same
 * adapter methods the CLI calls.
 *
 *   npm run migrate                → apply pending migrations
 *   npm run migrate:create <name>  → generate a migration from the schema diff
 *   npm run migrate:status         → list applied / pending
 *   npm run migrate:down           → roll back the last batch
 *   npm run migrate:fresh          → drop everything + re-run all (DEV ONLY)
 */
import path from 'node:path'
import { getPayload } from 'payload'
import { loadPayloadConfig } from './bundle-config.mjs'

// Signal the config to run in migration mode (turns dev push off)
process.env.PAYLOAD_MIGRATE = 'true'

const [command, nameArg] = process.argv.slice(2)

const config = await loadPayloadConfig()
const payload = await getPayload({ config })

// The bundled config's import.meta.url-derived migrationDir points at
// node_modules/.cache — force the real committed location.
payload.db.migrationDir = path.resolve('src/migrations')

try {
  switch (command ?? 'up') {
    case 'up':
      await payload.db.migrate()
      break
    case 'create':
      if (!nameArg) {
        console.error('Usage: npm run migrate:create <name>')
        process.exit(1)
      }
      await payload.db.createMigration({ migrationName: nameArg, payload })
      break
    case 'status':
      await payload.db.migrateStatus()
      break
    case 'down':
      await payload.db.migrateDown()
      break
    case 'mark': {
      // Baselining: record a migration as already applied WITHOUT running it —
      // for databases that already carry the schema (built up via dev pushes).
      if (!nameArg) {
        console.error('Usage: npm run migrate:mark <migration_name>')
        process.exit(1)
      }
      const { docs } = await payload.find({
        collection: 'payload-migrations',
        where: { name: { equals: nameArg } },
        limit: 1,
      })
      if (docs.length) {
        console.log(`Migration "${nameArg}" is already marked as applied.`)
      } else {
        await payload.create({ collection: 'payload-migrations', data: { name: nameArg, batch: 1 } })
        console.log(`Marked "${nameArg}" as applied (batch 1) without running it.`)
      }
      break
    }
    case 'fresh':
      if (process.env.NODE_ENV === 'production') {
        console.error('migrate:fresh destroys all data — refusing to run in production.')
        process.exit(1)
      }
      await payload.db.migrateFresh({ forceAcceptWarning: true })
      break
    default:
      console.error(`Unknown migrate command: ${command}`)
      process.exit(1)
  }
  process.exit(0)
} catch (err) {
  console.error(err)
  process.exit(1)
}
