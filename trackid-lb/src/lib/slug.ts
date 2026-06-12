import type { FieldHook } from 'payload'

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * beforeValidate hook for slug fields — normalizes whatever was typed and
 * falls back to the document's title/name when the slug is left empty.
 */
export const formatSlug: FieldHook = ({ value, data }) => {
  if (typeof value === 'string' && value.trim()) return slugify(value)
  const fallback = data?.title ?? data?.name
  if (typeof fallback === 'string' && fallback.trim()) return slugify(fallback)
  return value
}
