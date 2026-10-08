import { ExternalLink, Lock } from 'lucide-react'
import { Outlet, useParams } from 'react-router-dom'
import { useAccess, useApp } from '../../api/queries'
import { AppTabs } from '../../components/AppTabs'
import { PageHeader } from '../../components/layout/PageHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { Badge } from '../../components/ui/Badge'
import { ButtonAnchor, ButtonLink } from '../../components/ui/Button'
import { CopyButton } from '../../components/ui/CopyButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { usePageTitle } from '../../lib/usePageTitle'

/** Detalle de una app: título con estado, acciones y pestañas (Accesos, Actividad, Datos, Configuración). */
export default function AppLayout() {
  const { slug } = useParams()
  const app = useApp(slug)
  const access = useAccess(slug ?? '')
  usePageTitle(app.data?.name)

  if (app.isError) {
    return (
      <div className="page">
        <PageHeader back={{ to: '/apps', label: 'Mis apps' }} title="No encontramos esa app" subtitle="Puede que la hayan eliminado o que el link esté incompleto." />
        <div><ButtonLink to="/apps" variant="primary">Volver a Mis apps</ButtonLink></div>
      </div>
    )
  }

  if (!app.data) {
    return (
      <div className="page">
        <Skeleton style={{ height: 74, maxWidth: 560 }} />
        <Skeleton style={{ height: 48 }} />
        <Skeleton style={{ height: 320 }} />
      </div>
    )
  }

  const a = app.data
  const canOpen = a.status === 'active'

  return (
    <div className="page page--detail">
      <PageHeader
        back={{ to: '/apps', label: 'Mis apps' }}
        title={a.name}
        badges={
          <>
            <StatusBadge status={a.status} />
            <Badge icon={Lock}>Privada</Badge>
          </>
        }
        meta={<span className="app-url">{a.url}</span>}
        actions={
          <>
            {canOpen ? (
              <ButtonAnchor
                variant="primary"
                href={`${import.meta.env.BASE_URL}#/i/${a.slug}`}
                target="_blank"
                rel="noopener"
                icon={<ExternalLink className="cl-i" aria-hidden="true" />}
              >
                Abrir app
              </ButtonAnchor>
            ) : a.status === 'publishing' ? (
              <ButtonLink to={`/apps/publicar/${a.slug}`} variant="primary">Ver publicación</ButtonLink>
            ) : (
              <ButtonLink to={`/apps/publicar?app=${a.slug}`} variant="danger-outline">Volver a publicar</ButtonLink>
            )}
            <CopyButton text={`https://${a.url}`} label="Copiar link" copiedLabel="¡Link copiado!" />
          </>
        }
      />
      <AppTabs slug={a.slug} accessCount={access.data?.length ?? a.peopleCount} />
      <Outlet context={{ app: a }} />
    </div>
  )
}
