import { defineConfig } from 'vitest/config'

// Unit tests for the practice engine, MIDI layer and generator.
// Kept separate from vite.config.ts so tests don't run the router plugin.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
