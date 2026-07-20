/**
 * Loads the sanitized Payload config outside of Next.js.
 *
 * The `payload` CLI's tsx loader chain fails on this machine's Node
 * (extensionless TS imports + `?namespace=` cache-busting + a CJS interop
 * crash in payload's loadEnv). Instead, bundle src/payload.config.ts with
 * esbuild — which resolves extensionless imports and tsconfig paths fine —
 * and import the bundle natively. Used by generate-types.mjs and migrate.mjs.
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import nextEnv from '@next/env'

// The config graph imports Next runtime modules (revalidation hooks use
// next/cache). They're irrelevant outside a Next server, so stub them.
const stubNext = {
  name: 'stub-next-runtime',
  setup(b) {
    b.onResolve({ filter: /^next\/(cache|headers|navigation|server)$/ }, (args) => ({
      path: args.path,
      namespace: 'next-stub',
    }))
    b.onLoad({ filter: /.*/, namespace: 'next-stub' }, () => ({
      contents: `
        export const revalidatePath = () => {}
        export const revalidateTag = () => {}
        export const unstable_cache = (fn) => fn
        export const cookies = () => { throw new Error('next/headers stub') }
        export const headers = () => { throw new Error('next/headers stub') }
        export const after = (fn) => { void fn }
      `,
      loader: 'js',
    }))
  },
}

/** Bundle + import src/payload.config.ts; returns the sanitized config. */
export async function loadPayloadConfig() {
  nextEnv.loadEnvConfig(process.cwd(), true)

  const outfile = path.resolve('node_modules/.cache/payload-config-bundle.mjs')
  await build({
    entryPoints: ['src/payload.config.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external', // node_modules (payload, sharp, …) load normally at runtime
    plugins: [stubNext],
    outfile,
    sourcemap: false,
    logLevel: 'warning',
  })

  const { default: config } = await import(pathToFileURL(outfile).href)
  const sanitized = await config

  // The bundle lives in node_modules/.cache, so the config's
  // import.meta.url-derived paths point there — force the real locations.
  sanitized.typescript.outputFile = path.resolve('src/payload-types.ts')

  return sanitized
}
