/** True when the authenticated user has the admin role. */
export function isAdmin(user: unknown): boolean {
  return !!user && typeof user === 'object' && (user as { role?: unknown }).role === 'admin'
}
