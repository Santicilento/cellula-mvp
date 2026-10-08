import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/source-serif-4/latin-400.css'
import '@fontsource/source-serif-4/latin-500.css'
import '@fontsource/source-serif-4/latin-600.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './styles/claude.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { startMocks } from '../mocks/browser'
import ClaudeApp from './ClaudeApp'

async function boot() {
  // El servidor MCP de Cellula (falso) tiene que estar listo antes del primer pedido.
  await startMocks()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ClaudeApp />
      <Toaster position="top-center" offset={16} closeButton />
    </StrictMode>,
  )
}

void boot()
