// Triggers the seed API route. The dev server (or a running instance) must be up.
// Usage: npm run seed
// Env (all optional):
//   SEED_URL              base URL of the running app (default http://localhost:3000)
//   NEXT_PUBLIC_SITE_URL  used as the base URL if SEED_URL is unset
//   SEED_SECRET           required only when seeding a production deployment

const base = (process.env.SEED_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
const url = `${base}/api/seed`

console.log(`Seeding via ${url} ...`)

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.SEED_SECRET ? { 'x-seed-secret': process.env.SEED_SECRET } : {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  console.log(JSON.stringify(body, null, 2))
  if (!res.ok) {
    console.error(`\nSeed request failed (HTTP ${res.status}).`)
    process.exit(1)
  }
  console.log('\nDone. Open the storefront to see the demo catalog.')
} catch (err) {
  console.error(`\nCould not reach ${url}.`)
  console.error('Is the app running? Start it with `npm run dev` in another terminal, then re-run `npm run seed`.')
  console.error(String(err?.message || err))
  process.exit(1)
}
