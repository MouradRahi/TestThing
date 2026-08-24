'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { routing } from '@/i18n/routing'

// E7 (ENHANCEMENTS.md) — search previously only existed buried on /shop.
// A search icon in the nav opens a minimal panel with one input that submits
// straight to /shop?q= — zero new backend, reuses the exact search /shop
// already handles. Locale-aware action mirrors shop/page.tsx's own pattern
// (BUGS.md B8) so Arabic visitors don't get bounced to the English site.
export function SearchOverlay() {
  const t = useTranslations('shop')
  const tn = useTranslations('nav')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const searchAction = locale === routing.defaultLocale ? '/shop' : `/${locale}/shop`

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && e.target !== triggerRef.current) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? tn('closeSearch') : tn('openSearch')}
        aria-expanded={open}
        className="text-muted hover:text-foreground transition-colors p-1"
      >
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M16 16l-3.5-3.5" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          className="absolute top-full mt-2 end-0 z-50 bg-bg border border-border p-3 w-64"
        >
          <form action={searchAction} className="flex gap-2">
            <input
              ref={inputRef}
              type="search"
              name="q"
              placeholder={t('searchPlaceholder')}
              className="flex-1 bg-transparent border border-border px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-hover transition-colors shrink-0"
            >
              {t('search')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// Mobile menu variant — the hamburger panel is already a full-width overlay,
// so a toggle-within-a-toggle would be redundant; this is just a plain,
// always-visible field at the top of that panel instead.
export function MobileSearchField() {
  const t = useTranslations('shop')
  const locale = useLocale()
  const searchAction = locale === routing.defaultLocale ? '/shop' : `/${locale}/shop`

  return (
    <form action={searchAction} className="flex gap-2 pb-1 border-b border-border">
      <input
        type="search"
        name="q"
        placeholder={t('searchPlaceholder')}
        className="flex-1 bg-transparent border border-border px-3 py-2 text-xs normal-case tracking-normal text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
      />
      <button
        type="submit"
        className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-hover transition-colors shrink-0"
      >
        {t('search')}
      </button>
    </form>
  )
}
