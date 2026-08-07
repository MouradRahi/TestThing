'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useCart } from '@/components/cart/CartContext'
import { Button } from '@/components/ui/Button'
import { Field, TextareaField, SelectField, SectionLabel } from '@/components/ui/FormField'
import { formatPrice, formatLBP } from '@/lib/format'
import type { DeliveryZone } from '@/lib/site-settings'

type FormState = {
  customerName: string
  customerPhone: string
  customerEmail: string
  deliveryAddress: string
  area: string
  notes: string
  paymentMethod: 'cod' | 'bank_transfer' | 'card' | 'omt'
  website: string // honeypot — must stay empty; bots that fill it are silently dropped
}

type SavedAddress = { label?: string; area?: string; deliveryAddress?: string }

type Props = {
  zones: DeliveryZone[]
  freeDeliveryThreshold: number | null
  bankTransferInstructions: string
  /** Card option only shown when a provider is actually enabled + usable (ROADMAP F1). */
  cardPaymentsEnabled?: boolean
  /** OMT (pay-at-branch voucher) option — ROADMAP F2 §2.4. */
  omtPaymentsEnabled?: boolean
  omtInstructions?: string
  prefill?: { name?: string; phone?: string; email?: string; addresses?: SavedAddress[] }
  /** Store credit balance in USD, if signed in (ROADMAP Part 6.3). */
  storeCreditAvailable?: number
  /** Loyalty points balance, if signed in and loyalty is enabled (ROADMAP Part 6.6). */
  loyaltyPointsAvailable?: number
  loyaltyBurnPointsPerDollar?: number
}

