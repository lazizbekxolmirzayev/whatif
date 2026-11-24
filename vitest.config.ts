import { defineConfig } from 'vitest/config'

// Vitest runs only the Grand Strategy test suites (integrated from PAXAILOVASI).
// WHATIF's own tests are plain Node scripts (see the "test" script in package.json).
export default defineConfig({
  test: { environment: 'node', include: ['src/strategy/**/*.test.ts'] },
})
