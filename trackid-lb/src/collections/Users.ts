import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import { isAdmin } from '../lib/access'

// Staff accounts guard the admin panel — a strong password + a login-lockout
// matter more here than on the storefront's customer accounts (ROADMAP F0 §1.6).
// Login lockout itself needs no code: Payload's `auth: true` default already
// enables it (maxLoginAttempts: 5, lockTime: 10min) — verified working this
// session (a throwaway user got locked out after 5 failed attempts, rejecting
// even the correct password on the 6th). Password strength has no equivalent
// built-in knob (Payload's own default minLength is a permissive 3 chars), so
// that part is enforced explicitly below.
const MIN_PASSWORD_LENGTH = 12

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
        const strong = password.length >= MIN_PASSWORD_LENGTH && /[a-zA-Z]/.test(password) && /\d/.test(password)
        if (!strong) {
          throw new ValidationError({
            collection: 'users',
            errors: [
              {
                path: 'password',
                message: `Admin passwords must be at least ${MIN_PASSWORD_LENGTH} characters and include both a letter and a number.`,
              },
            ],
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
