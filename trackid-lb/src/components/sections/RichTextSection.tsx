import { RichTextRenderer } from '@/components/RichTextRenderer'

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content?: any
}

export function RichTextSection({ content }: Props) {
  if (!content) return null
  return (
    <section className="px-6 py-16 max-w-3xl mx-auto">
      <RichTextRenderer content={content} />
    </section>
  )
}
