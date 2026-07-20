import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ResetPasswordForm } from '@/components/account/ResetPasswordForm'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'account' })
  return { title: t('resetPasswordTitle') }
}

// No redirect-if-logged-in check here (unlike login/register/forgot-password):
// a stale session shouldn't block using a reset link — submitting overwrites
// the auth cookie with the freshly-reset account regardless.
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <ResetPasswordForm token={token} />
}
