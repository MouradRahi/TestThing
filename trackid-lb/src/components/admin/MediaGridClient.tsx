'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CollectionSlug } from 'payload'
import { useListDrawerContext, toast } from '@payloadcms/ui'
import { MediaGridTile } from './MediaGridTile'

// Client half of the Media gallery: search box (drives Payload's ?search=
// list param), selection mode, and bulk delete via the REST API. The server
// view (MediaGridView) keeps doing the fetching/pagination.
export type MediaGridDoc = {
  id: number | string
  alt?: string
  filename?: string
  thumb?: string
  label: string
  editHref: string
}

export function MediaGridClient({
  docs,
  collectionSlug,
  basePath,
  initialSearch,
}: {
  docs: MediaGridDoc[]
  collectionSlug: CollectionSlug
  basePath: string
  initialSearch: string
}) {
  const router = useRouter()
  const { isInDrawer } = useListDrawerContext()
  const [search, setSearch] = useState(initialSearch)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const sp = new URLSearchParams(window.location.search)
    if (search.trim()) sp.set('search', search.trim())
    else sp.delete('search')
    sp.delete('page') // new search always starts on page 1
    router.push(`${basePath}${sp.size ? `?${sp}` : ''}`)
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const deleteSelected = async () => {
    if (selected.size === 0 || deleting) return
    if (!window.confirm(`Delete ${selected.size} selected file${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/${collectionSlug}?where[id][in]=${[...selected].join(',')}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      toast.success(`Deleted ${selected.size} file${selected.size === 1 ? '' : 's'}.`)
      setSelected(new Set())
      setSelecting(false)
      router.refresh()
    } catch (err) {
      console.error('[media] Bulk delete failed:', err)
      toast.error('Could not delete the selected files.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Toolbar: search + selection controls (selection is hidden inside pick-an-image drawers) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem' }}>
        <form onSubmit={submitSearch} style={{ display: 'flex', gap: '0.5rem', flex: '1 1 260px', maxWidth: '420px' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by alt text or filename…"
            style={{
              flex: 1,
              padding: '0.45rem 0.7rem',
              fontSize: '0.85rem',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: 'var(--style-radius-s, 3px)',
              background: 'var(--theme-input-bg, var(--theme-elevation-0))',
              color: 'var(--theme-text)',
            }}
          />
          <button type="submit" className="btn btn--style-secondary btn--size-small">
            Search
          </button>
        </form>

        {!isInDrawer && docs.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {selecting ? (
              <>
                <span style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>
                  {selected.size} selected
                </span>
                <button
                  type="button"
                  className="btn btn--style-secondary btn--size-small"
                  onClick={() => {
                    setSelecting(false)
                    setSelected(new Set())
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--style-primary btn--size-small"
                  style={{
                    background: 'var(--theme-error-500, #d32f2f)',
                    borderColor: 'var(--theme-error-500, #d32f2f)',
                    color: '#fff',
                    opacity: selected.size === 0 || deleting ? 0.5 : 1,
                  }}
                  disabled={selected.size === 0 || deleting}
                  onClick={deleteSelected}
                >
                  {deleting ? 'Deleting…' : 'Delete selected'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn--style-secondary btn--size-small"
                onClick={() => setSelecting(true)}
              >
                Select
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {docs.length === 0 ? (
        <p style={{ color: 'var(--theme-elevation-500)' }}>
          {initialSearch
            ? `No media matches “${initialSearch}”.`
            : 'No media yet. Click “Upload new” to add your first image.'}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '1rem',
          }}
        >
          {docs.map((doc) => {
            const id = String(doc.id)
            const isSelected = selected.has(id)
            if (selecting) {
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  aria-pressed={isSelected}
                  style={{
                    position: 'relative',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    textAlign: 'inherit',
                    outline: isSelected ? '2px solid var(--theme-success-500, #2e7d32)' : 'none',
                    outlineOffset: '2px',
                    borderRadius: 'var(--style-radius-m, 4px)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      left: '0.5rem',
                      zIndex: 1,
                      width: '1.25rem',
                      height: '1.25rem',
                      borderRadius: '3px',
                      border: '1px solid var(--theme-elevation-300)',
                      background: isSelected ? 'var(--theme-success-500, #2e7d32)' : 'var(--theme-elevation-0)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      lineHeight: 1,
                    }}
                  >
                    {isSelected ? '✓' : ''}
                  </span>
                  {/* pointer-events off so the inner tile's link/select doesn't hijack the click */}
                  <span style={{ display: 'block', pointerEvents: 'none' }}>
                    <MediaGridTile
                      doc={doc}
                      editHref={doc.editHref}
                      thumb={doc.thumb}
                      label={doc.label}
                      collectionSlug={collectionSlug}
                    />
                  </span>
                </button>
              )
            }
            return (
              <MediaGridTile
                key={id}
                doc={doc}
                editHref={doc.editHref}
                thumb={doc.thumb}
                label={doc.label}
                collectionSlug={collectionSlug}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
