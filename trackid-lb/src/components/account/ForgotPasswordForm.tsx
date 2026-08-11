'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/FormField'

// Always shows the same success message whether or not the email is
// registered — the API deliberately never reveals which emails have accounts.
export function ForgotPasswordForm() {
  const t = useTranslations('account')
  const locale = useLocale()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/account/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('genericError'))
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">{t('forgotPasswordTitle')}</h1>
        <p className="text-sm text-muted leading-relaxed">{t('forgotPasswordSent')}</p>
        <Link href="/account/login" className="inline-block mt-8 text-xs text-accent hover:text-accent-hover transition-colors">
          {t('backToLogin')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-2xl font-bold text-foreground mb-3">{t('forgotPasswordTitle')}</h1>
      <p className="text-sm text-muted mb-8">{t('forgotPasswordDesc')}</p>

      <form onSubmit={submit} className="space-y-5">
        <Field label={t('email')} name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

        {error && (
          <p role="alert" className="text-sm text-red-400 border border-red-400/30 px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? t('sending') : t('forgotPasswordCta')}
        </Button>
      </form>

      <p className="text-xs text-muted mt-8 text-center">
        <Link href="/account/login" className="text-accent hover:text-accent-hover transition-colors">
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  )
}
