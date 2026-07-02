import { headers as nextHeaders } from 'next/headers'
import type { NextResponse } from 'next/server'
import { getPayload } from './payload'

// Payload's default auth cookie name (shared across auth collections; the JWT
// encodes which collection the user belongs to).
export const AUTH_COOKIE = 'payload-token'
const TOKEN_MAX_AGE = 60 * 60 * 24 * 30 // 30 days, matches Customers.auth.tokenExpiration

export type CurrentCustomer = {
  id: string | number
  email: string
  name?: string
  phone?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addresses?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wishlist?: any[]
}

/**
 * The currently logged-in customer (or null), read from the auth cookie.
 * Returns null for staff/admin tokens — this is storefront-only.
 */
export async function getCustomer(): Promise<CurrentCustomer | null> {
  try {
    const payload = await getPayload()
    const { user } = await payload.auth({ headers: await nextHeaders() })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (user && (user as any).collection === 'customers') return user as unknown as CurrentCustomer
    return null
  } catch {
    return null
  }
}

/** Set the Payload auth cookie on a route response (httpOnly — never readable by JS). */
export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TOKEN_MAX_AGE,
  })
}

/** Clear the auth cookie (logout). */
export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
