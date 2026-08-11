'use client'

import { useState } from 'react'
import { useDocumentInfo, useFormFields, useAuth } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

// Opt-in TOTP 2FA management (ROADMAP F0 §1.6 follow-up) — a `ui` field on
// Users, same "field-level custom component reading the current doc" pattern
// as StockAdjustField/InvoiceDownloadField. Three states depending on who's
// looking at whose account:
//   - your own account, 2FA off  → enroll flow (QR + confirm code)
//   - your own account, 2FA on   → disable flow (requires a current code)
//   - someone else's account     → admins only get a no-code "recovery"
//     disable button (the point of a recovery path is that the locked-out
//     person doesn't need to produce a code); non-admins see status only
type Step = 'idle' | 'enrolling' | 'confirming'

export function TwoFactorField() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const router = useRouter()
  const twoFactorEnabled = useFormFields(([fields]) => Boolean(fields?.twoFactorEnabled?.value))

  const [step, setStep] = useState<Step>('idle')
  const [qrCodeDataUri, setQrCodeDataUri] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  if (!id) return null // "create new" screen — no account to enroll yet

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerIsAdmin = (user as any)?.role === 'admin'
  const isOwnAccount = user && String(user.id) === String(id)

  const startEnroll = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/2fa/setup', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not start enrollment.')
      setQrCodeDataUri(data.qrCodeDataUri)
      setManualKey(data.secret)
      setStep('confirming')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not start enrollment.')
    } finally {
      setLoading(false)
    }
  }

  const confirmEnroll = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'That code was incorrect.')
      setStep('idle')
      setCode('')
      setQrCodeDataUri('')
      setManualKey('')
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That code was incorrect.')
    } finally {
      setLoading(false)
    }
  }

  const disableOwn = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not disable 2FA.')
      setCode('')
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not disable 2FA.')
    } finally {
      setLoading(false)
    }
  }

  const disableForOther = async () => {
    if (!window.confirm('Disable two-factor authentication for this account? Only do this as a recovery step for a lost device.')) return
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not disable 2FA.')
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not disable 2FA.')
    } finally {
      setLoading(false)
    }
  }

  const boxStyle: React.CSSProperties = {
    marginBottom: '1rem',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-m, 4px)',
    padding: '0.75rem 1rem',
    maxWidth: '360px',
  }

  if (!isOwnAccount) {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: '0.85rem', marginBottom: viewerIsAdmin && twoFactorEnabled ? '0.5rem' : 0 }}>
          Two-factor authentication: <strong>{twoFactorEnabled ? 'Enabled' : 'Disabled'}</strong>
        </div>
        {viewerIsAdmin && twoFactorEnabled && (
          <button type="button" className="btn btn--style-secondary btn--size-small" onClick={disableForOther} disabled={loading}>
            {loading ? 'Working…' : 'Disable 2FA (recovery)'}
          </button>
        )}
        {message && <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)', marginTop: '0.5rem' }}>{message}</div>}
      </div>
    )
  }

  if (twoFactorEnabled) {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Two-factor authentication is <strong>ON</strong>. Enter a current code from your authenticator app to turn it off.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: '110px', fontSize: '0.85rem', padding: '0.3rem' }}
          />
          <button type="button" className="btn btn--style-secondary btn--size-small" onClick={disableOwn} disabled={loading || code.length !== 6}>
            {loading ? 'Working…' : 'Disable'}
          </button>
        </div>
        {message && <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)', marginTop: '0.5rem' }}>{message}</div>}
      </div>
    )
  }

  if (step === 'idle') {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Two-factor authentication is off. Enable it to require a code from an authenticator app (Google Authenticator, Authy, 1Password…) on top of your password.
        </div>
        <button type="button" className="btn btn--style-primary btn--size-small" onClick={startEnroll} disabled={loading}>
          {loading ? 'Starting…' : 'Enable 2FA'}
        </button>
        {message && <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)', marginTop: '0.5rem' }}>{message}</div>}
      </div>
    )
  }

  return (
    <div style={boxStyle}>
      <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Scan this with your authenticator app, then enter the 6-digit code it shows.</div>
      {qrCodeDataUri && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrCodeDataUri} alt="2FA enrollment QR code" width={160} height={160} style={{ marginBottom: '0.5rem' }} />
      )}
      {manualKey && (
        <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-600)', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
          Can&apos;t scan? Enter this key manually: <code>{manualKey}</code>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ width: '110px', fontSize: '0.85rem', padding: '0.3rem' }}
        />
        <button
          type="button"
          className="btn btn--style-primary btn--size-small"
          onClick={confirmEnroll}
          disabled={loading || code.length !== 6}
        >
          {loading ? 'Confirming…' : 'Confirm & Enable'}
        </button>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          onClick={() => {
            setStep('idle')
            setCode('')
            setMessage('')
          }}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
      {message && <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)', marginTop: '0.5rem' }}>{message}</div>}
    </div>
  )
}
