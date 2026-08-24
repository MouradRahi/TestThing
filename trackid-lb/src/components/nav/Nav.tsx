'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useCart } from '@/components/cart/CartContext'
import { LocaleSwitcher } from '@/components/nav/LocaleSwitcher'
import { SearchOverlay, MobileSearchField } from '@/components/nav/SearchOverlay'
import { safeHref } from '@/lib/sanitize'

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
  const t = useTranslations('nav')
  const ta = useTranslations('account')
  const menuToggleRef = useRef<HTMLButtonElement>(null)

  // Esc closes the mobile menu and returns focus to the hamburger button —
  // it had neither before (BUGS.md B17). Not a full Tab-trap: this is a
  // disclosure dropdown, not a modal overlay, so trapping Tab inside it
  // would be the wrong pattern (contrast CartDrawer, a true modal).
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuToggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const accountLink = (
    <Link
      href="/account"
      onClick={() => setMenuOpen(false)}
      className="hover:text-foreground transition-colors uppercase tracking-widest"
    >
      {ta('account')}
    </Link>
  )

  const cartLink = (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false)
        openCart()
      }}
      aria-label={t('openCart', { count: itemCount })}
      className="hover:text-foreground transition-colors relative uppercase tracking-widest"
    >
      {t('cart')}
      {itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-2 -end-4 bg-accent text-on-accent text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none tabular-nums"
        >
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {t('itemsInCart', { count: itemCount })}
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
            href={safeHref(link.href)}
            target={link.openInNewTab ? '_blank' : undefined}
            rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
            className="hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <SearchOverlay />
        {accountLink}
        {cartLink}
        <LocaleSwitcher />
      </nav>

      {/* Mobile: cart stays visible, links collapse behind the hamburger */}
      <div className="flex md:hidden items-center gap-7 text-xs uppercase tracking-widest text-muted">
        {cartLink}
        <button
          ref={menuToggleRef}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
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
          <MobileSearchField />
          {links.map((link) => (
            <Link
              key={link.href}
              href={safeHref(link.href)}
              target={link.openInNewTab ? '_blank' : undefined}
              rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
              onClick={() => setMenuOpen(false)}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {accountLink}
          <div className="pt-2 border-t border-border">
            <LocaleSwitcher />
          </div>
        </nav>
      )}
    </header>
  )
}
