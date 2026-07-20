import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Unit tests only (src/lib/**/*.test.ts) — pure functions, no DB, no server.
// Mirrors the tsconfig `@/*` path alias so test files can import the same
// way app code does.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
