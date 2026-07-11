import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getPayload } from '@/lib/payload'
import { getCustomer } from '@/lib/auth'
import { resolveAlt } from '@/lib/image'
import { formatPrice } from '@/lib/format'
import { LogoutButton } from '@/components/account/LogoutButton'
import { ProfileForm } from '@/components/account/ProfileForm'
import { WishlistButton } from '@/components/account/WishlistButton'

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
  const [t, tOrder] = await Promise.all([getTranslations('account'), getTranslations('order')])

  const [customer, { docs: orders }] = await Promise.all([
    payload.findByID({ collection: 'customers', id: auth.id, depth: 1, locale: locale as 'en' | 'ar' }),
    payload.find({
      collection: 'orders',
      where: { customer: { equals: auth.id } },
      sort: '-createdAt',
      limit: 50,
      depth: 0,
    }),
  ])

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
                  <Link
                    href={`/order/${o.orderNumber}`}
                    className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
                  >
                    {t('viewOrder')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
    </div>
  )
}
