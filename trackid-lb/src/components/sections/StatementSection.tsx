type Props = { text: string }

export function StatementSection({ text }: Props) {
  return (
    <section className="border-t border-border px-6 py-20 text-center">
      <p className="text-muted text-sm max-w-lg mx-auto leading-relaxed">{text}</p>
    </section>
  )
}
