import { defineConfig, devices } from '@playwright/test'

// Smoke suite only (browse → cart → COD checkout → order persisted). Runs
// against a production build+start (not `next dev`) — pre-deploy validation
// should exercise what actually ships, not dev-mode caching/behavior (dev's
// revalidate window is deliberately different, see site-settings.ts).
// Talks to whatever DATABASE_URI is in the environment — the disposable dev
// Supabase project locally, so test orders landing there is expected and
// harmless (see MIGRATIONS.md's two-DB setup). Never point this at prod.
const PORT = 3100

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
