'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

// E5 (ENHANCEMENTS.md) — the audience lives on WhatsApp, so a wa.me share
// link needs no SDK. Copy-link uses the Clipboard API with a graceful
// fallback (some browsers/contexts don't expose it, e.g. non-HTTPS or an
// embedded webview) rather than throwing.
export function ShareButton({ url, title }: { url: string; title: string }) {
  const t = useTranslations('product')
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — nothing to fall back to without a
      // library; the WhatsApp share button below still works regardless.
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`

  return (
    <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-muted">
      <button type="button" onClick={copyLink} className="hover:text-foreground transition-colors">
        {copied ? t('linkCopied') : t('copyLink')}
      </button>
      <a href={waHref} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
        {t('shareWhatsApp')}
      </a>
    </div>
  )
}
