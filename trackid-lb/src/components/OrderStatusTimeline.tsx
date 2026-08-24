import { getTranslations } from 'next-intl/server'

// E11 (ENHANCEMENTS.md) — the order page used to just print the status as a
// word. Pure UI over data that already exists (order.orderStatus); renders
// nothing for a cancelled order (it doesn't map to a step on this pipeline —
// the page's plain status line already covers that case distinctly).
const STEPS = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered'] as const

export async function OrderStatusTimeline({ status, locale }: { status: string; locale: string }) {
  if (status === 'cancelled') return null

  const t = await getTranslations({ locale, namespace: 'order' })
  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number])

  return (
    <ol className="flex items-start mb-1">
      {STEPS.map((step, i) => {
        const done = currentIndex >= 0 && i <= currentIndex
        const isCurrent = i === currentIndex
        return (
          <li key={step} className="flex-1 flex flex-col items-center text-center relative">
            {i > 0 && (
              <div
                className={`absolute top-2 h-px w-full end-1/2 -z-10 ${done ? 'bg-accent' : 'bg-border'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                done ? 'bg-accent border-accent' : 'bg-bg border-border'
              }`}
              aria-hidden="true"
            >
              {done && !isCurrent && (
                <svg width="8" height="8" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="text-on-accent">
                  <path d="M2.5 7.5l3 3 6-6" />
                </svg>
              )}
            </span>
            <span
              className={`mt-2 text-[9px] uppercase tracking-wider leading-tight px-1 ${
                isCurrent ? 'text-foreground' : done ? 'text-foreground/70' : 'text-muted'
              }`}
            >
              {t(`statuses.${step}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
