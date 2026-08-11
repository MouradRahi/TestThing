'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/Button'
import { Field, TextareaField } from '@/components/ui/FormField'

type Address = { label?: string; area?: string; deliveryAddress?: string }

export function ProfileForm({
  name,
  phone,
  addresses,
}: {
  name: string
  phone: string
  addresses: Address[]
}) {
  const t = useTranslations('account')
  const router = useRouter()
  const [form, setForm] = useState({ name, phone })
  const [addrs, setAddrs] = useState<Address[]>(addresses)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const setAddr = (i: number, key: keyof Address, value: string) =>
    setAddrs((list) => list.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, addresses: addrs }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('genericError'))
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label={t('name')} name="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
      <Field label={t('phone')} name="phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted">{t('addresses')}</span>
          <button
            type="button"
            onClick={() => setAddrs((list) => [...list, { label: '', area: '', deliveryAddress: '' }])}
            className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
          >
            + {t('addAddress')}
          </button>
        </div>
        {addrs.length === 0 && <p className="text-xs text-muted">{t('noAddresses')}</p>}
        {addrs.map((a, i) => (
          <div key={i} className="border border-border p-4 space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAddrs((list) => list.filter((_, idx) => idx !== i))}
                className="text-[10px] uppercase tracking-widest text-muted hover:text-red-400 transition-colors"
              >
                {t('removeAddress')}
              </button>
            </div>
            <Field label={t('addressLabel')} name={`label-${i}`} value={a.label ?? ''} onChange={(e) => setAddr(i, 'label', e.target.value)} />
            <Field label={t('area')} name={`area-${i}`} value={a.area ?? ''} onChange={(e) => setAddr(i, 'area', e.target.value)} />
            <TextareaField label={t('deliveryAddress')} name={`addr-${i}`} rows={2} value={a.deliveryAddress ?? ''} onChange={(e) => setAddr(i, 'deliveryAddress', e.target.value)} />
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? t('saving') : saved ? t('saved') : t('save')}
      </Button>
    </form>
  )
}
