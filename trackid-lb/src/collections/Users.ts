import type { CollectionConfig } from 'payload'
import { APIError, ValidationError } from 'payload'
import { isAdmin } from '../lib/access'
import { isStrongPassword, PASSWORD_STRENGTH_MESSAGE, clientIp } from '../lib/api-guards'
import { durableRateLimit } from '../lib/durable-rate-limit'
import { verifyTotpCode } from '../lib/totp'

// Staff accounts guard the admin panel — a strong password + a login-lockout
// matter more here than on the storefront's customer accounts (ROADMAP F0 §1.6).
// Login lockout itself needs no code: Payload's `auth: true` default already
// enables it (maxLoginAttempts: 5, lockTime: 10min) — verified working this
// session (a throwaway user got locked out after 5 failed attempts, rejecting
// even the correct password on the 6th). Password strength has no equivalent
// built-in knob (Payload's own default minLength is a permissive 3 chars), so
// that part is enforced explicitly below — same shared policy as Customers.ts.
//
// Login-security audit follow-up (Session 27, part 6): admin `/login` had no
// IP-based rate limiting beyond Payload's per-account lockout, and neither
// account type had 2FA. Both addressed here for staff:
//   - `beforeOperation` (fires before password verification even runs) rate
//     limits every login attempt by IP — throttles spraying many different
//     emails from one source, which the per-account lockout alone can't.
//   - `beforeLogin` (fires only after a correct password) enforces opt-in
//     TOTP: if `twoFactorEnabled`, the login request's raw JSON body must
//     carry a valid `twoFactorCode` (`req.data` — the REST login handler's
//     parsed body — verified by reading Payload's own login source before
//     building this) or the JWT is never issued. Enrollment/disable live in
//     src/app/api/admin/2fa/* + TwoFactorField.tsx (the field below); the
//     admin-login page itself is fully custom-component-free — the code
//     prompt is a same-origin fetch-interception client component
//     (AdminTwoFactorLoginGate) mounted via admin.components.beforeLogin,
//     deliberately built against the login endpoint's public REST contract
//     (URL + JSON body/error shape) rather than any Payload-internal DOM/CSS,
//     since Payload's built-in `<LoginForm>` isn't itself overridable in
//     this version (confirmed by reading @payloadcms/next's LoginView, which
//     only exposes before/after decorative slots).
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  hooks: {
    beforeOperation: [
      async ({ operation, req }) => {
        if (operation !== 'login') return
        const ip = clientIp(req)
        const ok = await durableRateLimit(req.payload, `admin-login:${ip}`, 10, 10 * 60_000)
        if (!ok) throw new APIError('Too many login attempts. Please wait a few minutes and try again.', 429, undefined, true)
      },
    ],
    beforeValidate: [
      ({ data, req }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const password = (data as any)?.password
        if (typeof password !== 'string') return data // no password being set on this save
        if (!isStrongPassword(password)) {
          throw new ValidationError({
            collection: 'users',
            errors: [{ path: 'password', message: PASSWORD_STRENGTH_MESSAGE }],
            req,
          })
        }
        return data
      },
    ],
    beforeLogin: [
      ({ user, req }) => {
        if (!user?.twoFactorEnabled) return user
        const submittedCode = typeof req.data?.twoFactorCode === 'string' ? req.data.twoFactorCode.trim() : ''
        if (!submittedCode) {
          // Distinct, public (non-500) error codes so the client-side login
          // gate can tell "no code yet" from "wrong code" apart from a
          // genuine bad-password rejection (which throws its own error
          // earlier in loginOperation, before this hook ever runs).
          throw new APIError('2FA_REQUIRED', 401, undefined, true)
        }
        if (!user.twoFactorSecret || !verifyTotpCode(user.twoFactorSecret, submittedCode)) {
          throw new APIError('2FA_INVALID', 401, undefined, true)
        }
        return user
      },
    ],
  },
  // Only admins manage accounts; editors can read the list and edit themselves.
  // (Payload's create-first-user flow bypasses access, so fresh installs still work.)
  access: {
    create: ({ req }) => isAdmin(req.user),
    read: ({ req }) => !!req.user,
    update: ({ req, id }) => isAdmin(req.user) || String(req.user?.id) === String(id),
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: ['admin', 'editor'],
      defaultValue: 'editor',
      required: true,
      // Editors can update their own profile but must not promote themselves
      access: {
        update: ({ req }) => isAdmin(req.user),
      },
    },
    {
      name: 'twoFactorManagement',
      type: 'ui',
      admin: {
        components: { Field: '/components/admin/TwoFactorField#TwoFactorField' },
      },
    },
    {
      // Managed only via src/app/api/admin/2fa/* — readOnly here so nobody
      // flips it on in the admin UI without an actual verified secret behind it.
      name: 'twoFactorEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'twoFactorSecret',
      type: 'text',
      hidden: true, // never exposed to the admin UI or any API read
    },
    {
      name: 'twoFactorPendingSecret',
      type: 'text',
      hidden: true,
    },
    {
      name: 'twoFactorEnabledAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
