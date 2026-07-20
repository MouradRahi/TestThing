/**
 * Programmatic Payload migration runner.
 *
 * The standalone Payload CLI (`npm run migrate:*`) is broken on this Windows machine on
 * every Node version tried (22/24/25): its scoped tsx loader can't resolve the config's
 * extensionless TS imports, and `--disable-transpile` then trips a CJS interop crash in
 * payload's @next/env loader. This script calls the same adapter methods the CLI would,
 * loading .env.local itself.
 *
 * Usage (Node LTS recommended, matches Vercel):
 *   node --import tsx scripts/migrate.mts status
 *   node --import tsx scripts/migrate.mts create <name>
 *   node --import tsx scripts/migrate.mts up
 *   node --import tsx scripts/migrate.mts down
 *
 * Vercel/Linux keeps using the normal `npm run migrate` CLI scripts.
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// @next/env is an ncc bundle with __esModule:true but no default export; payload's
// loadEnv does `import nextEnvImport from '@next/env'` which tsx's CJS interop turns
// into a crash. Pre-require it and graft a default self-reference into the cached
// exports so the destructure works.
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor > 22) {
  console.error(
    `Node ${process.versions.node} silently breaks Payload tooling. Run under Node LTS 20/22, e.g. \`nvm use 22\`.`,
  )
  process.exit(1)
}

const cjsRequire = createRequire(import.meta.url)
const nextEnv = cjsRequire('@next/env')
if (!nextEnv.default) nextEnv.default = nextEnv

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const envPath = path.join(root, '.env.local')
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted = value.match(/^(['"])(.*)\1$/)
    if (quoted) value = quoted[2]
    if (process.env[key] === undefined) process.env[key] = value
  }
}
process.env.PAYLOAD_MIGRATE = 'true'

const [cmd, name] = process.argv.slice(2)
if (
  !cmd ||
  !['status', 'create', 'up', 'down', 'mark'].includes(cmd) ||
  (['create', 'mark'].includes(cmd) && !name)
) {
  console.error(
    'Usage: node --import tsx scripts/migrate.mts <status | create <name> | up | down | mark <name>>',
  )
  process.exit(1)
}

const { default: config } = await import('../src/payload.config')
const { getPayload } = await import('payload')
const payload = await getPayload({ config })

switch (cmd) {
  case 'status':
    await payload.db.migrateStatus()
    break
  case 'create':
    await payload.db.createMigration({ migrationName: name, payload })
    break
  case 'up':
    await payload.db.migrate()
    break
  case 'down':
    await payload.db.migrateDown()
    break
  case 'mark': {
    // Baselining: record a migration as already applied WITHOUT running it —
    // for databases that already carry the schema (built up via dev pushes).
    const { docs } = await payload.find({
      collection: 'payload-migrations',
      where: { name: { equals: name } },
      limit: 1,
    })
    if (docs.length) {
      console.log(`Migration "${name}" is already marked as applied.`)
    } else {
      await payload.create({ collection: 'payload-migrations', data: { name, batch: 1 } })
      console.log(`Marked "${name}" as applied (batch 1) without running it.`)
    }
    break
  }
}

process.exit(0)
