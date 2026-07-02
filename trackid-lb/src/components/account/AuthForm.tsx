'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { useCart } from '@/components/cart/CartContext'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/FormField'

// Shared login / register form. On success the httpOnly auth cookie is set by
// the API route; we refresh so server components pick up the new session.
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const t = useTranslations('account')
  const router = useRouter()
  const { refreshCart } = useCart()
  const isRegister = mode === 'register'

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/account/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
      <h1 className="text-2xl font-bold text-foreground mb-8">
        {isRegister ? t('registerTitle') : t('loginTitle')}
      </h1>

      <form onSubmit={submit} className="space-y-5">
        {isRegister && (
          <Field label={t('name')} name="name" value={form.name} onChange={onChange} required autoComplete="name" />
        )}
        <Field
          label={t('email')}
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          required
          autoComplete="email"
        />
        {isRegister && (
          <Field label={t('phone')} name="phone" type="tel" value={form.phone} onChange={onChange} autoComplete="tel" />
        )}
        <Field
          label={t('password')}
          name="password"
          type="password"
          value={form.password}
          onChange={onChange}
          required
          autoComplete={isRegister ? 'new-password' : 'current-password'}
        />
        {isRegister && <p className="text-[11px] text-muted -mt-2">{t('passwordHint')}</p>}

        {error && <p className="text-sm text-red-400 border border-red-400/30 px-3 py-2">{error}</p>}

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? (isRegister ? t('creating') : t('loggingIn')) : isRegister ? t('registerCta') : t('loginCta')}
        </Button>
      </form>

      <p className="text-xs text-muted mt-8 text-center">
        {isRegister ? t('haveAccount') : t('noAccount')}{' '}
        <Link
          href={isRegister ? '/account/login' : '/account/register'}
          className="text-accent hover:text-accent-hover transition-colors"
        >
          {isRegister ? t('loginLink') : t('registerLink')}
        </Link>
      </p>
    </div>
  )
}
