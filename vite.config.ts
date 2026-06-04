import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { alphaTab } from '@coderline/alphatab-vite'

// AI_CHANGE:
// Tool: Composer
// Model: Composer
// Timestamp: 2026-06-04T15:20:00-04:00
// Purpose: Bundles alphaTab workers, Bravura font, and SONiVOX soundfont for playback.
// Reason: Required for @coderline/alphatab audio synthesis in Vite dev and production builds.

export default defineConfig({
  plugins: [react(), alphaTab()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
