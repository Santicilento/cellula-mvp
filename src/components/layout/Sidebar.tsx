import { Activity, ChartColumn, LayoutGrid, Plug } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useMe, useTrial } from '../../api/queries'
import { plural } from '../../lib/format'
import { Avatar } from '../ui/Avatar'

const ITEMS = [
  { to: '/apps', label: 'Mis apps', icon: LayoutGrid },
  { to: '/agente', label: 'Conectar mi agente', icon: Plug },
  { to: '/actividad', label: 'Actividad', icon: Activity },
  { to: '/plan', label: 'Uso y plan', icon: ChartColumn },
]

/** Menú lateral: logo, cuatro ítems, caja de prueba gratis y la persona al pie. */
export function Sidebar() {
  const { data: me } = useMe()
  const { data: trial } = useTrial()

  const used = trial && trial.status === 'active' ? ((trial.daysTotal - trial.daysLeft) / trial.daysTotal) * 100 : 0

  return (
    <nav className="cl-nav shell__nav" aria-label="Principal">
      <NavLink to="/apps" aria-label="Cellula, ir a Mis apps">
        <img className="cl-nav__logo" src={`${import.meta.env.BASE_URL}brand/cellula-logo.svg`} alt="Cellula" />
      </NavLink>
      <div className="shell__links">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `cl-nav__item${isActive ? ' cl-nav__item--active' : ''}`}>
            <Icon className="cl-i" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </div>
      <div className="cl-nav__spacer" />
      <div className="cl-trial" aria-live="polite">
        <strong>Prueba gratis</strong>
        {!trial ? (
          <>Un momento…</>
        ) : trial.status === 'locked' ? (
          <>{trial.daysTotal} días, <b>sin activar</b></>
        ) : (
          <>
            Te {plural(trial.daysLeft, 'queda', 'quedan')} <b>{trial.daysLeft} {plural(trial.daysLeft, 'día', 'días')}</b> de {trial.daysTotal}
          </>
        )}
        <div className="cl-bar" role="progressbar" aria-label="Días de prueba usados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used)}>
          <span style={{ width: `${used}%` }} />
        </div>
      </div>
      {me && (
        <div className="cl-user">
          <Avatar name={me.name} />
          <div className="cl-user__text">
            <span className="cl-user__name">{me.name}</span>
            <span className="cl-user__mail">{me.email}</span>
          </div>
        </div>
      )}
    </nav>
  )
}
