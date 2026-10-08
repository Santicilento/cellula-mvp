import clsx from 'clsx'
import { Clock, Link as LinkIcon, Lock, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AppSummary } from '../api/types'
import { ago, plural } from '../lib/format'
import { OriginBadge, StatusBadge } from './StatusBadge'

/** Una app en la grilla de Mis apps. */
export function AppCard({ app }: { app: AppSummary }) {
  const published =
    app.status === 'publishing' ? 'Publicando ahora…' : app.publishedAt ? `Publicada ${ago(app.publishedAt)}` : 'Todavía sin publicar'

  return (
    <article className={clsx('cl-card app-card', app.status === 'publishing' && 'cl-card--live')}>
      <StatusBadge status={app.status} />
      <h2 className="cl-card__title">
        <Link to={`/apps/${app.slug}`} className="app-card__link">{app.name}</Link>
      </h2>
      <span className="cl-card__url">
        <LinkIcon className="cl-i" aria-hidden="true" style={{ width: 15, height: 15 }} />
        {app.url}
      </span>
      <ul className="cl-card__facts">
        <li><Lock className="cl-i" aria-hidden="true" />Privada</li>
        <li><Users className="cl-i" aria-hidden="true" />{app.peopleCount} {plural(app.peopleCount, 'persona', 'personas')} con acceso</li>
        <li><Clock className="cl-i" aria-hidden="true" />{published}</li>
      </ul>
      <div className="cl-card__foot">
        <OriginBadge origin={app.origin} />
        {app.status === 'error' && (
          <Link to={`/apps/publicar?app=${app.slug}`} className="cl-link-danger app-card__above">Volver a publicar</Link>
        )}
      </div>
    </article>
  )
}

/** Tarjeta punteada para publicar otra app. */
export function AddCard({ to, disabled }: { to: string; disabled?: boolean }) {
  const body = (
    <>
      <span className="cl-plus"><Plus className="cl-i cl-i--lg" aria-hidden="true" /></span>
      <span className="add-card__title">Publicar una app</span>
      <span className="add-card__text">Subí una carpeta o pedile a tu agente que la publique.</span>
    </>
  )
  if (disabled) return <div className="cl-card cl-card--add add-card" aria-disabled="true">{body}</div>
  return <Link to={to} className="cl-card cl-card--add add-card">{body}</Link>
}
