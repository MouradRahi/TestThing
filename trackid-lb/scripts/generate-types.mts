/**
 * Programmatic `payload generate:types` — the standalone CLI can't load the config on
 * this machine (see scripts/migrate.mts header for the full story). No DB connection
 * needed. Run: node --import tsx scripts/generate-types.mts
 */
import { createRequire } from 'node:module'

const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor > 22) {
  console.error(
    `Node ${process.versions.node} silently breaks Payload tooling (generateTypes exits without writing). Run under Node LTS 20/22, e.g. \`nvm use 22\`.`,
  )
  process.exit(1)
}

// Same @next/env interop shim as migrate.mts — payload/node pulls loadEnv on import.
const cjsRequire = createRequire(import.meta.url)
const nextEnv = cjsRequire('@next/env')
if (!nextEnv.default) nextEnv.default = nextEnv

process.env.PAYLOAD_MIGRATE = 'true' // keep push off; config load only

const { default: config } = await import('../src/payload.config')
const { generateTypes } = await import('payload/node')

await generateTypes(await config)
// no process.exit — it races generateTypes' async file write; nothing holds the loop open
