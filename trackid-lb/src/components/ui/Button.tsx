'use client'

import { Link } from '@/i18n/navigation'
import type { ComponentPropsWithoutRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center uppercase tracking-[0.25em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const variants: Record<ButtonVariant, string> = {
  primary:   'bg-accent text-on-accent font-semibold hover:bg-accent-hover',
  secondary: 'border border-border text-foreground hover:border-accent hover:text-accent',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'px-6 py-2.5 text-[10px]',
  md: 'px-8 py-3 text-xs',
  lg: 'px-10 py-3.5 text-xs',
}

// When fullWidth=true use w-full + slightly taller padding (form submit style)
const fullWidthClass = 'w-full py-4 text-xs'

// ---- type overloads --------------------------------------------------------

type AsButton = ComponentPropsWithoutRef<'button'> & {
  href?: never
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

type AsLink = Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> & {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** not applicable for links */
  disabled?: never
  type?: never
}

export type ButtonProps = AsButton | AsLink

// ---- component -------------------------------------------------------------

export function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const sizeClass = fullWidth ? fullWidthClass : sizes[size]
  const cls = [base, variants[variant], sizeClass, className].filter(Boolean).join(' ')

  if ('href' in rest && rest.href !== undefined) {
    const { href, ...linkRest } = rest as AsLink
    return (
      <Link href={href} className={cls} {...linkRest}>
        {children}
      </Link>
    )
  }

  return (
    <button className={cls} {...(rest as AsButton)}>
      {children}
    </button>
  )
}
