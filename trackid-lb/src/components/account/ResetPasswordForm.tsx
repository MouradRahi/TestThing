'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { useCart } from '@/components/cart/CartContext'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/FormField'

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('account')
  const router = useRouter()
  const { refreshCart } = useCart()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(t('passwordMismatch'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/account/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('genericError'))
      refreshCart() // guest cart just merged into the account
      router.push('/account')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-2xl font-bold text-foreground mb-8">{t('resetPasswordTitle')}</h1>

      <form onSubmit={submit} className="space-y-5">
        <Field
          label={t('newPassword')}
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <p className="text-[11px] text-muted -mt-2">{t('passwordHint')}</p>
        <Field
          label={t('confirmPassword')}
          name="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />

        {error && <p className="text-sm text-red-400 border border-red-400/30 px-3 py-2">{error}</p>}

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? t('resetting') : t('resetCta')}
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
