'use client'

import { useState } from 'react'
import type { Metadata } from 'next'

// Note: metadata export is ignored in client components — set via generateMetadata in a server wrapper if needed.
// For now the layout template handles the title suffix.

type FormState = {
  name: string
  phone: string
  email: string
  description: string
  referenceArtist: string
  referenceSong: string
  garmentType: string
}

const GARMENT_OPTIONS = [
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'tee', label: 'T-Shirt' },
  { value: 'jacket', label: 'Jacket' },
  { value: 'other', label: 'Other' },
]

export default function CustomRequestPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    email: '',
    description: '',
    referenceArtist: '',
    referenceSong: '',
    garmentType: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/custom-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-6 py-32 text-center">
        <div className="w-12 h-12 border border-accent/50 rounded-full flex items-center justify-center mx-auto mb-8 text-accent text-xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Request received</h1>
        <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">
          We'll review your idea and reach out on WhatsApp within a day or two. Keep your phone close.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Editorial header */}
      <div className="mb-14">
        <p className="text-accent text-[10px] uppercase tracking-[0.4em] mb-4">Custom Piece</p>
        <h1 className="text-4xl font-bold text-foreground leading-tight mb-4">
          Something no one<br />else will ever own.
        </h1>
        <p className="text-muted text-sm leading-relaxed max-w-sm">
          Tell us the artist, the song, the feeling. We'll hand-paint a piece made exactly for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <SectionLabel>You</SectionLabel>

        <Field label="Full Name *" name="name" value={form.name} onChange={handleChange} required />
        <Field
          label="Phone *"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          required
          type="tel"
          placeholder="+961 XX XXX XXX"
        />
        <Field
          label="Email"
          name="email"
          value={form.email}
          onChange={handleChange}
          type="email"
          placeholder="Optional — for follow-up"
        />

        <SectionLabel className="pt-4">The Piece</SectionLabel>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-muted mb-2">
            What do you want? *
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            rows={4}
            placeholder="Describe the design, mood, or idea — as much detail as you want…"
            className="w-full bg-surface border border-border text-foreground px-3 py-2.5 text-sm placeholder:text-muted/40 focus:border-accent/70 outline-none transition-colors resize-none"
          />
        </div>

        <Field
          label="Artist / Band Reference"
          name="referenceArtist"
          value={form.referenceArtist}
          onChange={handleChange}
          placeholder="e.g. Radiohead, Fairuz, Massive Attack…"
        />
        <Field
          label="Song / Album Reference"
          name="referenceSong"
          value={form.referenceSong}
          onChange={handleChange}
          placeholder="e.g. Karma Police, Ya Rayah…"
        />

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-muted mb-2">
            Garment Type
          </label>
          <select
            name="garmentType"
            value={form.garmentType}
            onChange={handleChange}
            className="w-full bg-surface border border-border text-foreground px-3 py-2.5 text-sm focus:border-accent/70 outline-none transition-colors appearance-none"
          >
            <option value="">Select a garment…</option>
            {GARMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-400 border border-red-400/30 px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 text-xs uppercase tracking-[0.25em] bg-accent text-bg font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Sending…' : 'Send Request'}
        </button>

        <p className="text-[11px] text-muted text-center pt-1">
          We'll get back to you on WhatsApp with a quote and timeline.
        </p>
      </form>
    </div>
  )
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] uppercase tracking-[0.2em] text-muted pb-1 border-b border-border ${className}`}>
      {children}
    </p>
  )
}

function Field({
  label,
  name,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-muted mb-2">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full bg-surface border border-border text-foreground px-3 py-2.5 text-sm placeholder:text-muted/40 focus:border-accent/70 outline-none transition-colors"
      />
    </div>
  )
}
