import Image from 'next/image'

type Props = {
  photo?: string
  photoAlt?: string
  quote?: string
  name?: string
  role?: string
}

export function FounderNoteSection({ photo, photoAlt, quote, name, role }: Props) {
  if (!quote) return null

  return (
    <section className="border-t border-border px-6 py-20 md:py-28">
      <div
        className={
          photo
            ? 'max-w-4xl mx-auto grid gap-10 md:gap-14 md:grid-cols-[200px_1fr] md:items-start'
            : 'max-w-2xl mx-auto text-center'
        }
      >
        {photo && (
          <div className="relative aspect-[4/5] w-full max-w-[200px] bg-surface overflow-hidden">
            <Image
              src={photo}
              alt={photoAlt || name || ''}
              fill
              className="object-cover"
              sizes="200px"
            />
          </div>
        )}

        <div>
          <p className="text-foreground text-lg md:text-xl leading-relaxed text-pretty whitespace-pre-line">
            {quote}
          </p>
          {(name || role) && (
            <p className="mt-6 text-sm">
              <span className="text-accent" aria-hidden="true">— </span>
              {name && <span className="text-foreground font-semibold">{name}</span>}
              {name && role && <span className="text-muted">, </span>}
              {role && <span className="text-muted">{role}</span>}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
