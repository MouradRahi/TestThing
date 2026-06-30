import { Nav, type NavLink } from './Nav'
import { getSiteSettings, getNavigation } from '@/lib/site-settings'

const DEFAULT_LINKS: NavLink[] = [
  { label: 'Shop', href: '/shop' },
  { label: 'Custom', href: '/custom-request' },
]

export async function NavWrapper() {
  const [settings, nav] = await Promise.all([getSiteSettings(), getNavigation()])

  const storeName = (settings.storeName as string) || 'trackID.lb'
  const logoUrl = (settings.logoUrl as string) || undefined
  const headerLinks = Array.isArray(nav.headerLinks) && nav.headerLinks.length > 0
    ? (nav.headerLinks as NavLink[])
    : DEFAULT_LINKS

  return <Nav storeName={storeName} links={headerLinks} logoUrl={logoUrl} />
}
