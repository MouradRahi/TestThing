// Resolve alt text for a product/section image row.
// Preference: the per-use alt typed on the row → the alt set on the Media doc
// in the library (populated when the `image` upload relation is fetched at
// depth >= 1) → empty (callers fall back to a title).
type AltImageRow = {
  alt?: string | null
  image?: { alt?: string | null } | string | number | null
}

export function resolveAlt(row?: AltImageRow | null): string {
  if (!row) return ''
  if (row.alt) return row.alt
  if (row.image && typeof row.image === 'object' && row.image?.alt) return row.image.alt
  return ''
}
