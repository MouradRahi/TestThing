import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Locale-aware navigation helpers — use these instead of next/link + next/navigation
// in the storefront so links keep the current locale (and the /ar prefix) automatically.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
