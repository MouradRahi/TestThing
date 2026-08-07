import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import { isAdmin } from '../lib/access'
import { isStrongPassword, PASSWORD_STRENGTH_MESSAGE } from '../lib/api-guards'

// Staff accounts guard the admin panel — a strong password + a login-lockout
// matter more here than on the storefront's customer accounts (ROADMAP F0 §1.6).
// Login lockout itself needs no code: Payload's `auth: true` default already
// enables it (maxLoginAttempts: 5, lockTime: 10min) — verified working this
// session (a throwaway user got locked out after 5 failed attempts, rejecting
// even the correct password on the 6th). Password strength has no equivalent
// built-in knob (Payload's own default minLength is a permissive 3 chars), so
// that part is enforced explicitly below — same shared policy as Customers.ts.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  hooks: {
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
  ],
}
