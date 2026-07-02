import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Custom Request',
  description: 'Commission a one-of-a-kind hand-painted piece. Tell us the artist, the song, the feeling — we\'ll make something no one else will ever own.',
}

export default function CustomRequestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
