import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative paths so the site works from https://<user>.github.io/<repo>/
  base: './',
  // Firebase is one ~600 kB chunk, loaded only when sign-in is set up.
  build: { chunkSizeWarningLimit: 700 },
})
