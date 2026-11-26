import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    // account tests hash passwords on purpose (slow) and run in parallel, so the default 5s is too tight
    testTimeout: 30_000,
    // every account test file runs its own in-memory Postgres; too many at once can run a machine out of memory
    pool: 'forks',
    poolOptions: { forks: { maxForks: 4, minForks: 1 } },
    env: { SIGNUP_MODE: 'open', APP_LAUNCHED: '1' },
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
