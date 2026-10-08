import { NavLink } from 'react-router-dom'

/** Secciones de una app: Accesos, Actividad, Datos y Configuración. */
export function AppTabs({ slug, accessCount }: { slug: string; accessCount?: number }) {
  const tabs = [
    { to: `/apps/${slug}/accesos`, label: 'Accesos', count: accessCount },
    { to: `/apps/${slug}/actividad`, label: 'Actividad' },
    { to: `/apps/${slug}/datos`, label: 'Datos' },
    { to: `/apps/${slug}/config`, label: 'Configuración' },
  ]
  return (
    <nav className="cl-tabs" aria-label="Secciones de la app">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `cl-tab${isActive ? ' cl-tab--active' : ''}`}>
          {t.label}
          {t.count !== undefined && <span className="cl-tab__count">{t.count}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
