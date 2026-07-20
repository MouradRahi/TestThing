import { getPayload } from '@/lib/payload'
import { NextRequest, NextResponse } from 'next/server'
import type { Payload } from 'payload'

/**
 * Demo-data seeder for fresh installs. Run via `npm run seed` (which POSTs here
 * while the dev server is up). Implemented as a route — not a standalone CLI
 * script — because the Payload CLI can't resolve payload.config's extensionless
 * imports under newer Node, whereas the Next runtime resolves them fine.
 *
 * Idempotent: catalog rows are created by slug only when missing, so re-running
 * never duplicates. Homepage/SiteSettings are only touched when unconfigured, so
 * seeding a real store won't clobber the owner's work.
 *
 * Blocked in production unless a matching SEED_SECRET is supplied.
 */

// Dark placeholder that matches the default theme; rendered via next/image
// (placehold.co is allowlisted in next.config for exactly this).
// .png is required — placehold.co defaults to SVG, which next/image blocks
// unless dangerouslyAllowSVG is enabled.
function img(text: string, w = 800, h = 1000): string {
  return `https://placehold.co/${w}x${h}/1a1a1a/e8d5b0.png?text=${encodeURIComponent(text)}`
}

const CATEGORIES = [
  { name: 'Hoodies', slug: 'hoodies' },
  { name: 'Tees', slug: 'tees' },
  { name: 'Accessories', slug: 'accessories' },
]

const ARTISTS = [
  {
    name: 'Fairuz',
    slug: 'fairuz',
    genre: 'Classic Lebanese',
    bio: 'The voice of Lebanon. Timeless songs that soundtrack every Beirut morning.',
    photo: img('Fairuz', 800, 800),
  },
  {
    name: "Mashrou' Leila",
    slug: 'mashrou-leila',
    genre: 'Indie Rock',
    bio: 'Beirut indie icons whose lyrics turned a generation’s questions into anthems.',
    photo: img('Mashrou+Leila', 800, 800),
  },
  {
    name: 'Marcel Khalife',
    slug: 'marcel-khalife',
    genre: 'Oud / Protest',
    bio: 'Oud virtuoso and composer — poetry, resistance, and the sound of the sea.',
    photo: img('Marcel+Khalife', 800, 800),
  },
]

type SeedProduct = {
  title: string
  slug: string
  price: number
  artistSlug?: string
  categorySlug: string
  tags: string[]
  isOneOfAKind?: boolean
  stockQuantity?: number
  sizes?: { label: string; stockQuantity: number }[]
}

const SIZES = [
  { label: 'S', stockQuantity: 4 },
  { label: 'M', stockQuantity: 6 },
  { label: 'L', stockQuantity: 5 },
  { label: 'XL', stockQuantity: 3 },
]

const PRODUCTS: SeedProduct[] = [
  {
    title: 'Fairuz Sunrise Hoodie',
    slug: 'fairuz-sunrise-hoodie',
    price: 65,
    artistSlug: 'fairuz',
    categorySlug: 'hoodies',
    tags: ['hand-painted', 'hoodie'],
    sizes: SIZES,
  },
  {
    title: "Mashrou' Leila Lyric Tee",
    slug: 'mashrou-leila-lyric-tee',
    price: 35,
    artistSlug: 'mashrou-leila',
    categorySlug: 'tees',
    tags: ['hand-painted', 'tee'],
    sizes: SIZES,
  },
  {
    title: 'Marcel Khalife Oud Hoodie',
    slug: 'marcel-khalife-oud-hoodie',
    price: 68,
    artistSlug: 'marcel-khalife',
    categorySlug: 'hoodies',
    tags: ['hand-painted', 'hoodie', 'limited'],
    sizes: SIZES,
  },
  {
    title: 'Beirut Nights Bomber (1 of 1)',
    slug: 'beirut-nights-bomber',
    price: 120,
    artistSlug: 'fairuz',
    categorySlug: 'hoodies',
    tags: ['hand-painted', 'one-of-a-kind'],
    isOneOfAKind: true,
    stockQuantity: 1,
  },
  {
    title: 'Cassette Tote Bag',
    slug: 'cassette-tote-bag',
    price: 20,
    categorySlug: 'accessories',
    tags: ['accessory', 'tote'],
    stockQuantity: 25,
  },
  {
    title: 'Vinyl Enamel Pin',
    slug: 'vinyl-enamel-pin',
    price: 10,
    categorySlug: 'accessories',
    tags: ['accessory', 'pin'],
    stockQuantity: 50,
  },
]

async function ensureBySlug(
  payload: Payload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: any,
  slug: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): Promise<{ id: string | number; created: boolean }> {
  const { docs } = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  if (docs[0]) return { id: docs[0].id, created: false }
  const doc = await payload.create({ collection, data })
  return { id: doc.id, created: true }
}

