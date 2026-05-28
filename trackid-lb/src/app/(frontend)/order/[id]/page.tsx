import type { Metadata } from 'next'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = { title: 'Order Confirmed' }

type Props = { params: Promise<{ id: string }> }

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="max-w-md mx-auto px-6 py-32 text-center">
      <div className="w-12 h-12 border border-accent/50 rounded-full flex items-center justify-center mx-auto mb-8 text-accent text-xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-3">Order received</h1>
      <p className="text-muted text-sm mb-2">Thank you for supporting the music.</p>
      <p className="font-mono text-accent text-base tracking-wider mb-8">{id}</p>
      <p className="text-xs text-muted leading-relaxed max-w-xs mx-auto mb-12">
        Our team will reach out shortly to confirm your delivery details. Keep your phone nearby.
      </p>
      <Button href="/shop" variant="secondary">Continue Shopping</Button>
    </div>
  )
}
