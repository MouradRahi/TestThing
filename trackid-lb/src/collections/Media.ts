import type { CollectionConfig } from 'payload'

// Uploaded images live in Supabase Storage (S3-compatible) via the s3Storage
// plugin in payload.config.ts. Upload here once, then select the image on
// products, artists, and homepage/page sections — no more pasting URLs.
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true, // public — files are served from the public Supabase bucket
  },
  admin: {
    group: 'Site Configuration',
    description:
      'Upload images here, then choose them on products, artists, and page sections. Files are stored in Supabase Storage.',
    useAsTitle: 'alt',
    components: {
      views: {
        list: {
          // Thumbnail gallery instead of the default text table; click a tile to edit
          Component: '/components/admin/MediaGridView#MediaGridView',
        },
      },
    },
  },
  upload: {
    mimeTypes: ['image/*'],
    // sharp generates these on upload; components pick the size they need
    imageSizes: [
      { name: 'thumbnail', width: 400 },
      { name: 'card', width: 768 },
      { name: 'feature', width: 1280 },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      admin: {
        description:
          'Describe the image for accessibility and SEO (e.g. "Hand-painted hoodie, front view").',
      },
    },
  ],
}
