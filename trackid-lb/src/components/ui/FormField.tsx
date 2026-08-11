import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

const labelCls = 'block text-[10px] uppercase tracking-[0.2em] text-muted mb-2'
const inputCls =
  'w-full bg-surface border text-foreground px-3 py-2.5 text-sm ' +
  'placeholder:text-muted/40 focus:border-accent/70 outline-none transition-colors'

const borderCls = (error?: string) => (error ? 'border-red-400/70' : 'border-border')

function FieldError({ error }: { error?: string }) {
  if (!error) return null
  // role="alert" (implicit aria-live="assertive") — screen-reader users get
  // the validation message the instant it appears, not just sighted users
  // via the red border (ENHANCEMENTS E14 leftover).
  return (
    <p role="alert" className="text-[11px] text-red-400 mt-1.5">
      {error}
    </p>
  )
}

export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={`text-[10px] uppercase tracking-[0.2em] text-muted pb-1 border-b border-border ${className}`}>
      {children}
    </p>
  )
}

export function Field({
  label,
  error,
  ...props
}: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={`${inputCls} ${borderCls(error)}`} aria-invalid={error ? true : undefined} {...props} />
      <FieldError error={error} />
    </div>
  )
}

export function TextareaField({
  label,
  error,
  ...props
}: { label: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        className={`${inputCls} ${borderCls(error)} resize-none`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      <FieldError error={error} />
    </div>
  )
}

export function SelectField({
  label,
  error,
  children,
  ...props
}: { label: string; error?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        className={`${inputCls} ${borderCls(error)} appearance-none`}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
      <FieldError error={error} />
    </div>
  )
}
