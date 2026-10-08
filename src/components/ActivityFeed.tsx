import { LogIn, MousePointer2, Sparkles, Upload, UserPlus, UserX, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useActivity, useApps } from '../api/queries'
import type { ActivityEvent, ActivityFilters, EventType } from '../api/types'
import { dayLabel, clock, plural } from '../lib/format'
import { ROLE_LABEL } from '../lib/roles'
import { Badge } from './ui/Badge'
import { ErrorState } from './ui/ErrorState'
import { Segmented } from './ui/Segmented'
import { Skeleton } from './ui/Skeleton'

const ICONS: Record<EventType, LucideIcon> = {
  publishing: Upload,
  published: Upload,
  entry: LogIn,
  grant: UserPlus,
  role_change: UserPlus,
  revoke: UserX,
}

function Sentence({ e }: { e: ActivityEvent }): ReactNode {
  switch (e.type) {
    case 'entry':
      return <><b>{e.person}</b> entró a la app</>
    case 'grant':
      return <>Se le dio acceso de <b>{e.role ? ROLE_LABEL[e.role] : ''}</b> a <b>{e.person}</b></>
    case 'role_change':
      return <>El rol de <b>{e.person}</b> pasó de {e.fromRole ? ROLE_LABEL[e.fromRole] : ''} a <b>{e.role ? ROLE_LABEL[e.role] : ''}</b></>
    case 'revoke':
      return <>Se quitó el acceso de <b>{e.person}</b></>
    case 'publishing':
      return <>Se está publicando una nueva versión</>
    case 'published':
      return <>{e.actor === 'agent' ? 'Se publicó' : 'Se subió'} una nueva versión</>
  }
}

function Origin({ e }: { e: ActivityEvent }) {
  if (e.actor === 'agent') return <Badge tone="agent" icon={Sparkles}>Tu agente · {e.agentName ?? 'Claude Code'}</Badge>
  if (e.actor === 'panel') return <Badge icon={MousePointer2}>Vos · desde el panel</Badge>
  return <Badge tone="outline">Ingresó con {e.provider === 'microsoft' ? 'Microsoft' : 'Google'}</Badge>
}

/** Leyenda del encabezado: qué significa cada insignia de origen. */
export function ActivityLegend() {
  return (
    <div className="legend">
      <span><Badge tone="agent">Tu agente</Badge> lo hizo por el conector</span>
      <span><Badge>Vos</Badge> lo hiciste desde el panel</span>
    </div>
  )
}

interface ActivityFeedProps {
  /** Si se pasa, la lista es de una sola app y no se muestra el filtro "App". */
  fixedApp?: string
}

/** Filtros y lista de movimientos agrupados por día. Sirve para la actividad global y la de una app. */
export function ActivityFeed({ fixedApp }: ActivityFeedProps) {
  const apps = useApps()
  const [actor, setActor] = useState<NonNullable<ActivityFilters['actor']>>('all')
  const [app, setApp] = useState('')
  const [type, setType] = useState<NonNullable<ActivityFilters['type']>>('all')
  const [range, setRange] = useState<NonNullable<ActivityFilters['range']>>('7d')

  const filters: ActivityFilters = { actor, type, range, app: fixedApp ?? (app || undefined) }
  const events = useActivity(filters)

  const groups: { label: string; items: ActivityEvent[] }[] = []
  for (const e of events.data ?? []) {
    const label = dayLabel(new Date(e.at))
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(e)
    else groups.push({ label, items: [e] })
  }

  return (
    <>
      <section className="cl-card filters" aria-label="Filtros">
        <div className="filters__field">
          <span className="filters__label" id="lbl-actor">Quién lo hizo</span>
          <Segmented
            compact
            label="Quién lo hizo"
            value={actor}
            onChange={setActor}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'agent', label: 'Tu agente' },
              { value: 'panel', label: 'Vos, desde el panel' },
            ]}
          />
        </div>
        {!fixedApp && (
          <div className="filters__field filters__field--grow">
            <label className="filters__label" htmlFor="f-app">App</label>
            <select id="f-app" className="cl-select" value={app} onChange={(e) => setApp(e.target.value)}>
              <option value="">Todas las apps</option>
              {apps.data?.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div className="filters__field filters__field--grow">
          <label className="filters__label" htmlFor="f-type">Qué pasó</label>
          <select id="f-type" className="cl-select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="all">Todo</option>
            <option value="entry">Ingresos</option>
            <option value="publish">Publicaciones</option>
            <option value="permissions">Cambios de permisos</option>
          </select>
        </div>
        <div className="filters__field filters__field--grow">
          <label className="filters__label" htmlFor="f-range">Cuándo</label>
          <select id="f-range" className="cl-select" value={range} onChange={(e) => setRange(e.target.value as typeof range)}>
            <option value="7d">Últimos 7 días</option>
            <option value="today">Hoy</option>
            <option value="30d">Últimos 30 días</option>
          </select>
        </div>
      </section>

      {events.isError ? (
        <ErrorState onRetry={() => events.refetch()} />
      ) : !events.data ? (
        <Skeleton style={{ height: 420 }} />
      ) : (
        <section className="cl-card feed" aria-label="Movimientos" aria-busy={events.isFetching}>
          {groups.length === 0 ? (
            <p className="feed__empty">No hay movimientos con estos filtros.</p>
          ) : (
            groups.map((g) => (
              <div key={g.label}>
                <h2 className="feed__day">{g.label}</h2>
                <ul className="feed__list">
                  {g.items.map((e) => {
                    const Icon = ICONS[e.type]
                    return (
                      <li key={e.id} className="feed__row">
                        <span className="cl-ico"><Icon className="cl-i" aria-hidden="true" /></span>
                        <span className="feed__what"><Sentence e={e} /></span>
                        <span className="feed__app">{e.appName}</span>
                        <span className="feed__origin"><Origin e={e} /></span>
                        <time className="feed__time" dateTime={e.at}>{clock(new Date(e.at))}</time>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
          {groups.length > 0 && (
            <p className="feed__foot">
              Mostrando {plural(events.data.length, 'el último movimiento', `los últimos ${events.data.length} movimientos`)}
            </p>
          )}
        </section>
      )}
    </>
  )
}
