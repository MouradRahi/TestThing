'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/FormField'

export function ChangePasswordForm() {
  const t = useTranslations('account')
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    if (form.newPassword !== form.confirm) {
      setError(t('passwordMismatch'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('genericError'))
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field
        label={t('currentPassword')}
        name="currentPassword"
        type="password"
        value={form.currentPassword}
        onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
        required
        autoComplete="current-password"
      />
      <Field
        label={t('newPassword')}
        name="newPassword"
        type="password"
        value={form.newPassword}
        onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
        required
        autoComplete="new-password"
      />
      <p className="text-[11px] text-muted -mt-2">{t('passwordHint')}</p>
      <Field
        label={t('confirmPassword')}
        name="confirm"
        type="password"
        value={form.confirm}
        onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
        required
        autoComplete="new-password"
      />

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? t('changingPassword') : saved ? t('passwordChanged') : t('changePasswordCta')}
      </Button>
    </form>
  )
}
