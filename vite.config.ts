import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// VITE_BASE sirve para publicar bajo una subcarpeta (por ejemplo GitHub Pages: VITE_BASE=/cellula-mvp/ npm run build).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  // MSW (el backend fake) viaja en el bundle: es un prototipo, el peso extra es esperable.
  build: { chunkSizeWarningLimit: 1100 },
})
