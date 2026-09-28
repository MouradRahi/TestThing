type Props = {
  text: string
  size?: 'display' | 'caption' | null
}

export function StatementSection({ text, size }: Props) {
  // Statement blocks saved before `size` existed come back null. Those keep the
  // original caption rendering byte-for-byte rather than silently resizing live
  // content; new blocks default to 'display' in the admin.
  const display = size === 'display'

  return (
    <section
      className={`border-t border-border px-6 text-center ${display ? 'py-24 md:py-32' : 'py-20'}`}
    >
      <p
        className={
          display
            ? 'text-foreground text-2xl md:text-4xl font-bold leading-tight tracking-tight text-balance max-w-3xl mx-auto'
            : 'text-muted text-sm max-w-lg mx-auto leading-relaxed'
        }
      >
        {text}
      </p>
    </section>
  )
}
