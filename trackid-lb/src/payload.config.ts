import { buildConfig, type RequiredDataFromCollectionSlug } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

import { Products } from './collections/Products'
import { Artists } from './collections/Artists'
import { Categories } from './collections/Categories'
import { Orders } from './collections/Orders'
import { CustomRequests } from './collections/CustomRequests'
import { Pages } from './collections/Pages'
import { Media } from './collections/Media'
import { GarmentTypes } from './collections/GarmentTypes'
import { Discounts } from './collections/Discounts'
import { Customers } from './collections/Customers'
import { Carts } from './collections/Carts'
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
      // Config loads before the DB, so the admin title can't read storeName from
      // SiteSettings — set NEXT_PUBLIC_STORE_NAME to rebrand the admin tab title.
      titleSuffix: `— ${process.env.NEXT_PUBLIC_STORE_NAME || 'trackID.lb'} Admin`,
    },
    // Local admin component paths (e.g. '/components/...') resolve relative to src/
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      // Sales analytics above the default admin dashboard
      beforeDashboard: ['/components/admin/SalesDashboard#SalesDashboard'],
    },
  },
  collections: [Products, Artists, Categories, Orders, CustomRequests, Pages, Media, GarmentTypes, Discounts, Customers, Carts, Users],
  // Content localization — mirrors the storefront locales (src/i18n/routing.ts).
  // Fields marked `localized: true` store a value per locale; everything else is
  // shared. Add a locale here + in routing.ts + a messages/<locale>.json to grow.
  localization: {
    locales: [
      { label: 'English', code: 'en' },
      { label: 'العربية', code: 'ar' },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  globals: [SiteSettings, Navigation, Homepage],
  // Seed the default garment types once, so the custom-request form works out of
  // the box. The brand can rename/add/remove them in admin afterwards.
  onInit: async (payload) => {
    try {
      const { totalDocs } = await payload.count({ collection: 'garment-types' })
      if (totalDocs === 0) {
        const defaults = ['Hoodie', 'T-Shirt', 'Jacket', 'Other']
        for (const name of defaults) {
          // slug is filled by the collection's beforeValidate hook
          await payload.create({
            collection: 'garment-types',
            data: { name } as RequiredDataFromCollectionSlug<'garment-types'>,
          })
        }
      }
    } catch {
      // Table may not exist yet (schema not pushed); seeding will run on a later boot.
    }
  },
  editor: lexicalEditor(),
  secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    // Committed migrations live here (src/migrations). See MIGRATIONS.md.
    migrationDir: path.resolve(dirname, 'migrations'),
    // Schema management policy:
    //   • Production NEVER auto-pushes — it only runs committed migrations, so a
    //     schema change can't silently drop/blank prod data.
    //   • Dev push is OPT-IN (PAYLOAD_PUSH=true): the local dev DB is currently the
    //     SAME database production runs on, so a casual `npm run dev` with schema
    //     changes must never silently rewrite the live schema (drizzle push applies
    //     destructive diffs with no data-preservation step — see MIGRATIONS.md).
    //     Only set PAYLOAD_PUSH=true when you've reviewed the pending schema diff
    //     (or once dev points at a disposable database).
    push:
      process.env.PAYLOAD_PUSH === 'true' &&
      process.env.NODE_ENV !== 'production' &&
      process.env.PAYLOAD_MIGRATE !== 'true',
    // Indexes defined per-collection in the collections files
  }),
  plugins: [
    s3Storage({
      // Disable cleanly (falls back to local disk) until S3 credentials are set,
      // so the app still boots and uploads work in local dev without keys.
      enabled: Boolean(
        process.env.ACCESS_KEY_ID_SUPABASE && process.env.SECRET_ACCESS_KEY_SUPABASE,
      ),
      bucket: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'products',
      // Upload straight from the browser to Supabase via a presigned URL, so large
      // images don't hit Vercel's ~4.5MB serverless request-body limit. Requires a
      // CORS rule on the bucket allowing PUT from the site origin (see DEPLOY.md).
      clientUploads: true,
      collections: {
        media: {
          prefix: 'media',
          // Serve files straight from Supabase's public CDN, not proxied through Payload
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) => {
            const base = process.env.NEXT_PUBLIC_SUPABASE_URL
            const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'products'
            const key = [prefix, filename].filter(Boolean).join('/')
            return `${base}/storage/v1/object/public/${bucket}/${key}`
          },
        },
      },
      config: {
        endpoint: process.env.SUPABASE_S3_ENDPOINT,
        region: process.env.SUPABASE_S3_REGION,
        forcePathStyle: true, // required for Supabase's S3-compatible endpoint
        credentials: {
          accessKeyId: process.env.ACCESS_KEY_ID_SUPABASE || '',
          secretAccessKey: process.env.SECRET_ACCESS_KEY_SUPABASE || '',
        },
      },
    }),
  ],
  sharp,
})
