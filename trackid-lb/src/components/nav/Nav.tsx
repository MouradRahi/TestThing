'use client'

import Link from 'next/link'
import { useCart } from '@/components/cart/CartContext'

export type NavLink = {
  label: string
  href: string
  openInNewTab?: boolean
}

type Props = {
  storeName: string
  links: NavLink[]
}

export function Nav({ storeName, links }: Props) {
  const { itemCount } = useCart()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 border-b border-border bg-bg/90 backdrop-blur-sm">
      <Link href="/" className="text-accent font-bold tracking-[0.2em] text-sm uppercase">
        {storeName}
      </Link>
      <nav className="flex items-center gap-8 text-xs uppercase tracking-widest text-muted">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            target={link.openInNewTab ? '_blank' : undefined}
            rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
            className="hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <Link href="/cart" className="hover:text-foreground transition-colors relative">
          Cart
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-4 bg-accent text-on-accent text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none tabular-nums">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </Link>
      </nav>
    </header>
  )
}
