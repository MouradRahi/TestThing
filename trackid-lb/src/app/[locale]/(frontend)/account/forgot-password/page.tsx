import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { getCustomer } from '@/lib/auth'
import { ForgotPasswordForm } from '@/components/account/ForgotPasswordForm'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'account' })
  return { title: t('forgotPasswordTitle') }
}

export default async function ForgotPasswordPage() {
  const [customer, locale] = await Promise.all([getCustomer(), getLocale()])
  if (customer) redirect(locale === 'en' ? '/account' : `/${locale}/account`)
  return <ForgotPasswordForm />
}
