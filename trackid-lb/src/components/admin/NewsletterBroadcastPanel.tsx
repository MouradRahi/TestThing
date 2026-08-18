import { isAdmin } from '@/lib/access'
import { NewsletterBroadcastForm } from './NewsletterBroadcastForm'

// Admin drop-announcement broadcast (ROADMAP Part 7) — renders nothing when
// the newsletter feature itself isn't configured (RESEND_AUDIENCE_ID unset),
// same env-gate as the storefront capture forms.
export async function NewsletterBroadcastPanel(props: { user?: unknown }) {
  if (!isAdmin(props.user)) return null
  if (!process.env.RESEND_AUDIENCE_ID) return null

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 'var(--style-radius-m, 4px)',
        background: 'var(--theme-elevation-50)',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--theme-elevation-500)',
          marginBottom: '0.75rem',
        }}
      >
        Newsletter Broadcast
      </div>
      <NewsletterBroadcastForm />
    </div>
  )
}
