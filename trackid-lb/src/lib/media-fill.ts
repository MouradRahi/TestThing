import type { BasePayload } from 'payload'

/**
 * Resolve the public URL of a Media document from an upload-field value.
 * Accepts either a raw id (what's stored on save) or an already-populated
 * media object (depth > 0). Returns null when nothing usable is found.
 */
export async function mediaUrl(payload: BasePayload, value: unknown): Promise<string | null> {
  if (value === null || value === undefined || value === '') return null

  // Already populated (e.g. depth > 0)
  if (typeof value === 'object') {
    const url = (value as { url?: string }).url
    return typeof url === 'string' ? url : null
  }

  try {
    const doc = await payload.findByID({
      collection: 'media',
      id: value as string | number,
      depth: 0,
    })
    const url = (doc as { url?: string })?.url
    return typeof url === 'string' ? url : null
  } catch {
    return null // media missing/unreadable — keep whatever URL is already set
  }
}

/**
 * Walk a page/homepage `sections` blocks array and, for any block that carries a
 * picked Media relation (`*Media` field), copy the media's public URL into the
 * plain text field the storefront section reads. Mutates the blocks in place.
 * Shared by the Homepage global and the Pages collection so both block builders
 * behave identically.
 */
export async function fillBlocksMedia(payload: BasePayload, blocks: unknown): Promise<void> {
  if (!Array.isArray(blocks)) return
  for (const block of blocks) {
    if (!block) continue
    switch (block.blockType) {
      case 'hero':
      case 'cta-banner':
        if (block.bgImageMedia) {
          const url = await mediaUrl(payload, block.bgImageMedia)
          if (url) block.bgImage = url
        }
        break
      case 'founder-note':
        if (block.photoMedia) {
          const url = await mediaUrl(payload, block.photoMedia)
          if (url) block.photo = url
        }
        break
      case 'image-text':
        if (block.imageMedia) {
          const url = await mediaUrl(payload, block.imageMedia)
          if (url) block.image = url
        }
        break
      case 'slideshow':
        if (Array.isArray(block.slides)) {
          for (const slide of block.slides) {
            if (slide?.bgImageMedia) {
              const url = await mediaUrl(payload, slide.bgImageMedia)
              if (url) slide.bgImage = url
            }
          }
        }
        break
    }
  }
}
