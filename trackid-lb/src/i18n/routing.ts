import { defineRouting } from 'next-intl/routing'

// English is the default and stays unprefixed (/shop); other locales are prefixed (/ar/shop).
// To add a locale later (e.g. Japanese): add 'ja' here, create messages/ja.json, and add
// 'ja' to the Payload `localization.locales` in payload.config.ts — nothing else changes.
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})

export type Locale = (typeof routing.locales)[number]

// Locales that read right-to-left. Adding an LTR locale (ja, fr, …) needs no change here.
export const RTL_LOCALES: readonly string[] = ['ar']

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale)
}
