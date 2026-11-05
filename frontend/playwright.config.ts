import { defineConfig, devices } from '@playwright/test'

// Browser smoke tests for the practice section. Run with `npm run test:e2e --workspace frontend`
// (first time: `npx playwright install chromium`). They use the computer keyboard as input, so no MIDI device is needed.
const PORT = 4317

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}/MusicHelper/`,
    ...devices['Desktop Chrome'],
    viewport: { width: 1400, height: 1000 },
    // Set PLAYWRIGHT_CHROMIUM_PATH to use an already installed Chromium.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/MusicHelper/`,
    reuseExistingServer: !process.env.CI,
  },
})
