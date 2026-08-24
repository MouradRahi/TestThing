import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getSiteSettings, resolveCurrencyDisplay } from '@/lib/site-settings'
import { totalStock } from '@/lib/stock'
import { resolveAlt } from '@/lib/image'

// E9 (ENHANCEMENTS.md) — cookie-based, honors the project's "no localStorage,
// ever" rule ([[no-localstorage-use-accounts]]) without needing a DB table.
// Last 8 viewed product ids, most-recent-first, deduped.
//
// GET is fetched client-side (RecentlyViewedStrip), not read via a Server
// Component's cookies() call — reading cookies() directly in an RSC would
// force that page dynamic, breaking this app's ISR product pages (this
// project's "Non-Negotiable" performance rule). A route handler is always
// per-request regardless, so it's the correct place for this.
const COOKIE = 'recently_viewed'
const MAX_ITEMS = 8
const MAX_AGE = 60 * 60 * 24 * 90 // 90 days

function readIds(req: NextRequest): string[] {
  try {
    const raw = req.cookies.get(COOKIE)?.value
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const localeParam = req.nextUrl.searchParams.get('locale')
  const locale: 'en' | 'ar' = localeParam === 'ar' ? 'ar' : 'en'
  const exclude = req.nextUrl.searchParams.get('exclude')
  let ids = readIds(req)
  if (exclude) ids = ids.filter((id) => id !== exclude)
  if (ids.length === 0) return NextResponse.json({ products: [] })

  const payload = await getPayload()
  const [settings, { docs: products }] = await Promise.all([
    getSiteSettings(locale),
    payload.find({
      collection: 'products',
      where: { id: { in: ids }, status: { equals: 'published' } },
      limit: ids.length,
      depth: 1,
      locale,
    }),
  ])

  // payload.find({ id: { in } }) doesn't preserve the cookie's most-recent-
  // first order — recover it.
  const byId = new Map(products.map((p) => [String(p.id), p]))
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is (typeof products)[number] => Boolean(p))
  const currency = resolveCurrencyDisplay(settings)

  return NextResponse.json({
    currency,
    products: ordered.slice(0, 4).map((p) => {
      const images = Array.isArray(p.images) ? p.images : []
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        price: p.price,
        imageUrl: images[0]?.url ?? null,
        imageAlt: resolveAlt(images[0]) || null,
        soldOut: totalStock(p) === 0,
      }
    }),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const productId =
    typeof body?.productId === 'string' || typeof body?.productId === 'number' ? String(body.productId) : null
  if (!productId) return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })

  const ids = [productId, ...readIds(req).filter((id) => id !== productId)].slice(0, MAX_ITEMS)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, JSON.stringify(ids), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
  return res
}
