import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { mcpHandlers } from './mcp'

export const worker = setupWorker(...handlers, ...mcpHandlers)

/** Arranca el backend fake. Hay que esperar a que esté listo antes de renderizar la app. */
export function startMocks() {
  return worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}
