import { revalidatePath, revalidateTag } from 'next/cache'
import { routing } from '../i18n/routing'

// Payload hooks can fire outside a Next request scope (CLI scripts, seeds) —
// revalidation is best-effort there, never fatal.

function tryRevalidatePath(path: string, type?: 'page' | 'layout'): void {
  try {
    revalidatePath(path, type)
  } catch (err) {
    console.warn(`[revalidate] Could not revalidate path ${path}:`, err)
  }
}

// Storefront pages live under app/[locale]/, and middleware rewrites the
// unprefixed English URL (/product/x) to /en/product/x internally — so the ISR
// cache entry is keyed by the *locale-prefixed* path, not the public one. Every
// hook passes the public path, so fan it out to each locale's cached copy (plus
// the path as given). Without this, edits only reach the storefront when the
// page's revalidate timer expires — which is why that timer used to be short.
export function safeRevalidatePath(path: string, type?: 'page' | 'layout'): void {
  tryRevalidatePath(path, type)
  // A layout-level bust of '/' already covers every route; nothing to fan out.
  if (type === 'layout') return
  const first = path.split('/')[1]
  if ((routing.locales as readonly string[]).includes(first)) return
  for (const locale of routing.locales) {
    tryRevalidatePath(path === '/' ? `/${locale}` : `/${locale}${path}`, type)
  }
}

export function safeRevalidateTag(tag: string): void {
  try {
    revalidateTag(tag)
  } catch (err) {
    console.warn(`[revalidate] Could not revalidate tag ${tag}:`, err)
  }
}
