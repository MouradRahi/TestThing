import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

import { Products } from './collections/Products'
import { Artists } from './collections/Artists'
import { Categories } from './collections/Categories'
import { Orders } from './collections/Orders'
import { CustomRequests } from './collections/CustomRequests'
import { Pages } from './collections/Pages'
import { Users } from './collections/Users'
import { SiteSettings } from './globals/SiteSettings'
import { Navigation } from './globals/Navigation'
import { Homepage } from './globals/Homepage'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const payloadSecret = process.env.PAYLOAD_SECRET || ''
if (!payloadSecret && process.env.NODE_ENV === 'production') {
  throw new Error('PAYLOAD_SECRET must be set in production — refusing to start with a known secret.')
}
// Dev-only fallback; production throws above before this is ever used
const secret = payloadSecret || 'dev-only-secret'

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '— trackID.lb Admin',
    },
  },
  collections: [Products, Artists, Categories, Orders, CustomRequests, Pages, Users],
  globals: [SiteSettings, Navigation, Homepage],
  editor: lexicalEditor(),
  secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    // Indexes defined per-collection in the collections files
  }),
  sharp,
})
