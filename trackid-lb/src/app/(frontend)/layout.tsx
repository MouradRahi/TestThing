import type { Metadata } from 'next'
import { CartProvider } from '@/components/cart/CartContext'
import { Nav } from '@/components/nav/Nav'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trackid.lb'

export const metadata: Metadata = {
  title: { default: 'trackID.lb', template: '%s | trackID.lb' },
  description: 'Hand-painted clothing for the artists you love. Made in Lebanon, one piece at a time.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    siteName: 'trackID.lb',
    type: 'website',
    locale: 'en_US',
    title: 'trackID.lb',
    description: 'Hand-painted clothing for the artists you love. Made in Lebanon, one piece at a time.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'trackID.lb',
    description: 'Hand-painted clothing for the artists you love. Made in Lebanon, one piece at a time.',
  },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Nav />
          <main className="pt-14">{children}</main>
        </CartProvider>
      </body>
    </html>
  )
}
