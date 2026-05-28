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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '— trackID.lb Admin',
    },
  },
  collections: [Products, Artists, Categories, Orders, CustomRequests, Pages, Users],
  editor: lexicalEditor(),
  secret: 'trackid-lb-dev-secret-2026',
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