// Opt-in wipe of the demo-able catalog collections. Used to recover a clean
// slate after a destructive schema change (e.g. enabling localization blanks
// existing localized fields). Only the catalog is cleared — orders, media,
// users, discounts, and globals are left untouched.
async function resetCatalog(payload: Payload) {
  const collections = ['products', 'artists', 'categories', 'pages'] as const
  const deleted: Record<string, number> = {}
  for (const collection of collections) {
    const res = await payload.delete({ collection, where: { id: { exists: true } } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleted[collection] = Array.isArray((res as any)?.docs) ? (res as any).docs.length : 0
  }
  return deleted
}

async function runSeed(payload: Payload, reset = false) {
  const summary = {
    reset: reset ? {} as Record<string, number> : undefined,
    categories: { created: 0, existing: 0 },
    artists: { created: 0, existing: 0 },
    products: { created: 0, existing: 0 },
    homepage: 'skipped' as 'seeded' | 'skipped',
    siteSettings: 'skipped' as 'seeded' | 'skipped',
  }

  if (reset) {
    summary.reset = await resetCatalog(payload)
  }

  // Categories
  const categoryIds: Record<string, string | number> = {}
  for (const cat of CATEGORIES) {
    const { id, created } = await ensureBySlug(payload, 'categories', cat.slug, cat)
    categoryIds[cat.slug] = id
    summary.categories[created ? 'created' : 'existing']++
  }

  // Artists
  const artistIds: Record<string, string | number> = {}
  for (const artist of ARTISTS) {
    const { id, created } = await ensureBySlug(payload, 'artists', artist.slug, artist)
    artistIds[artist.slug] = id
    summary.artists[created ? 'created' : 'existing']++
  }

  // Products
  for (const p of PRODUCTS) {
    const { created } = await ensureBySlug(payload, 'products', p.slug, {
      title: p.title,
      slug: p.slug,
      price: p.price,
      status: 'published',
      isOneOfAKind: Boolean(p.isOneOfAKind),
      stockQuantity: p.stockQuantity ?? 1,
      sizes: p.sizes ?? [],
      tags: p.tags.map((tag) => ({ tag })),
      images: [{ url: img(p.title.replace(/\s+/g, '+')), alt: p.title }],
      ...(p.artistSlug ? { artist: artistIds[p.artistSlug] } : {}),
      category: categoryIds[p.categorySlug],
    })
    summary.products[created ? 'created' : 'existing']++
  }

  // Homepage — only when it has no sections yet, so we never overwrite a built page
  const homepage = await payload.findGlobal({ slug: 'homepage', depth: 0 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingSections = (homepage as any)?.sections
  if (!Array.isArray(existingSections) || existingSections.length === 0) {
    await payload.updateGlobal({
      slug: 'homepage',
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sections: [
          {
            blockType: 'hero',
            eyebrow: 'Hand-painted · Made in Lebanon',
            headline: 'Wear the music you love.',
            subline: 'One-of-a-kind pieces painted by hand, themed around the artists that move you.',
            ctaLabel: 'Shop the drop',
            ctaHref: '/shop',
            bgColor: '#0a0a0a',
            overlayOpacity: 0,
            textAlign: 'center',
            minHeight: '80vh',
            hidden: false,
          },
          {
            blockType: 'featured-products',
            sectionTitle: 'Latest Drops',
            viewAllLabel: 'View all →',
            viewAllHref: '/shop',
            source: 'latest',
            limit: 6,
            hidden: false,
          },
          {
            blockType: 'statement',
            text: 'Every piece is unique. Once it’s gone, it’s gone.',
            hidden: false,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
      },
    })
    summary.homepage = 'seeded'
  }

  // SiteSettings commerce/announcement — only when commerce is unconfigured, so a
  // real store's delivery zones and bank details are never touched
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as any
  const commerceUnset =
    (!Array.isArray(s?.deliveryZones) || s.deliveryZones.length === 0) &&
    !s?.bankTransferInstructions
  if (commerceUnset) {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        deliveryZones: [
          { label: 'Beirut', fee: 2 },
          { label: 'Mount Lebanon', fee: 3 },
          { label: 'Other Areas', fee: 5 },
        ],
        freeDeliveryThreshold: 75,
        bankTransferInstructions:
          'Bank: Demo Bank\nAccount / IBAN: LB00 0000 0000 0000 0000 0000\nReference: your order number (e.g. TRK-123456-AB12)',
        announcementEnabled: true,
        announcementText: 'Demo store — free delivery on orders over $75',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })
    summary.siteSettings = 'seeded'
  }

  return summary
}

function authorized(req: NextRequest): boolean {
  // Freely allowed in dev; in production require a matching SEED_SECRET
  if (process.env.NODE_ENV !== 'production') return true
  const secret = process.env.SEED_SECRET
  if (!secret) return false
  const provided =
    req.headers.get('x-seed-secret') || new URL(req.url).searchParams.get('secret')
  return provided === secret
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: 'Seeding is disabled in production unless a valid SEED_SECRET is provided.' },
      { status: 403 },
    )
  }
  try {
    const url = new URL(req.url)
    const body = await req.json().catch(() => ({}))
    const reset =
      body?.reset === true || url.searchParams.get('reset') === '1' || url.searchParams.get('reset') === 'true'
    const payload = await getPayload()
    const summary = await runSeed(payload, reset)
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('[seed] failed:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 },
    )
  }
}

export function GET() {
  return NextResponse.json({
    message:
      'POST to this endpoint to seed demo data (categories, artists, products, homepage, delivery settings). Run `npm run seed` with the dev server running. Idempotent — safe to re-run.',
  })
}
