'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextareaField, SelectField, SectionLabel } from '@/components/ui/FormField'

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

        <TextareaField
          label="What do you want? *"
          name="description"
          value={form.description}
          onChange={handleChange}
          required
          rows={4}
          placeholder="Describe the design, mood, or idea — as much detail as you want…"
        />

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

        <SelectField
          label="Garment Type"
          name="garmentType"
          value={form.garmentType}
          onChange={handleChange}
        >
          <option value="">Select a garment…</option>
          {GARMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>

        {error && (
          <p className="text-sm text-red-400 border border-red-400/30 px-3 py-2">{error}</p>
        )}

        <Button type="submit" fullWidth disabled={loading} className="mt-2">
          {loading ? 'Sending…' : 'Send Request'}
        </Button>

        <p className="text-[11px] text-muted text-center pt-1">
          We'll get back to you on WhatsApp with a quote and timeline.
        </p>
      </form>
    </div>
  )
}
