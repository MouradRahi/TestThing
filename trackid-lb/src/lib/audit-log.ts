import type { Payload, PayloadRequest } from 'payload'

/**
 * Shallow diff of top-level keys — good enough for "which fields changed" on
 * a Payload doc, not a deep/rich-text-aware diff (arrays, relationships, and
 * Lexical content just show up as "changed" or not, no drill-down). That's
 * the right level of detail for an audit trail: enough to know WHAT was
 * touched and go look at the current value in admin, not a full history.
 */
export function changedTopLevelFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  excludeKeys: string[] = ['updatedAt', 'createdAt', 'id'],
): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changed: string[] = []
  for (const key of keys) {
    if (excludeKeys.includes(key)) continue
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) changed.push(key)
  }
  return changed
}

// Matches the shape Payload's JSON field type accepts.
type JsonValue = string | number | boolean | { [k: string]: unknown } | unknown[] | null

type LogParams = {
  collectionSlug: string
  documentId?: string
  action: 'create' | 'update' | 'delete'
  req: PayloadRequest
  summary: string
  changedFields?: JsonValue
}

/**
 * Writes one audit-log row. Silently skips (not an error) when there's no
 * authenticated staff user on the request — every caller here is inside an
 * afterChange hook that could in principle fire from a system/API path with
 * no admin session, and this must never fail the underlying save over a
 * logging concern (overrideAccess: true — AuditLog blocks normal creates).
 */
export async function logAuditEvent(payload: Payload, params: LogParams): Promise<void> {
  const user = params.req.user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'users') return
  try {
    await payload.create({
      collection: 'audit-log',
      data: {
        collectionSlug: params.collectionSlug,
        documentId: params.documentId,
        action: params.action,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userEmail: (user as any).email || 'unknown',
        summary: params.summary,
        changedFields: params.changedFields ?? null,
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[audit-log] Failed to write entry:', err)
  }
}
