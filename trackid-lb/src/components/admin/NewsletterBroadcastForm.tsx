'use client'

import { useState } from 'react'

// Composes + creates a Resend broadcast against the configured segment
// (RESEND_AUDIENCE_ID). Defaults to creating a DRAFT — "Send immediately" is
// an explicit opt-in checkbox, not the default, so a mis-click can't blast
// the whole list; leaving it unchecked lets the admin do a final review/send
// from Resend's own dashboard instead.
export function NewsletterBroadcastForm() {
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [sendNow, setSendNow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    if (!subject.trim() || !html.trim()) {
      setError('Subject and body are both required.')
      return
    }
    if (sendNow && !window.confirm('Send this broadcast to the whole list right now? This cannot be undone.')) return

    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/newsletter/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, html, sendNow }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create broadcast')
      setMessage(sendNow ? 'Broadcast sent ✓' : 'Draft created — review and send from your Resend dashboard.')
      setSubject('')
      setHtml('')
      setSendNow(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create broadcast')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '0.85rem',
    padding: '0.5rem',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-s, 3px)',
    background: 'var(--theme-input-bg, transparent)',
    marginBottom: '0.6rem',
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <input
        type="text"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        style={inputStyle}
      />
      <textarea
        placeholder="HTML body — e.g. <p>New drop is live…</p>"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        rows={6}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
        <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
        Send immediately (otherwise creates a draft to review in Resend)
      </label>
      <button type="button" className="btn btn--style-primary btn--size-small" onClick={submit} disabled={loading}>
        {loading ? 'Working…' : sendNow ? 'Send Broadcast' : 'Create Draft'}
      </button>
      {message && <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)', marginTop: '0.5rem' }}>{message}</div>}
      {error && <div style={{ fontSize: '0.8rem', color: '#c0392b', marginTop: '0.5rem' }}>{error}</div>}
    </div>
  )
}
