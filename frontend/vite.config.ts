import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  base: '/MusicHelper/',
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  build: {
    // OpenSheetMusicDisplay (~1.5 MB) is one chunk, loaded only by the player and sight-reading routes.
    chunkSizeWarningLimit: 1600,
  },
})
