import { defineConfig } from '@playwright/test';

// AI_CHANGE:
// Tool: Codex
// Model: GPT-5
// Timestamp: 2026-06-25T15:12:15-04:00
// Purpose: Pin e2e runs to FretFlow's Preview port and fail when another app owns it.
// Reason: Playwright previously reused port 5173 even when it served a different local app, hiding real FretFlow behavior.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
