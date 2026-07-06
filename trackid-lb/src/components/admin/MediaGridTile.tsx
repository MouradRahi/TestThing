'use client'

import React from 'react'
import Link from 'next/link'
import { useListDrawerContext } from '@payloadcms/ui'
import type { CollectionSlug } from 'payload'

// A single media tile. On the normal list page it links to the doc's edit page.
// When the same list view is rendered inside a relationship/upload "select
// existing" drawer, it calls the drawer's onSelect instead — mirroring how
// Payload's default cell behaves (RenderDefaultCell).
type MediaTileDoc = {
  id: number | string
  alt?: string
  filename?: string
}

type Props = {
  doc: MediaTileDoc
  editHref: string
  thumb?: string
  label: string
  collectionSlug: string
}

const cardStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m, 4px)',
  overflow: 'hidden',
  background: 'var(--theme-elevation-50)',
  textDecoration: 'none',
  color: 'var(--theme-text)',
  textAlign: 'left',
  font: 'inherit',
  cursor: 'pointer',
}

function TileInner({ thumb, label, alt }: { thumb?: string; label: string; alt?: string }) {
  return (
    <>
      <div
        style={{
          aspectRatio: '1 / 1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--theme-elevation-100)',
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of unknown dimensions
          <img src={thumb} alt={alt || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--theme-elevation-400)', fontSize: '0.8rem' }}>No preview</span>
        )}
      </div>
      <div
        style={{
          padding: '0.5rem 0.625rem',
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
    </>
  )
}

export function MediaGridTile({ doc, editHref, thumb, label, collectionSlug }: Props) {
  const { isInDrawer, onSelect } = useListDrawerContext()

  if (isInDrawer && typeof onSelect === 'function') {
    return (
      <button
        type="button"
        title={label}
        onClick={() => onSelect({ collectionSlug: collectionSlug as CollectionSlug, doc, docID: String(doc.id) })}
        style={cardStyle}
      >
        <TileInner thumb={thumb} label={label} alt={doc.alt} />
      </button>
    )
  }

  return (
    <Link href={editHref} title={label} style={cardStyle}>
      <TileInner thumb={thumb} label={label} alt={doc.alt} />
    </Link>
  )
}
