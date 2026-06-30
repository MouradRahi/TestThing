import Link from 'next/link'
import { getSiteSettings, getNavigation, resolveCopyright } from '@/lib/site-settings'

const SOCIAL_ICONS: Record<string, string> = {
  instagram: 'IG',
  tiktok: 'TK',
  twitter: 'TW',
  facebook: 'FB',
  youtube: 'YT',
}

export async function Footer() {
  const [settings, nav] = await Promise.all([getSiteSettings(), getNavigation()])

  const storeName = (settings.storeName as string) || 'trackID.lb'
  const logoUrl = (settings.logoUrl as string) || ''
  const tagline = (settings.footerTagline as string) || 'Hand-painted clothing for the artists you love. Made in Lebanon.'
  const footerNote = (settings.footerNote as string) || 'Cash on Delivery · Lebanon only'
  const copyright = resolveCopyright((settings.copyrightText as string) || '', storeName)
  const socialLinks = Array.isArray(settings.socialLinks) ? settings.socialLinks : []

  const footerColumns = Array.isArray(nav.footerColumns) ? nav.footerColumns : []

  return (
    <footer className="border-t border-border mt-24 px-6 py-14">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_repeat(var(--footer-cols,2),auto)] gap-12"
        style={{ '--footer-cols': Math.max(footerColumns.length, 1) } as React.CSSProperties}>

        {/* Brand */}
        <div>
          <Link href="/" className="text-accent font-bold tracking-[0.2em] text-sm uppercase inline-block">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin logo of unknown dimensions; fixed height + auto width keeps the true aspect ratio
              <img src={logoUrl} alt={storeName} className="h-7 w-auto object-contain" />
            ) : (
              storeName
            )}
          </Link>
          <p className="text-muted text-xs leading-relaxed mt-3 max-w-[200px]">
            {tagline}
          </p>
          {socialLinks.length > 0 && (
            <div className="flex gap-3 mt-5">
              {socialLinks.map((s: { platform: string; url: string }) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted hover:text-accent transition-colors uppercase tracking-widest"
                >
                  {SOCIAL_ICONS[s.platform] ?? s.platform}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic footer columns from Navigation global */}
        {footerColumns.length > 0
          ? footerColumns.map((col: { columnTitle: string; links: { label: string; href: string; openInNewTab?: boolean }[] }) => (
              <div key={col.columnTitle}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-4">
                  {col.columnTitle}
                </p>
                <ul className="space-y-3">
                  {(col.links || []).map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        target={link.openInNewTab ? '_blank' : undefined}
                        rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                        className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          : /* Fallback if no footer columns configured */
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
                <li>
                  <Link href="/track" className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest">
                    Track Order
                  </Link>
                </li>
              </ul>
            </div>
        }

      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[11px] text-muted/60">{copyright}</p>
        <p className="text-[11px] text-muted/40 uppercase tracking-widest">{footerNote}</p>
      </div>
    </footer>
  )
}
