type Step = { title?: string; description?: string }

type Props = {
  eyebrow?: string
  heading?: string
  intro?: string
  steps?: Step[]
}

export function ProcessStepsSection({ eyebrow, heading, intro, steps = [] }: Props) {
  const visible = steps.filter(s => s?.title)
  if (!visible.length) return null

  return (
    <section className="border-t border-border px-6 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">
        {(eyebrow || heading || intro) && (
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end mb-14 md:mb-20">
            <div>
              {eyebrow && (
                <p className="text-accent text-[10px] uppercase tracking-[0.4em] mb-4">{eyebrow}</p>
              )}
              {heading && (
                <h2 className="text-3xl md:text-5xl font-bold text-foreground leading-tight tracking-tight text-balance max-w-xl">
                  {heading}
                </h2>
              )}
            </div>
            {intro && (
              <p className="text-muted text-sm leading-relaxed max-w-xs text-pretty md:text-end">{intro}</p>
            )}
          </div>
        )}

        {/* auto-fit, not fixed columns: the step count is admin-defined, so the
            grid has to hold up at 3 steps and at 6 without a breakpoint edit. */}
        <ol className="grid gap-x-8 gap-y-12 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          {visible.map((step, i) => (
            <li
              key={i}
              className="group border-t border-border pt-5 transition-colors duration-300 hover:border-accent/40"
            >
              {/* Decorative: the <ol> already conveys position to screen readers. */}
              <span
                aria-hidden="true"
                className="block text-accent/70 text-4xl md:text-5xl font-bold leading-none tabular-nums mb-6 transition-colors duration-300 group-hover:text-accent"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-foreground text-base font-semibold mb-2 text-balance">{step.title}</h3>
              {step.description && (
                <p className="text-muted text-sm leading-relaxed text-pretty">{step.description}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
