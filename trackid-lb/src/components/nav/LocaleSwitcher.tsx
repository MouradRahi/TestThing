'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

// Switches locale while keeping the current path (next-intl rewrites the prefix).
// usePathname() returns the path with dynamic segments already resolved, so a
// plain string replace preserves the current page.
export function LocaleSwitcher() {
  const active = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const switchTo = (locale: string) => {
    if (locale === active) return
    router.replace(pathname, { locale })
  }

  return (
    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest">
      {routing.locales.map((locale, i) => (
        <span key={locale} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-border" aria-hidden="true">/</span>}
          <button
            type="button"
            onClick={() => switchTo(locale)}
            aria-current={locale === active ? 'true' : undefined}
            className={locale === active ? 'text-foreground' : 'text-muted hover:text-foreground transition-colors'}
          >
            {locale}
          </button>
        </span>
      ))}
    </div>
  )
}
