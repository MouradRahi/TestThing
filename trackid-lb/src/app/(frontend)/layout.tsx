import type { Metadata } from 'next'
import { Inter, Space_Grotesk, Playfair_Display, DM_Sans, Manrope } from 'next/font/google'
import { CartProvider } from '@/components/cart/CartContext'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { NavWrapper } from '@/components/nav/NavWrapper'
import { Footer } from '@/components/nav/Footer'
import { AnnouncementBar } from '@/components/AnnouncementBar'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import {
  getSiteSettings,
  buildThemeCssVars,
  resolveFontStack,
  DEFAULT_EMPTY_CART_MESSAGE,
} from '@/lib/site-settings'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Curated font set, self-hosted by next/font. All variables are attached to the
// body; only the fonts referenced by the chosen stacks are actually downloaded.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-space-grotesk' })
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', variable: '--font-playfair' })
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' })
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope' })

const fontVariables = [inter, spaceGrotesk, playfair, dmSans, manrope].map((f) => f.variable).join(' ')

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const storeName = (settings.storeName as string) || 'trackID.lb'
  const description =
    (settings.metaDescription as string) ||
    'Hand-painted clothing for the artists you love. Made in Lebanon, one piece at a time.'
  const ogImage = (settings.ogImage as string) || ''
  const faviconUrl = (settings.faviconUrl as string) || ''

  return {
    title: { default: storeName, template: `%s | ${storeName}` },
    description,
    metadataBase: new URL(siteUrl),
    ...(faviconUrl ? { icons: { icon: faviconUrl } } : {}),
    openGraph: {
      siteName: storeName,
      type: 'website',
      locale: 'en_US',
      title: storeName,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: storeName,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()
  const cssVars = buildThemeCssVars(settings)
  const fontVars = {
    '--font-heading': resolveFontStack(settings.headingFont),
    '--font-body': resolveFontStack(settings.bodyFont),
  } as React.CSSProperties

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root{${cssVars}}` }} />
      </head>
      <body className={fontVariables} style={fontVars}>
        <CartProvider
          emptyCartMessage={(settings.emptyCartMessage as string) || DEFAULT_EMPTY_CART_MESSAGE}
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:bg-accent focus:text-on-accent focus:px-4 focus:py-2 focus:text-xs focus:uppercase focus:tracking-widest"
          >
            Skip to content
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
      </body>
    </html>
  )
}
