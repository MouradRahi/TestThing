import { createHmac, timingSafeEqual } from 'crypto'

// Signs a one-click unsubscribe link (ROADMAP Part 6.5) so a customer can
// opt out of abandoned-cart recovery emails without logging in, while a
// stranger can't opt someone else out by guessing their customer id — same
// "the link itself is the credential" trust model as password-reset tokens,
// just HMAC-signed instead of DB-stored/expiring (an unsubscribe link should
// keep working indefinitely, unlike a reset link).
function secret(): string {
  return process.env.PAYLOAD_SECRET || 'dev-only-secret'
}

export function signCartRecoveryToken(customerId: string | number): string {
  return createHmac('sha256', secret()).update(String(customerId)).digest('hex').slice(0, 32)
}

export function verifyCartRecoveryToken(customerId: string | number, token: string): boolean {
  const expected = signCartRecoveryToken(customerId)
  const a = Buffer.from(expected)
  const b = Buffer.from(String(token || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}
