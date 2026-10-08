import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  back?: { to: string; label: string }
  actions?: ReactNode
  /** Insignias al lado del título (Activa, Privada). */
  badges?: ReactNode
  /** Debajo del título (la URL de la app). */
  meta?: ReactNode
}

/** Encabezado de pantalla: enlace de vuelta, título, bajada y acciones. */
export function PageHeader({ title, subtitle, back, actions, badges, meta }: PageHeaderProps) {
  return (
    <header className="page-head">
      {back && (
        <Link to={back.to} className="back-link">
          <ChevronLeft className="cl-i" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="page-head__row">
        <div className="page-head__text">
          <div className="page-head__titleline">
            <h1 className="page-title">{title}</h1>
            {badges}
          </div>
          {meta}
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        {actions && <div className="page-head__actions">{actions}</div>}
      </div>
    </header>
  )
}