export function CheckoutForm({
  zones,
  freeDeliveryThreshold,
  bankTransferInstructions,
  cardPaymentsEnabled,
  omtPaymentsEnabled,
  omtInstructions,
  prefill,
  storeCreditAvailable = 0,
  loyaltyPointsAvailable = 0,
  loyaltyBurnPointsPerDollar = 100,
}: Props) {
  const router = useRouter()
  const t = useTranslations('checkout')
  const { items, isLoading: cartLoading, total, clearCart, currency } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Stable for this checkout attempt (component lifetime) — a retried
  // request (network timeout, double-tap before the button disables) reuses
  // it and gets back the original order instead of creating a second one.
  // Only successful orders get cached server-side, so retrying after a fixed
  // validation error still goes through normally.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [codeInput, setCodeInput] = useState('')
  const [discount, setDiscount] = useState<{ code: string; type: 'percentage' | 'fixed'; value: number } | null>(null)
  const [discountMsg, setDiscountMsg] = useState('')
  // Gift card/store credit/points (ROADMAP Part 6.3/6.6) — unlike the
  // discount code, the gift card isn't live-validated here; the orders API
  // resolves and applies it server-side at submit time (same "server is
  // authoritative for money" trust model, just without a preview round trip).
  const [giftCardCode, setGiftCardCode] = useState('')
  const [useStoreCredit, setUseStoreCredit] = useState(false)
  const [usePoints, setUsePoints] = useState(false)
  const [discountLoading, setDiscountLoading] = useState(false)
  const savedAddresses = prefill?.addresses ?? []
  const [form, setForm] = useState<FormState>({
    customerName: prefill?.name ?? '',
    customerPhone: prefill?.phone ?? '',
    customerEmail: prefill?.email ?? '',
    deliveryAddress: '',
    area: '',
    notes: '',
    paymentMethod: 'cod',
    website: '',
  })

  const applySavedAddress = (i: number) => {
    const a = savedAddresses[i]
    if (!a) return
    setForm((prev) => ({ ...prev, area: a.area ?? '', deliveryAddress: a.deliveryAddress ?? '' }))
  }

  const hasZones = zones.length > 0
  const selectedZone = hasZones ? zones.find((z) => z.label === form.area) : undefined
  const freeDelivery =
    freeDeliveryThreshold !== null && total >= freeDeliveryThreshold
  const deliveryFee = !hasZones ? 0 : selectedZone ? (freeDelivery ? 0 : selectedZone.fee) : null

  // Display-only — the orders API recomputes the discount from the DB and is authoritative.
  const discountAmount = discount
    ? discount.type === 'percentage'
      ? Math.round(Math.min(total, (total * discount.value) / 100) * 100) / 100
      : Math.min(discount.value, total)
    : 0
  const grandTotal = Math.max(0, total - discountAmount) + (deliveryFee ?? 0)

  const applyCode = async () => {
    if (!codeInput.trim() || discountLoading) return
    setDiscountLoading(true)
    setDiscountMsg('')
    try {
      const res = await fetch('/api/discounts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput, subtotal: total }),
      })
      const data = await res.json()
      if (data.ok) {
        setDiscount({ code: data.code, type: data.type, value: data.value })
        setCodeInput(data.code)
        setDiscountMsg('')
      } else {
        setDiscount(null)
        setDiscountMsg(data.error || 'This code isn’t valid.')
      }
    } catch {
      setDiscountMsg('Could not check that code. Please try again.')
    } finally {
      setDiscountLoading(false)
    }
  }

  const removeCode = () => {
    setDiscount(null)
    setCodeInput('')
    setDiscountMsg('')
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) return
    if (!/^\+?[\d\s()-]{7,20}$/.test(form.customerPhone.trim())) {
      setError(t('phoneError'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          ...form,
          discountCode: discount?.code,
          giftCardCode: giftCardCode.trim() || undefined,
          useStoreCredit,
          usePoints,
          // Prices/titles are resolved server-side from the DB — only send what the server needs
          items: items.map((i) => ({
            productId: i.id,
            quantity: i.quantity,
            size: i.size,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Order failed')
      }
      clearCart()
      // Online payment (card) — the order is created and stock reserved, but
      // not confirmed yet. Send the customer to the provider session instead
      // of the confirmation page; paymentStatus only becomes `paid` via a
      // verified webhook, never trusted from this response.
      if (data.payment?.kind === 'redirect' && data.payment.url) {
        router.push(data.payment.url)
      } else {
        router.push(`/order/${data.orderNumber}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orderFailed'))
      setLoading(false)
    }
  }

  // Server cart still loading — never flash "your cart is empty" at checkout
  if (cartLoading && items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-6 py-32" aria-busy="true">
        <div className="h-6 w-40 bg-surface animate-pulse mx-auto mb-6" />
        <div className="h-4 w-64 bg-surface animate-pulse mx-auto" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-6 py-32 text-center">
        <p className="text-muted mb-6">{t('emptyCart')}</p>
        <Link href="/shop" className="text-xs uppercase tracking-widest text-accent hover:text-accent-hover transition-colors">
          {t('browseShop')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-foreground mb-12">{t('title')}</h1>

      <div className="grid md:grid-cols-[1fr_380px] gap-12 items-start">
        {/* Form — below summary on mobile, left on desktop */}
        <form onSubmit={handleSubmit} className="space-y-5 order-2 md:order-1">
          {/* Honeypot — hidden from real users, bots fill it and get silently dropped */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
            <label>
              Website
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>

          <SectionLabel>{t('yourDetails')}</SectionLabel>

          <Field label={t('fullName')} name="customerName" value={form.customerName} onChange={handleChange} required />
          <Field label={t('phone')} name="customerPhone" value={form.customerPhone} onChange={handleChange} required type="tel" placeholder="+961 XX XXX XXX" />
          <Field label={t('email')} name="customerEmail" value={form.customerEmail} onChange={handleChange} type="email" />

          <SectionLabel className="pt-4">{t('delivery')}</SectionLabel>

          {savedAddresses.length > 0 && (
            <SelectField
              label={t('savedAddress')}
              name="savedAddress"
              defaultValue=""
              onChange={(e) => {
                const i = Number(e.target.value)
                if (!Number.isNaN(i)) applySavedAddress(i)
              }}
            >
              <option value="">{t('savedAddressDefault')}</option>
              {savedAddresses.map((a, i) => (
                <option key={i} value={i}>
                  {a.label || a.area || `#${i + 1}`}
                </option>
              ))}
            </SelectField>
          )}

          {hasZones ? (
            <SelectField label={t('areaCity')} name="area" value={form.area} onChange={handleChange} required>
              <option value="">{t('selectArea')}</option>
              {zones.map((zone) => (
                <option key={zone.label} value={zone.label}>
                  {zone.label} — {freeDelivery ? t('free') : formatPrice(zone.fee)}
                </option>
              ))}
            </SelectField>
          ) : (
            <Field
              label={t('areaCity')}
              name="area"
              value={form.area}
              onChange={handleChange}
              required
              placeholder={t('areaPlaceholder')}
            />
          )}

          <TextareaField
            label={t('fullAddress')}
            name="deliveryAddress"
            value={form.deliveryAddress}
            onChange={handleChange}
            required
            rows={3}
            placeholder={t('addressPlaceholder')}
          />

          <SectionLabel className="pt-4">{t('payment')}</SectionLabel>

          <div className="space-y-2">
            {[
              { value: 'cod', label: t('cod') },
              { value: 'bank_transfer', label: t('bankTransfer') },
              ...(cardPaymentsEnabled ? [{ value: 'card', label: t('card') }] : []),
              ...(omtPaymentsEnabled ? [{ value: 'omt', label: t('omt') }] : []),
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

          {form.paymentMethod === 'bank_transfer' && bankTransferInstructions && (
            <div className="border border-accent/30 bg-surface px-4 py-3.5 text-xs text-muted leading-relaxed whitespace-pre-line">
              {bankTransferInstructions}
            </div>
          )}

          {form.paymentMethod === 'card' && (
            <div className="border border-accent/30 bg-surface px-4 py-3.5 text-xs text-muted leading-relaxed">
              {t('cardTestNote')}
            </div>
          )}

          {form.paymentMethod === 'omt' && omtInstructions && (
            <div className="border border-accent/30 bg-surface px-4 py-3.5 text-xs text-muted leading-relaxed whitespace-pre-line">
              {omtInstructions}
            </div>
          )}

          <TextareaField
            label={t('notes')}
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            placeholder={t('notesPlaceholder')}
          />

          {error && (
            <p className="text-sm text-red-400 border border-red-400/30 px-3 py-2">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? t('placingOrder') : t('placeOrder')}
          </Button>
        </form>

        {/* Order summary — above form on mobile, right on desktop */}
        <div className="bg-surface border border-border p-6 space-y-6 order-1 md:order-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{t('orderSummary')}</p>

          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.key} className="flex gap-3">
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
                  <p className="text-[10px] text-muted mt-0.5">
                    {item.size ? `${item.size} · ` : ''}× {item.quantity}
                  </p>
                </div>
                <p className="text-xs text-foreground tabular-nums whitespace-nowrap">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          {/* Discount code */}
          <div className="border-t border-border pt-4">
            {discount ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground">
                  {t('codeApplied', { code: discount.code })}
                </span>
                <button
                  type="button"
                  onClick={removeCode}
                  className="text-muted hover:text-foreground transition-colors uppercase tracking-widest text-[10px]"
                >
                  {t('removeCode')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyCode()
                    }
                  }}
                  placeholder={t('discountCode')}
                  aria-label={t('discountCode')}
                  className="flex-1 min-w-0 bg-bg border border-border px-3 py-2 text-xs text-foreground uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal focus:border-accent outline-none"
                />
                <button
                  type="button"
                  onClick={applyCode}
                  disabled={discountLoading || !codeInput.trim()}
                  className="shrink-0 border border-border px-3 text-[10px] uppercase tracking-widest text-muted hover:text-foreground hover:border-foreground/40 disabled:opacity-40 transition-colors"
                >
                  {discountLoading ? '…' : t('apply')}
                </button>
              </div>
            )}
            {discountMsg && <p className="text-[11px] text-red-400 mt-2">{discountMsg}</p>}
          </div>

          {/* Gift card (ROADMAP Part 6.3) — applied server-side at submit, no live preview here */}
          <div className="border-t border-border pt-4">
            <input
              type="text"
              value={giftCardCode}
              onChange={(e) => setGiftCardCode(e.target.value)}
              placeholder={t('giftCardCode')}
              aria-label={t('giftCardCode')}
              className="w-full bg-bg border border-border px-3 py-2 text-xs text-foreground uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal focus:border-accent outline-none"
            />
          </div>

          {/* Store credit + loyalty points (ROADMAP Part 6.3/6.6) — only shown when there's something to use */}
          {(storeCreditAvailable > 0 || loyaltyPointsAvailable > 0) && (
            <div className="border-t border-border pt-4 space-y-2 text-xs">
              {storeCreditAvailable > 0 && (
                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                  <input type="checkbox" checked={useStoreCredit} onChange={(e) => setUseStoreCredit(e.target.checked)} />
                  {t('useStoreCredit', { amount: formatPrice(storeCreditAvailable) })}
                </label>
              )}
              {loyaltyPointsAvailable > 0 && (
                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                  <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                  {t('usePoints', {
                    points: loyaltyPointsAvailable,
                    amount: formatPrice(Math.round((loyaltyPointsAvailable / loyaltyBurnPointsPerDollar) * 100) / 100),
                  })}
                </label>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-muted">
              <span>{t('subtotal')}</span>
              <span className="tabular-nums">{formatPrice(total)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-accent">
                <span>{t('discount')}{discount ? ` (${discount.code})` : ''}</span>
                <span className="tabular-nums">−{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>{t('deliveryLabel')}</span>
              <span className="tabular-nums">
                {!hasZones
                  ? t('deliveryByPhone')
                  : deliveryFee === null
                    ? t('selectYourArea')
                    : deliveryFee === 0
                      ? t('free')
                      : formatPrice(deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-foreground font-semibold pt-2 border-t border-border text-sm">
              <span>{t('total')}</span>
              <span className="text-end">
                <span className="tabular-nums">{formatPrice(grandTotal)}</span>
                {currency.mode === 'both' && currency.exchangeRate && (
                  <span className="block text-[10px] font-normal text-muted tabular-nums">
                    {formatLBP(grandTotal, currency.exchangeRate)}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
