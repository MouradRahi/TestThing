import { NextResponse } from 'next/server'
import { getCustomer } from '@/lib/auth'

/**
 * Lightweight "am I signed in?" probe for client components living on
 * statically rendered pages.
 *
 * Why this exists (BUGS.md B26): `getCustomer()` reads `headers()`, which is a
 * dynamic API — calling it from a page's server component opts that whole route
 * out of static rendering. The product page did exactly that, purely to decide
 * whether to show the review form, which silently turned the highest-traffic
 * route on the site into per-request SSR and broke the "ISR not SSR for product
 * pages" rule in CLAUDE.md.
 *
 * Client components resolve login state from here instead, mirroring the
 * `fetchState` pattern WishlistButton already uses for the same reason.
 * Route handlers are always dynamic, so reading the cookie here is free of that
 * cost — it just means one small client-side request instead of a static page
 * becoming dynamic.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const customer = await getCustomer()
  return NextResponse.json({ isLoggedIn: !!customer })
}
