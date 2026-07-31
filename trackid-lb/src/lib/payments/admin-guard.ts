import type { NextRequest } from 'next/server'
import type { Payload, TypedUser } from 'payload'
import { isAdmin } from '../access'

/**
 * Resolves the authenticated staff admin on a plain API route (not a Payload
 * hook) — used by the F2 payment-ops routes (mark-paid, refund, CSV export),
 * which are staff actions, never customer- or public-facing.
 */
export async function requireAdminUser(
  payload: Payload,
  req: NextRequest,
): Promise<{ user: TypedUser; email: string } | null> {
  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'users' || !isAdmin(user)) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { user, email: (user as any).email || 'unknown' }
}
