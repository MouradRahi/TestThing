'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Link } from '@/i18n/navigation'

export function WriteReviewForm({ productId }: { productId: string }) {
  const t = useTranslations('product')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Login state is resolved here rather than by the page, so the product page
  // never calls a dynamic API and stays statically rendered (BUGS.md B26).
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/account/me')
      .then((r) => (r.ok ? r.json() : { isLoggedIn: false }))
      .then((d) => { if (active) setIsLoggedIn(!!d.isLoggedIn) })
      .catch(() => { if (active) setIsLoggedIn(false) })
    return () => { active = false }
  }, [])

  const submit = async () => {
    if (rating < 1) {
      setError(t('reviewPickRating'))
      return
    }
    if (!text.trim()) {
      setError(t('reviewTextRequired'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: Number(productId), rating, text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('genericError'))
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
    } finally {
      setLoading(false)
    }
  }

  // Undetermined on first paint: render nothing rather than flashing the wrong state.
  if (isLoggedIn === null) return null
  if (!isLoggedIn)
    return (
      <p className="text-xs text-muted">
        <Link href="/account/login" className="underline hover:text-foreground">
          {t('reviewSignIn')}
        </Link>
      </p>
    )

  if (done) return <p className="text-xs text-muted">{t('reviewSubmitted')}</p>

  return (
    <div className="space-y-3">
      <div className="flex gap-1" role="radiogroup" aria-label={t('rating')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={t('starRating', { count: n })}
            aria-pressed={rating === n}
            className={`text-xl leading-none ${n <= rating ? 'text-accent' : 'text-muted/40'}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={t('reviewPlaceholder')}
        className="w-full bg-bg border border-border px-3 py-2 text-xs text-foreground resize-none focus:border-accent outline-none"
      />
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <Button type="button" variant="secondary" onClick={submit} disabled={loading}>
        {loading ? t('submitting') : t('submitReview')}
      </Button>
    </div>
  )
}
