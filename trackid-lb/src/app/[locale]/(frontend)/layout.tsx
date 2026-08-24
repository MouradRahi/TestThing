import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Inter, Space_Grotesk, Playfair_Display, DM_Sans, Manrope, IBM_Plex_Sans_Arabic } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { routing, isRtl } from '@/i18n/routing'
import { CartProvider } from '@/components/cart/CartContext'
import { ToastProvider } from '@/components/ui/Toast'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { NavWrapper } from '@/components/nav/NavWrapper'
import { Footer } from '@/components/nav/Footer'
import { AnnouncementBar } from '@/components/AnnouncementBar'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { Analytics } from '@/components/Analytics'
import { Analytics as VercelAnalytics } from '@vercel/analytics/next'
import {
  getSiteSettings,
  buildThemeCssVars,
  resolveFontStack,
  resolveCurrencyDisplay,
  resolveFreeDeliveryThreshold,
  getDeliveryZones,
  DEFAULT_EMPTY_CART_MESSAGE,
} from '@/lib/site-settings'
import { localizedAlternates } from '@/lib/seo'
import { buildSiteJsonLd } from '@/lib/structured-data'
import { jsonLdScript } from '@/lib/sanitize'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Curated font set, self-hosted by next/font. All variables are attached to
// the body; the CSS var each stack actually references is the only one the
// browser fetches. `preload: false` on all six — the admin default is
// 'system' (no custom font at all), so none of these deserves an unconditional
// eager preload; next/font can't pick a font conditionally at the module
// level (BUGS.md B20), so this is the accepted middle ground.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter', preload: false })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-space-grotesk', preload: false })
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', variable: '--font-playfair', preload: false })
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans', preload: false })
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope', preload: false })
// None of the above has Arabic glyphs — automatically substituted on /ar
// instead of a separate admin choice (see resolveFontStack in site-settings.ts).
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-arabic',
  preload: false,
})

const fontVariables = [inter, spaceGrotesk, playfair, dmSans, manrope, ibmPlexArabic]
  .map((f) => f.variable)
  .join(' ')

const OG_LOCALE: Record<string, string> = { en: 'en_US', ar: 'ar_LB' }

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const settings = await getSiteSettings(locale)
  const storeName = (settings.storeName as string) || 'trackID.lb'
  const tagline = (settings.tagline as string) || ''
  // The tagline rides along on the default (homepage) title; inner pages use the template
  const defaultTitle = tagline ? `${storeName} — ${tagline}` : storeName
  // Fallback is translated (not a single hardcoded English string) so an /ar
  // install with metaDescription unset doesn't get English meta copy (BUGS.md B16).
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const description = (settings.metaDescription as string) || tCommon('defaultSiteDescription')
  const ogImage = (settings.ogImage as string) || ''
  const faviconUrl = (settings.faviconUrl as string) || ''
  const faviconUrlDark = (settings.faviconUrlDark as string) || ''
  const appleTouchIconUrl = (settings.appleTouchIconUrl as string) || ''

  // Theme-adaptive favicon: when a dark-mode variant is set, emit both as
  // separate <link rel="icon" media="..."> tags — the browser picks whichever
  // matches the visitor's own OS/browser color scheme (Next's Icon type
  // supports `media` directly). No dark variant = single icon everywhere,
  // unchanged from before. Every value here is admin-uploaded via
  // SiteSettings (never a hardcoded file) so a different brand's icons swap
  // in with zero code changes.
  const iconList = faviconUrl
    ? faviconUrlDark
      ? [
          { url: faviconUrl, media: '(prefers-color-scheme: light)' },
          { url: faviconUrlDark, media: '(prefers-color-scheme: dark)' },
        ]
      : [{ url: faviconUrl }]
    : []

  const googleSiteVerification = (settings.googleSiteVerification as string) || ''

  return {
    title: { default: defaultTitle, template: `%s | ${storeName}` },
    description,
    metadataBase: new URL(siteUrl),
    // Layout-level default — only the homepage has no page-level override for
    // this; every other route sets its own (more specific) alternates, which
    // wins per Next.js's metadata merge rules.
    alternates: localizedAlternates('/', locale),
    ...(iconList.length || appleTouchIconUrl
      ? {
          icons: {
            ...(iconList.length ? { icon: iconList } : {}),
            ...(appleTouchIconUrl ? { apple: appleTouchIconUrl } : {}),
          },
        }
      : {}),
    ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
    openGraph: {
      siteName: storeName,
      type: 'website',
      locale: OG_LOCALE[locale] ?? 'en_US',
      title: defaultTitle,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

export default async function FrontendLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  // Enable static rendering for this locale
  setRequestLocale(locale)

  const [settings, tCommon] = await Promise.all([getSiteSettings(locale), getTranslations('common')])
  // Both the theme colors and the font stack are CSS custom properties, so
  // they can share one `style` prop on <html> — a real HTML attribute (not
  // an injected <style> element), which is what lets us skip
  // dangerouslySetInnerHTML for this entirely (see buildThemeCssVars' own
  // comment for why that matters for CSP + injection risk).
  const rootStyle = {
    ...buildThemeCssVars(settings),
    '--font-heading': resolveFontStack(settings.headingFont, locale),
    '--font-body': resolveFontStack(settings.bodyFont, locale),
  } as React.CSSProperties

  const siteJsonLd = buildSiteJsonLd(settings, locale, routing.defaultLocale)

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} style={rootStyle}>
      <head>
        {/* Site-wide Organization + WebSite/SearchAction graph (ROADMAP Part 7) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd) }} />
      </head>
      <body className={fontVariables}>
        <NextIntlClientProvider>
          <ToastProvider>
          <CartProvider
            emptyCartMessage={(settings.emptyCartMessage as string) || DEFAULT_EMPTY_CART_MESSAGE}
            currency={resolveCurrencyDisplay(settings)}
            // Only meaningful when delivery zones are configured — in free-text
            // area mode the fee is confirmed by phone, so a "free delivery"
            // promise here wouldn't hold.
            freeDeliveryThreshold={getDeliveryZones(settings).length > 0 ? resolveFreeDeliveryThreshold(settings) : null}
          >
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:z-[70] focus:bg-accent focus:text-on-accent focus:px-4 focus:py-2 focus:text-xs focus:uppercase focus:tracking-widest ltr:focus:left-3 rtl:focus:right-3"
            >
              {tCommon('skipToContent')}
            </a>
            {/* Announcement + nav stick together; nav is in normal flow so the bar is never covered */}
            <div className="sticky top-0 z-50">
              <AnnouncementBar />
              <NavWrapper />
            </div>
            <main id="main-content" tabIndex={-1}>{children}</main>
            <Footer />
            <WhatsAppButton />
            <CartDrawer />
          </CartProvider>
          </ToastProvider>
        </NextIntlClientProvider>
        <Analytics
          gaId={settings.gaMeasurementId as string | undefined}
          pixelId={settings.metaPixelId as string | undefined}
        />
        <VercelAnalytics />
      </body>
    </html>
  )
}
