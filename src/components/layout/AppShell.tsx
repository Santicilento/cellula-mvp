import { Outlet } from 'react-router-dom'
import { DemoPanel } from '../DemoPanel'
import { NotificationsBridge } from '../NotificationsBridge'
import { Sidebar } from './Sidebar'

/** Pantallas con sesión: menú lateral a la izquierda y contenido sobre `canvas`. */
export function AppShell() {
  return (
    <div className="shell">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <Sidebar />
      <main id="contenido" className="shell__main" tabIndex={-1}>
        <Outlet />
      </main>
      <DemoPanel />
      <NotificationsBridge />
    </div>
  )
}
