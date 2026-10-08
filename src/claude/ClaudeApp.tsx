import clsx from 'clsx'
import { PanelLeftOpen } from 'lucide-react'
import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import ChatPage from './pages/ChatPage'
import Home from './pages/Home'
import OAuthCallback from './pages/OAuthCallback'
import SettingsConnectors from './pages/SettingsConnectors'
import { verifyConnectors } from './store/controller'
import { useSidebar } from './store/sidebar'

function Frame() {
  const { open, setOpen } = useSidebar()

  useEffect(() => {
    document.title = 'Claude (demo)'
    // Al volver a esta pestaña, se vuelve a comprobar que los conectores sigan autorizados.
    const onFocus = () => void verifyConnectors()
    void verifyConnectors()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <div className={clsx('cd-shell', !open && 'cd-shell--closed')}>
      <Sidebar />
      <div className="cd-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <main className="cd-main">
        {!open && (
          <button type="button" className="cd-iconbtn cd-open-sidebar" aria-label="Abrir barra lateral" onClick={() => setOpen(true)}>
            <PanelLeftOpen className="cd-i" aria-hidden="true" />
          </button>
        )}
        <Routes>
          <Route index element={<Home />} />
          <Route path="chat/:id" element={<ChatPage />} />
          <Route path="configuracion" element={<Navigate to="/configuracion/conectores" replace />} />
          <Route path="configuracion/conectores" element={<SettingsConnectors />} />
          <Route path="oauth/callback" element={<OAuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function ClaudeApp() {
  return (
    <HashRouter>
      <Frame />
    </HashRouter>
  )
}
