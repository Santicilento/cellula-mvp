import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'

// /claude (sin barra final) tiene que llevar a /claude/, que es la segunda página de la app.
function claudeSlash(base: string): Plugin {
  const redirect = (req: { url?: string }, res: { statusCode: number; setHeader(k: string, v: string): void; end(): void }, next: () => void) => {
    if (req.url === `${base}claude` || req.url?.startsWith(`${base}claude?`)) {
      res.statusCode = 302
      res.setHeader('Location', `${base}claude/`)
      res.end()
      return
    }
    next()
  }
  return {
    name: 'claude-trailing-slash',
    configureServer: (server) => void server.middlewares.use(redirect),
    configurePreviewServer: (server) => void server.middlewares.use(redirect),
  }
}

// https://vite.dev/config/
// VITE_BASE sirve para publicar bajo una subcarpeta (por ejemplo GitHub Pages: VITE_BASE=/cellula-mvp/ npm run build).
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react(), claudeSlash(base)],
  // MSW (el backend fake) viaja en el bundle: es un prototipo, el peso extra es esperable.
  // Dos páginas en el mismo origen: Cellula (/) y el clon de Claude (/claude/). Comparten el backend fake y su base.
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      input: { cellula: resolve(import.meta.dirname, 'index.html'), claude: resolve(import.meta.dirname, 'claude/index.html') },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
