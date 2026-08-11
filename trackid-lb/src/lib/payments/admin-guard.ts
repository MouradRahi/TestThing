import type { NextRequest } from 'next/server'
import type { Payload, TypedUser } from 'payload'
import { isAdmin, requireStaffUser } from '../access'

/**
 * Resolves the authenticated staff admin on a plain API route (not a Payload
 * hook) — used by the F2 payment-ops routes (mark-paid, refund, CSV export),
 * which are staff actions, never customer- or public-facing. Same shape as
 * `requireStaffUser`, additionally requiring the admin role.
 */
export async function requireAdminUser(
  payload: Payload,
  req: NextRequest,
): Promise<{ user: TypedUser; email: string } | null> {
  const staff = await requireStaffUser(payload, req)
  if (!staff || !isAdmin(staff.user)) return null
  return staff
}
