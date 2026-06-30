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
