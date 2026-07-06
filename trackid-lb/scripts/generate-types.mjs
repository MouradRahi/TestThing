/**
 * Generates payload-types.ts without the `payload` CLI (whose tsx loader
 * chain fails on this machine's Node — see bundle-config.mjs).
 *
 * Run: npm run generate:types
 */
import { generateTypes } from 'payload/node'
import { loadPayloadConfig } from './bundle-config.mjs'

const config = await loadPayloadConfig()
await generateTypes(config, { log: true })
