import type { Metadata } from 'next'
import { CartProvider } from '@/components/cart/CartContext'
import { NavWrapper } from '@/components/nav/NavWrapper'
import { Footer } from '@/components/nav/Footer'
import { AnnouncementBar } from '@/components/AnnouncementBar'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { getSiteSettings, buildThemeCssVars } from '@/lib/site-settings'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trackid.lb'

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

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root{${cssVars}}` }} />
      </head>
      <body>
        <CartProvider>
          {/* Announcement + nav stick together; nav is in normal flow so the bar is never covered */}
          <div className="sticky top-0 z-50">
            <AnnouncementBar />
            <NavWrapper />
          </div>
          <main>{children}</main>
          <Footer />
          <WhatsAppButton />
        </CartProvider>
      </body>
    </html>
  )
}
