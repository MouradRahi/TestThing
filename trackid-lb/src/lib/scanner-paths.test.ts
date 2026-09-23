import { describe, expect, it } from 'vitest'
import { isScannerPath } from './scanner-paths'

describe('isScannerPath', () => {
  it.each([
    '/wp-login.php',
    '/wp-admin',
    '/wp-admin/setup-config.php',
    '/ar/wp-content/plugins/x',
    '/wordpress/',
    '/xmlrpc.php',
    '/phpmyadmin',
    '/.env',
    '/.env.production',
    '/.git/config',
    '/cgi-bin/luci',
    '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
    '/config.yml',
    '/backup.sql',
    '/index.php5',
  ])('flags %s', (path) => {
    expect(isScannerPath(path)).toBe(true)
  })

  it.each([
    '/',
    '/ar',
    '/shop',
    '/product/wolf-hoodie',
    '/artist/fairuz',
    '/p/about',
    '/about',
    '/blog/whats-new',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/product/php-tee', // "php" inside a slug is not an extension
    '/product/swp-shirt', // "wp-" only counts at a segment start
    '/environment',
  ])('allows %s', (path) => {
    expect(isScannerPath(path)).toBe(false)
  })
})
