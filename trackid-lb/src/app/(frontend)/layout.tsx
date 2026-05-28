import type { Metadata } from 'next'
import { CartProvider } from '@/components/cart/CartContext'
import { Nav } from '@/components/nav/Nav'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'trackID.lb', template: '%s | trackID.lb' },
  description: 'Hand-painted clothing for music lovers. Lebanon.',
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
