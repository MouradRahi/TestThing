'use client'

import { useEffect, useRef, useState } from 'react'

// Mounted via admin.components.beforeLogin — renders on Payload's built-in
// /admin/login page, alongside (not replacing) the stock <LoginForm>. That
// form isn't itself overridable in this Payload version (its LoginView only
// exposes before/after decorative slots — confirmed by reading
// @payloadcms/next's source before building this), so instead of fighting
// that, this component intercepts the SAME-ORIGIN fetch call the stock form
// already makes to /api/users/login. It only reacts to the endpoint's public
// REST contract (URL, JSON body/response shape, both part of Payload's
// documented API) — never DOM structure or CSS class names — so it keeps
// working across a Payload UI refactor that would break a DOM-scraping
// approach.
//
// Flow: pass the real request straight through. If the response is a 401
// carrying our Users.ts beforeLogin marker (2FA_REQUIRED / 2FA_INVALID),
// capture the email+password already in that request's own body, show a
// small code modal, and — once submitted — issue the SAME request again
// with `twoFactorCode` added. The resubmitted response is returned as if it
// were the original fetch's result, so Payload's own <LoginForm> (which set
// up this whole call) sees a normal login response and handles the
// cookie/redirect exactly as it always does — no reimplementation needed.
type PendingLogin = {
  resolve: (code: string | null) => void
}

export function AdminTwoFactorLoginGate() {
  const [pending, setPending] = useState<PendingLogin | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [code, setCode] = useState('')
  const pendingRef = useRef<PendingLogin | null>(null)

  useEffect(() => {
    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

      if (method !== 'POST' || !url.includes('/users/login')) {
        return originalFetch(input, init)
      }

      const response = await originalFetch(input, init)
      if (response.status !== 401) return response

      const parsed = await response
        .clone()
        .json()
        .catch(() => null)
      const message = parsed?.errors?.[0]?.message
      if (message !== '2FA_REQUIRED' && message !== '2FA_INVALID') return response

      let bodyText = ''
      if (typeof init?.body === 'string') {
        bodyText = init.body
      } else if (input instanceof Request) {
        bodyText = await input
          .clone()
          .text()
          .catch(() => '')
      }
      let email = ''
      let password = ''
      try {
        const data = JSON.parse(bodyText)
        email = typeof data.email === 'string' ? data.email : ''
        password = typeof data.password === 'string' ? data.password : ''
      } catch {
        return response
      }
      if (!email || !password) return response

      setInvalid(message === '2FA_INVALID')
      const submittedCode = await new Promise<string | null>((resolve) => {
        pendingRef.current = { resolve }
        setPending({ resolve })
      })

      if (!submittedCode) return response // cancelled — let Payload show its own error state

      return originalFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, twoFactorCode: submittedCode }),
      })
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const entry = pendingRef.current
    if (!entry) return
    pendingRef.current = null
    setPending(null)
    entry.resolve(code)
    setCode('')
  }

  const cancel = () => {
    const entry = pendingRef.current
    if (!entry) return
    pendingRef.current = null
    setPending(null)
    setCode('')
    entry.resolve(null)
  }

  if (!pending) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Two-factor authentication code"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: 'var(--theme-elevation-0, #fff)',
          borderRadius: 'var(--style-radius-m, 4px)',
          padding: '1.5rem',
          width: '320px',
          maxWidth: '90vw',
        }}
      >
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Enter your 2FA code</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-600)', marginBottom: '0.75rem' }}>
          Open your authenticator app and enter the current 6-digit code.
        </p>
        {invalid && (
          <p style={{ fontSize: '0.85rem', color: '#c0392b', marginBottom: '0.5rem' }}>That code was incorrect. Please try again.</p>
        )}
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ width: '100%', fontSize: '1rem', padding: '0.5rem', marginBottom: '0.75rem', letterSpacing: '0.2em', textAlign: 'center' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn--style-primary btn--size-small" disabled={code.length !== 6}>
            Verify
          </button>
          <button type="button" className="btn btn--style-secondary btn--size-small" onClick={cancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
