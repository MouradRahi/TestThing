import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getSiteSettings } from '@/lib/site-settings'
import { ensureReadableTextColor } from '@/lib/contrast'

export async function AnnouncementBar() {
  const settings = await getSiteSettings(await getLocale())

  if (!settings.announcementEnabled || !settings.announcementText) return null

  const bg = (settings.announcementBgColor as string) || '#e8d5b0'
  // Auto-flips to black/white when the admin's own bg/text pick falls below
  // WCAG AA contrast (ENHANCEMENTS E14) — never lets a bad color choice ship
  // an unreadable bar, without needing the admin to check contrast by hand.
  const color = ensureReadableTextColor(bg, (settings.announcementTextColor as string) || '#0a0a0a')
  const text = settings.announcementText as string
  const href = settings.announcementHref as string | undefined

  const inner = (
    <p className="text-center text-[11px] uppercase tracking-[0.2em] py-2.5 px-4">
      {text}
    </p>
  )

  return (
    <div style={{ backgroundColor: bg, color }}>
      {href ? (
        <Link href={href} className="block hover:opacity-80 transition-opacity">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  )
}
