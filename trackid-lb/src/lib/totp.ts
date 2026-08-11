import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'

// Thin wrapper around `otpauth`/`qrcode` for staff opt-in 2FA (ROADMAP F0
// §1.6 follow-up). Server-only — never imported by any client component, so
// neither dependency ever reaches a browser bundle (enrollment renders a
// pre-built QR data URI; login verification happens inside the `beforeLogin`
// collection hook).

const ISSUER = process.env.NEXT_PUBLIC_STORE_NAME || 'trackID.lb'
// A generous ±1 step window (±30s) tolerates minor clock drift between the
// server and the admin's phone without meaningfully widening the guessable
// window (a 6-digit code is still only valid for ~90s total either way).
const WINDOW = 1

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32
}

export function buildOtpauthUri(secretBase32: string, accountEmail: string): string {
  const totp = new TOTP({
    issuer: ISSUER,
    label: accountEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  })
  return totp.toString()
}

export async function generateQrCodeDataUri(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 })
}

/** True when `code` is a valid current (±1 step) TOTP code for `secretBase32`. */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false
  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  })
  const delta = totp.validate({ token: code, window: WINDOW })
  return delta !== null
}
