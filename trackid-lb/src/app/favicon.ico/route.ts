import { NextResponse } from 'next/server'
import { getSiteSettings } from '@/lib/site-settings'

// Some browsers/crawlers/bookmark managers probe /favicon.ico directly at the
// site root regardless of the <link rel="icon"> tags in the HTML (which
// already cover every modern browser via the layout's theme-adaptive
// metadata). This route exists only for that legacy fallback — it redirects
// to whichever favicon is currently set in SiteSettings admin rather than
// serving a hardcoded file, so it stays correct for any brand's icon.
export async function GET() {
  const settings = await getSiteSettings('en')
  const faviconUrl = settings.faviconUrl as string | undefined
  if (!faviconUrl) return new NextResponse(null, { status: 404 })
  return NextResponse.redirect(faviconUrl, { status: 302 })
}
