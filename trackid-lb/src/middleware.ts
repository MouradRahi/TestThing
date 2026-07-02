import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // Run on storefront paths only. Exclude the Payload admin (/admin), all API
  // routes (/api), Next internals, and any file with an extension.
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
}
