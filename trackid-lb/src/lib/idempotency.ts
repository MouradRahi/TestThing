import type { Payload } from 'payload'

// Matches the shape Payload's JSON field type accepts — every response body
// this app sends via NextResponse.json() is a plain JSON-serializable object.
type JsonValue = string | number | boolean | { [k: string]: unknown } | unknown[] | null

/**
 * Idempotency-key support for POST /api/orders (ROADMAP F0 §1.3) — a client
 * sends the same key on a retried request (network timeout, double-tap
 * before the button disables) and gets back the *original* response instead
 * of creating a second order.
 *
 * Uses the Local API (a plain check-then-insert), not an atomic SQL upsert
 * like durable-rate-limit.ts — the realistic race here is a browser retrying
 * a timed-out request a few seconds later, not two truly simultaneous
 * requests racing on the same key. The `key` column's DB-level unique
 * constraint is the actual backstop: a genuine simultaneous double-submit
 * fails the second INSERT rather than silently overwriting, it just doesn't
 * get handed the first request's cached response in that narrow window.
 */
export async function getIdempotentResponse(
  payload: Payload,
  key: string,
): Promise<{ status: number; body: JsonValue } | null> {
  const { docs } = await payload.find({
    collection: 'idempotency-keys',
    where: { key: { equals: key } },
    limit: 1,
  })
  const doc = docs[0]
  if (!doc) return null
  return { status: doc.responseStatus, body: doc.responseBody }
}

export async function saveIdempotentResponse(
  payload: Payload,
  key: string,
  status: number,
  body: JsonValue,
): Promise<void> {
  try {
    await payload.create({
      collection: 'idempotency-keys',
      data: { key, responseStatus: status, responseBody: body },
    })
  } catch (err) {
    // Most likely a duplicate key (concurrent request already saved one) —
    // never fail the order response over this.
    console.error('[idempotency] Failed to save response:', err)
  }
}
