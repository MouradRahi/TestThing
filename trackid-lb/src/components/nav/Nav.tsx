'use client'

import { useState } from 'react'
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
  logoUrl?: string
}

export function Nav({ storeName, links, logoUrl }: Props) {
  const { itemCount, openCart } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)

  const cartLink = (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false)
        openCart()
      }}
      aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
      className="hover:text-foreground transition-colors relative uppercase tracking-widest"
    >
      Cart
      {itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-2 -right-4 bg-accent text-on-accent text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none tabular-nums"
        >
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {itemCount} {itemCount === 1 ? 'item' : 'items'} in cart
      </span>
    </button>
  )

  return (
    <header className="relative h-14 flex items-center justify-between px-6 border-b border-border bg-bg/90 backdrop-blur-sm">
      <Link
        href="/"
        onClick={() => setMenuOpen(false)}
        className="text-accent font-bold tracking-[0.2em] text-sm uppercase"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin logo of unknown dimensions; fixed height + auto width keeps the true aspect ratio
          <img src={logoUrl} alt={storeName} className="h-7 w-auto object-contain" />
        ) : (
          storeName
        )}
      </Link>

      {/* Desktop */}
      <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-widest text-muted">
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
        {cartLink}
      </nav>

      {/* Mobile: cart stays visible, links collapse behind the hamburger */}
      <div className="flex md:hidden items-center gap-7 text-xs uppercase tracking-widest text-muted">
        {cartLink}
        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="text-foreground p-1 -mr-1"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            {menuOpen ? (
              <path d="M3 3l12 12M15 3L3 15" />
            ) : (
              <>
                <path d="M2 5h14" />
                <path d="M2 9h14" />
                <path d="M2 13h14" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <nav className="absolute top-full left-0 right-0 md:hidden bg-bg border-b border-border flex flex-col px-6 py-5 gap-5 text-xs uppercase tracking-widest text-muted">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.openInNewTab ? '_blank' : undefined}
              rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
              onClick={() => setMenuOpen(false)}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
