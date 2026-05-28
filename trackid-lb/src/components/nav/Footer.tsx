import Link from 'next/link'
import { getPayload } from '@/lib/payload'

async function getFooterPages() {
  try {
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'pages',
      limit: 20,
      sort: 'title',
      select: { title: true, slug: true },
    })
    return result.docs
  } catch {
    return []
  }
}

export async function Footer() {
  const pages = await getFooterPages()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border mt-24 px-6 py-14">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">

        {/* Brand */}
        <div>
          <Link href="/" className="text-accent font-bold tracking-[0.2em] text-sm uppercase">
            trackID.lb
          </Link>
          <p className="text-muted text-xs leading-relaxed mt-3 max-w-[200px]">
            Hand-painted clothing for the artists you love. Made in Lebanon.
          </p>
        </div>

        {/* Static nav links */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-4">Explore</p>
          <ul className="space-y-3">
            <li>
              <Link href="/shop" className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest">
                Shop
              </Link>
            </li>
            <li>
              <Link href="/custom-request" className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest">
                Custom Request
              </Link>
            </li>
          </ul>
        </div>

        {/* Dynamic CMS pages */}
        {pages.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-4">Info</p>
            <ul className="space-y-3">
              {pages.map((page) => (
                <li key={page.id}>
                  <Link
                    href={`/p/${page.slug}`}
                    className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[11px] text-muted/60">© {year} trackID.lb — Lebanon</p>
        <p className="text-[11px] text-muted/40 uppercase tracking-widest">Cash on Delivery · Lebanon only</p>
      </div>
    </footer>
  )
}
