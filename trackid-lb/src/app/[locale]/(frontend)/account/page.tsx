import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getPayload } from '@/lib/payload'
import { getCustomer } from '@/lib/auth'
import { getSiteSettings } from '@/lib/site-settings'
import { resolveLoyaltyConfig } from '@/lib/loyalty'
import { resolveAlt } from '@/lib/image'
import { formatPrice } from '@/lib/format'
import { LogoutButton } from '@/components/account/LogoutButton'
import { ProfileForm } from '@/components/account/ProfileForm'
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm'
import { WishlistButton } from '@/components/account/WishlistButton'
import { getSiteUrl } from '@/lib/env'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'account' })
  return { title: t('myAccount') }
}

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const [auth, locale] = await Promise.all([getCustomer(), getLocale()])
  if (!auth) redirect(locale === 'en' ? '/account/login' : `/${locale}/account/login`)

  const payload = await getPayload()
  const [t, tOrder, tReturns] = await Promise.all([
    getTranslations('account'),
    getTranslations('order'),
    getTranslations('returns'),
  ])

  const [customer, { docs: orders }, { docs: returns }, settings] = await Promise.all([
    payload.findByID({ collection: 'customers', id: auth.id, depth: 1, locale: locale as 'en' | 'ar' }),
    payload.find({
      collection: 'orders',
      where: { customer: { equals: auth.id } },
      sort: '-createdAt',
      limit: 50,
      depth: 0,
    }),
    payload.find({
      collection: 'returns',
      where: { customer: { equals: auth.id } },
      sort: '-createdAt',
      limit: 20,
      depth: 0,
    }),
    getSiteSettings(locale),
  ])

  const loyalty = resolveLoyaltyConfig(settings)
  const storeCredit = Number(customer.storeCredit) || 0
  const loyaltyPoints = Number(customer.loyaltyPoints) || 0
  const siteUrl = getSiteUrl()
  const referralLink = `${siteUrl}/?ref=${customer.id}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addresses = (Array.isArray(customer.addresses) ? customer.addresses : []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wishlist = (Array.isArray(customer.wishlist) ? customer.wishlist : []).filter(
    (p) => p && typeof p === 'object',
  ) as any[]

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('myAccount')}</h1>
          <p className="text-sm text-muted mt-1">{t('greeting', { name: (customer.name as string) || '' })}</p>
        </div>
        <LogoutButton />
      </div>

      {/* Order history */}
      <section className="mb-14">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted mb-5">{t('orders')}</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">{t('noOrders')}</p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-foreground">{o.orderNumber as string}</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {t('placedOn', { date: fmtDate(o.createdAt as string) })} ·{' '}
                    {tOrder(`statuses.${o.orderStatus as string}`)}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm text-foreground tabular-nums">{formatPrice(Number(o.total))}</p>
                  <div className="flex items-center gap-2 justify-end mt-0.5">
                    <Link
                      href={`/order/${o.orderNumber}`}
                      className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
                    >
                      {t('viewOrder')}
                    </Link>
                    <span className="text-[10px] text-muted">·</span>
                    <a
                      href={`/api/invoices/${o.orderNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
                    >
                      {tOrder('downloadInvoice')}
                    </a>
                    {o.orderStatus === 'delivered' && (
                      <>
                        <span className="text-[10px] text-muted">·</span>
                        <Link
                          href={`/account/returns/new/${o.orderNumber}`}
                          className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
                        >
                          {tReturns('requestReturn')}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Returns */}
      {returns.length > 0 && (
        <section className="mb-14">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted mb-5">{tReturns('yourReturns')}</h2>
          <div className="divide-y divide-border border-y border-border">
            {returns.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-foreground">{r.orderNumber as string}</p>
                  <p className="text-[11px] text-muted mt-0.5">{t('placedOn', { date: fmtDate(r.createdAt as string) })}</p>
                </div>
                <p className="text-xs text-foreground">{tReturns(`statuses.${r.status as string}`)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Wishlist */}
      <section className="mb-14">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted mb-5">{t('wishlist')}</h2>
        {wishlist.length === 0 ? (
          <p className="text-sm text-muted">{t('noWishlist')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {wishlist.map((p) => {
              const images = Array.isArray(p.images) ? p.images : []
              return (
                <div key={p.id} className="space-y-2">
                  <Link href={`/product/${p.slug}`} className="block aspect-[3/4] bg-surface border border-border relative overflow-hidden">
                    {images[0]?.url && (
                      <Image src={images[0].url} alt={resolveAlt(images[0]) || p.title || ''} fill className="object-cover" sizes="200px" />
                    )}
                  </Link>
                  <p className="text-xs text-foreground leading-snug line-clamp-1">{p.title}</p>
                  <WishlistButton productId={String(p.id)} initialSaved isLoggedIn />
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Rewards — store credit, loyalty points, referral link (ROADMAP Part 6.3/6.6) */}
      {(storeCredit > 0 || loyalty.enabled) && (
        <section className="mb-14">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted mb-5">{t('rewards')}</h2>
          <div className="flex flex-wrap gap-8 mb-5">
            {storeCredit > 0 && (
              <div>
                <p className="text-[11px] text-muted">{t('storeCredit')}</p>
                <p className="text-lg text-foreground tabular-nums">{formatPrice(storeCredit)}</p>
              </div>
            )}
            {loyalty.enabled && (
              <div>
                <p className="text-[11px] text-muted">{t('loyaltyPoints')}</p>
                <p className="text-lg text-foreground tabular-nums">{loyaltyPoints}</p>
              </div>
            )}
          </div>
          {loyalty.enabled && (
            <div>
              <p className="text-[11px] text-muted mb-1.5">{t('referralLinkNote')}</p>
              <p className="text-xs font-mono text-accent break-all border border-border px-3 py-2 bg-surface">{referralLink}</p>
            </div>
          )}
        </section>
      )}

      {/* Profile */}
      <section>
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted mb-5">{t('profile')}</h2>
        <p className="text-xs text-muted mb-5">{customer.email as string}</p>
        <ProfileForm
          name={(customer.name as string) || ''}
          phone={(customer.phone as string) || ''}
          addresses={addresses}
        />
      </section>

      {/* Password */}
      <section>
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted mb-5">{t('changePassword')}</h2>
        <ChangePasswordForm />
      </section>
    </div>
  )
}
