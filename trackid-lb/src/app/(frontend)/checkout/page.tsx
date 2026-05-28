'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/components/cart/CartContext'
import { Button } from '@/components/ui/Button'
import { Field, TextareaField, SectionLabel } from '@/components/ui/FormField'

type FormState = {
  customerName: string
  customerPhone: string
  customerEmail: string
  deliveryAddress: string
  area: string
  notes: string
  paymentMethod: 'cod' | 'bank_transfer'
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, total, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    deliveryAddress: '',
    area: '',
    notes: '',
    paymentMethod: 'cod',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: items.map((i) => ({
            productId: i.id,
            titleAtPurchase: i.title,
            priceAtPurchase: i.price,
            quantity: i.quantity,
            imageUrl: i.imageUrl,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Order failed')
      }
      const { orderNumber } = await res.json()
      clearCart()
      router.push(`/order/${orderNumber}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-6 py-32 text-center">
        <p className="text-muted mb-6">Your cart is empty.</p>
        <Link href="/shop" className="text-xs uppercase tracking-widest text-accent hover:text-accent-hover transition-colors">
          Browse Shop
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-foreground mb-12">Checkout</h1>

      <div className="grid md:grid-cols-[1fr_380px] gap-12 items-start">
        {/* Form — below summary on mobile, left on desktop */}
        <form onSubmit={handleSubmit} className="space-y-5 order-2 md:order-1">
          <SectionLabel>Your Details</SectionLabel>

          <Field label="Full Name *" name="customerName" value={form.customerName} onChange={handleChange} required />
          <Field label="Phone Number *" name="customerPhone" value={form.customerPhone} onChange={handleChange} required type="tel" placeholder="+961 XX XXX XXX" />
          <Field label="Email (for confirmation)" name="customerEmail" value={form.customerEmail} onChange={handleChange} type="email" />

          <SectionLabel className="pt-4">Delivery</SectionLabel>

          <Field
            label="Area / City *"
            name="area"
            value={form.area}
            onChange={handleChange}
            required
            placeholder="e.g. Beirut, Tripoli, Saida…"
          />

          <TextareaField
            label="Full Address *"
            name="deliveryAddress"
            value={form.deliveryAddress}
            onChange={handleChange}
            required
            rows={3}
            placeholder="Street, building, floor, apartment…"
          />

          <SectionLabel className="pt-4">Payment</SectionLabel>

          <div className="space-y-2">
            {[
              { value: 'cod', label: 'Cash on Delivery' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-4 py-3.5 border cursor-pointer transition-colors ${
                  form.paymentMethod === opt.value
                    ? 'border-accent/70 text-foreground'
                    : 'border-border text-muted hover:border-foreground/40'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={opt.value}
                  checked={form.paymentMethod === opt.value}
                  onChange={handleChange}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>

          <TextareaField
            label="Notes (optional)"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            placeholder="Any special instructions…"
          />

          {error && (
            <p className="text-sm text-red-400 border border-red-400/30 px-3 py-2">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? 'Placing order…' : 'Place Order'}
          </Button>
        </form>

        {/* Order summary — above form on mobile, right on desktop */}
        <div className="bg-surface border border-border p-6 space-y-6 order-1 md:order-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Order Summary</p>

          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-14 h-16 bg-bg border border-border shrink-0 relative overflow-hidden">
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-snug">{item.title}</p>
                  <p className="text-[10px] text-muted mt-0.5">× {item.quantity}</p>
                </div>
                <p className="text-xs text-foreground tabular-nums whitespace-nowrap">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="tabular-nums">${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Delivery</span>
              <span>TBD</span>
            </div>
            <div className="flex justify-between text-foreground font-semibold pt-2 border-t border-border text-sm">
              <span>Total</span>
              <span className="tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

