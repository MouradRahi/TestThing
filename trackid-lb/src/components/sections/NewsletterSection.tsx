import { NewsletterForm } from '@/components/NewsletterForm'

type Props = { heading?: string; subtext?: string; bgColor?: string }

// Renders nothing when RESEND_AUDIENCE_ID isn't configured — same env-gate
// as the always-on Footer newsletter instance (ROADMAP Part 7).
export function NewsletterSection({ heading, subtext, bgColor }: Props) {
  if (!process.env.RESEND_AUDIENCE_ID) return null

  return (
    <section
      className="border-t border-border px-6 py-20 text-center"
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <div className="max-w-sm mx-auto">
        {heading && <h2 className="text-xl font-bold text-foreground mb-3">{heading}</h2>}
        {subtext && <p className="text-sm text-muted mb-6">{subtext}</p>}
        <NewsletterForm />
      </div>
    </section>
  )
}
