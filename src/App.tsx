import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import Actividad from './pages/Actividad'
import AppActividad from './pages/app/AppActividad'
import AppLayout from './pages/app/AppLayout'
import Accesos from './pages/app/Accesos'
import Config from './pages/app/Config'
import Datos from './pages/app/Datos'
import Agente from './pages/Agente'
import ComoFunciona from './pages/ComoFunciona'
import AppFrame from './pages/guest/AppFrame'
import Gate from './pages/guest/Gate'
import SinAcceso from './pages/guest/SinAcceso'
import MisApps from './pages/MisApps'
import NotFound from './pages/NotFound'
import Plan from './pages/Plan'
import { PublicarForm, PublicarProgreso } from './pages/Publicar'

/** Al cambiar de pantalla vuelve arriba. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/apps" replace />} />
          <Route path="apps" element={<MisApps />} />
          <Route path="apps/publicar" element={<PublicarForm />} />
          <Route path="apps/publicar/:slug" element={<PublicarProgreso />} />
          <Route path="apps/:slug" element={<AppLayout />}>
            <Route index element={<Navigate to="accesos" replace />} />
            <Route path="accesos" element={<Accesos />} />
            <Route path="actividad" element={<AppActividad />} />
            <Route path="datos" element={<Datos />} />
            <Route path="config" element={<Config />} />
          </Route>
          <Route path="agente" element={<Agente />} />
          <Route path="actividad" element={<Actividad />} />
          <Route path="plan" element={<Plan />} />
          <Route path="como-funciona" element={<ComoFunciona />} />
        </Route>
        <Route path="i/:slug" element={<Gate />} />
        <Route path="i/:slug/app" element={<AppFrame />} />
        <Route path="i/:slug/sin-acceso" element={<SinAcceso />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  )
}
