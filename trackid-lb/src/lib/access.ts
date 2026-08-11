import type { NextRequest } from 'next/server'
import type { Payload, TypedUser } from 'payload'

/** True when the authenticated user has the admin role. */
export function isAdmin(user: unknown): boolean {
  return !!user && typeof user === 'object' && (user as { role?: unknown }).role === 'admin'
}

/**
 * Resolves the authenticated staff account (admin OR editor) on a plain API
 * route — for actions any staff member may take on their own account (e.g.
 * enrolling in 2FA), as opposed to `payments/admin-guard.ts`'s
 * `requireAdminUser`, which additionally requires the admin role.
 */
export async function requireStaffUser(
  payload: Payload,
  req: NextRequest,
): Promise<{ user: TypedUser; email: string } | null> {
  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'users') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { user, email: (user as any).email || 'unknown' }
}
