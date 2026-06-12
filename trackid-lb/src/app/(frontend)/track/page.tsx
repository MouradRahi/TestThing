import type { Metadata } from 'next'
import { TrackForm } from './TrackForm'

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Check the status of your order using your order number.',
}

export default function TrackOrderPage() {
  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <h1 className="text-2xl font-bold text-foreground mb-3">Track your order</h1>
      <p className="text-muted text-sm leading-relaxed mb-10">
        Enter the order number from your confirmation — we&rsquo;ll show you where your piece is.
      </p>
      <TrackForm />
    </div>
  )
}
