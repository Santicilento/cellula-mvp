import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-500.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './styles/tokens.css'
import './styles/components.css'
import './styles/app.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App'
import { startMocks } from './mocks/browser'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 } },
})

async function boot() {
  // El backend fake tiene que estar listo antes del primer fetch.
  await startMocks()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="bottom-right" offset={{ right: 16, bottom: 64 }} mobileOffset={{ right: 16, left: 16, bottom: 64 }} closeButton toastOptions={{ classNames: { toast: 'cl-toast' } }} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void boot()
