import { getTranslations, getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getSiteSettings, getNavigation, resolveCopyright } from '@/lib/site-settings'
import { NewsletterForm } from '@/components/NewsletterForm'

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  youtube: 'YouTube',
}

// Minimal brand glyphs, currentColor so they inherit the link color/hover.
const SOCIAL_ICON_PATHS: Record<string, string> = {
  instagram:
    'M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2Zm0 3.05A6.75 6.75 0 1 0 18.75 12 6.75 6.75 0 0 0 12 5.25Zm0 11.13A4.38 4.38 0 1 1 16.38 12 4.38 4.38 0 0 1 12 16.38Zm6.99-11.4a1.58 1.58 0 1 1-1.58-1.57 1.58 1.58 0 0 1 1.58 1.57Z',
  tiktok:
    'M16.5 3c.3 2.1 1.5 3.6 3.5 3.8v2.4c-1.3.1-2.5-.3-3.5-1v5.6a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.08v2.5a3.4 3.4 0 1 0 2.4 3.3V3h2.6Z',
  twitter:
    'M17.5 3h3l-6.6 7.6L21.7 21h-6l-4.7-6.2L5.6 21H2.5l7-8.1L2.3 3h6.1l4.3 5.7L17.5 3Zm-1.1 16h1.7L7.7 4.7H5.9L16.4 19Z',
  facebook:
    'M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z',
  youtube:
    'M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.77-1.77C19.3 5.1 12 5.1 12 5.1s-7.3 0-8.83.43A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.77 1.77C4.7 18.9 12 18.9 12 18.9s7.3 0 8.83-.43a2.5 2.5 0 0 0 1.77-1.77C23 15.2 23 12 23 12ZM9.75 15.02V8.98L15.5 12l-5.75 3.02Z',
}

export async function Footer() {
  const locale = await getLocale()
  const [settings, nav, t, tNewsletter] = await Promise.all([
    getSiteSettings(locale),
    getNavigation(locale),
    getTranslations('footer'),
    getTranslations('newsletter'),
  ])
  // Env-gated, not a SiteSettings toggle — matches every other optional
  // integration in this codebase (WhatsApp button, S3 storage, analytics).
  const newsletterEnabled = Boolean(process.env.RESEND_AUDIENCE_ID)

  const storeName = (settings.storeName as string) || 'trackID.lb'
  const logoUrl = (settings.logoUrl as string) || ''
  const tagline = (settings.footerTagline as string) || 'Hand-painted clothing for the artists you love. Made in Lebanon.'
  const footerNote = (settings.footerNote as string) || 'Cash on Delivery · Lebanon only'
  const copyright = resolveCopyright((settings.copyrightText as string) || '', storeName)
  const contactEmail =
    typeof settings.contactEmail === 'string' && settings.contactEmail.includes('@')
      ? settings.contactEmail.trim()
      : ''
  const socialLinks = Array.isArray(settings.socialLinks) ? settings.socialLinks : []

  const footerColumns = Array.isArray(nav.footerColumns) ? nav.footerColumns : []

  return (
    <footer className="border-t border-border mt-24 px-6 py-14">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_repeat(var(--footer-cols,2),auto)] gap-12"
        style={{ '--footer-cols': Math.max(footerColumns.length, 1) + (newsletterEnabled ? 1 : 0) } as React.CSSProperties}>

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
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="text-xs text-foreground/70 hover:text-accent transition-colors inline-block mt-3"
            >
              {contactEmail}
            </a>
          )}
          {socialLinks.length > 0 && (
            <div className="flex gap-3 mt-5">
              {socialLinks.map((s: { platform: string; url: string }) => {
                const label = SOCIAL_LABELS[s.platform] ?? s.platform
                const iconPath = SOCIAL_ICON_PATHS[s.platform]
                return (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="text-muted hover:text-accent transition-colors"
                  >
                    {iconPath ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d={iconPath} />
                      </svg>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest">{label}</span>
                    )}
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* Dynamic footer columns from Navigation global */}
        {footerColumns.length > 0
          ? footerColumns.map((col: { columnTitle: string; links: { label: string; href: string; openInNewTab?: boolean }[] }, ci: number) => (
              <div key={col.columnTitle ?? ci}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-4">
                  {col.columnTitle}
                </p>
                <ul className="space-y-3">
                  {(col.links || []).map((link, li: number) => (
                    <li key={link.href ?? li}>
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
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-4">{t('explore')}</p>
              <ul className="space-y-3">
                <li>
                  <Link href="/shop" className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest">
                    {t('shop')}
                  </Link>
                </li>
                <li>
                  <Link href="/bundles" className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest">
                    {t('bundles')}
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest">
                    {t('blog')}
                  </Link>
                </li>
                <li>
                  <Link href="/custom-request" className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest">
                    {t('customRequest')}
                  </Link>
                </li>
                <li>
                  <Link href="/track" className="text-xs text-foreground/70 hover:text-accent transition-colors uppercase tracking-widest">
                    {t('trackOrder')}
                  </Link>
                </li>
              </ul>
            </div>
        }

        {newsletterEnabled && (
          <div className="max-w-[220px]">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-4">{tNewsletter('heading')}</p>
            <p className="text-xs text-muted/80 mb-4">{tNewsletter('subtext')}</p>
            <NewsletterForm />
          </div>
        )}

      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[11px] text-muted/60">{copyright}</p>
        <p className="text-[11px] text-muted/40 uppercase tracking-widest">{footerNote}</p>
      </div>
    </footer>
  )
}
