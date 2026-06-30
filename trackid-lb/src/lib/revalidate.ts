import { revalidatePath, revalidateTag } from 'next/cache'

// Payload hooks can fire outside a Next request scope (CLI scripts, seeds) —
// revalidation is best-effort there, never fatal.

export function safeRevalidatePath(path: string, type?: 'page' | 'layout'): void {
  try {
    revalidatePath(path, type)
  } catch (err) {
    console.warn(`[revalidate] Could not revalidate path ${path}:`, err)
  }
}

export function safeRevalidateTag(tag: string): void {
  try {
    revalidateTag(tag)
  } catch (err) {
    console.warn(`[revalidate] Could not revalidate tag ${tag}:`, err)
  }
}
