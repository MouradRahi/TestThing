// Vulnerability-scanner probes (WordPress/PHP/dotfile paths). Without an early
// answer each one falls through to a dynamic route ([locale] or [slug]) and
// costs a full server render + DB lookup just to produce a 404 — middleware.ts
// answers them before any page code runs.
const SCANNER_PATH =
  /\.(?:php\d?|aspx?|jsp|cgi|env|git|sql|bak|ini|ya?ml|log)(?:\/|$)|(?:^|\/)(?:wp-|wordpress(?:\/|$)|phpmyadmin|xmlrpc|cgi-bin|\.git(?:\/|$)|\.env|vendor\/phpunit)/i

export function isScannerPath(pathname: string): boolean {
  return SCANNER_PATH.test(pathname)
}
