import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

const labelCls = 'block text-[10px] uppercase tracking-[0.2em] text-muted mb-2'
const inputCls =
  'w-full bg-surface border border-border text-foreground px-3 py-2.5 text-sm ' +
  'placeholder:text-muted/40 focus:border-accent/70 outline-none transition-colors'

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
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={inputCls} {...props} />
    </div>
  )
}

export function TextareaField({
  label,
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea className={`${inputCls} resize-none`} {...props} />
    </div>
  )
}

export function SelectField({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={`${inputCls} appearance-none`} {...props}>
        {children}
      </select>
    </div>
  )
}
