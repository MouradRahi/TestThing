import React from 'react'
import Link from 'next/link'
import type { ListViewServerProps } from 'payload'
import { MediaBulkUploadButton } from './MediaBulkUploadButton'
import { MediaGridClient, type MediaGridDoc } from './MediaGridClient'

// Custom admin List view for the Media collection: a thumbnail gallery instead
// of the default text table. Payload still fetches/searches/paginates from the
// URL and hands us `data.docs` — MediaGridClient adds search + bulk delete on top.
type MediaDoc = {
  id: number | string
  url?: string
  alt?: string
  filename?: string
  sizes?: { thumbnail?: { url?: string } }
}

export function MediaGridView(props: ListViewServerProps) {
  const data = props.data as { docs?: MediaDoc[]; page?: number; totalPages?: number; totalDocs?: number }
  const { newDocumentURL, hasCreatePermission, searchParams, collectionSlug } = props

  const docs = data?.docs ?? []
  const basePath = newDocumentURL.replace(/\/create$/, '')
  const page = Number(data?.page ?? 1)
  const totalPages = Number(data?.totalPages ?? 1)
  const currentSearch = typeof searchParams?.search === 'string' ? searchParams.search : ''

  const pageUrl = (p: number): string => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (typeof v === 'string') sp.set(k, v)
    }
    sp.set('page', String(p))
    return `${basePath}?${sp.toString()}`
  }

  const gridDocs: MediaGridDoc[] = docs.map((doc) => ({
    id: doc.id,
    alt: doc.alt,
    filename: doc.filename,
    thumb: doc.sizes?.thumbnail?.url || doc.url,
    label: doc.alt || doc.filename || `#${doc.id}`,
    editHref: `${basePath}/${doc.id}`,
  }))

  return (
    <div style={{ padding: 'var(--gutter-h, 2rem)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ margin: 0 }}>
          Media{' '}
          {data?.totalDocs != null && (
            <span style={{ color: 'var(--theme-elevation-500)', fontWeight: 400, fontSize: '0.8em' }}>
              ({data.totalDocs})
            </span>
          )}
        </h1>
        {hasCreatePermission && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <MediaBulkUploadButton collectionSlug={collectionSlug} />
            <Link className="btn btn--style-primary btn--size-medium" href={newDocumentURL}>
              Upload new
            </Link>
          </div>
        )}
      </div>

      <MediaGridClient
        docs={gridDocs}
        collectionSlug={collectionSlug}
        basePath={basePath}
        initialSearch={currentSearch}
      />

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            marginTop: '2rem',
          }}
        >
          {page > 1 ? (
            <Link className="btn btn--style-secondary btn--size-small" href={pageUrl(page - 1)}>
              ← Prev
            </Link>
          ) : (
            <span />
          )}
          <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link className="btn btn--style-secondary btn--size-small" href={pageUrl(page + 1)}>
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  )
}
