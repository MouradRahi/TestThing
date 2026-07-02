import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { getCustomer } from '@/lib/auth'
import { AuthForm } from '@/components/account/AuthForm'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  const [customer, locale] = await Promise.all([getCustomer(), getLocale()])
  if (customer) redirect(locale === 'en' ? '/account' : `/${locale}/account`)
  return <AuthForm mode="login" />
}
