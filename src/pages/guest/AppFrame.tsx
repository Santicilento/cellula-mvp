import { LogOut } from 'lucide-react'
import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useGate, useGateSession } from '../../api/queries'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { usePageTitle } from '../../lib/usePageTitle'
import { ROLES, ROLE_LABEL } from '../../lib/roles'
import { clearVisitor, getVisitor } from '../../lib/visitor'

/**
 * La app ya "adentro". En el prototipo es una pantalla de relleno:
 * muestra lo que Cellula le informa a la app en cada pedido y deja probar la revocación inmediata.
 */
export default function AppFrame() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const visitor = getVisitor()
  const gate = useGate(slug)
  const session = useGateSession(slug, visitor?.email, visitor?.provider)
  usePageTitle(gate.data?.name)

  const denied = session.data?.status === 'denied' ? session.data : null

  useEffect(() => {
    if (denied) {
      navigate(`/i/${slug}/sin-acceso?cuenta=${encodeURIComponent(denied.email)}&motivo=${denied.reason === 'expired' ? 'expired' : 'removed'}`, { replace: true })
    }
  }, [denied, navigate, slug])

  if (!visitor) return <Navigate to={`/i/${slug}`} replace />

  const granted = session.data?.status === 'granted' ? session.data : null
  const roleHelp = granted ? ROLES.find((r) => r.value === granted.role)?.help : ''

  return (
    <div className="appframe">
      <header className="appframe__bar">
        <img src={`${import.meta.env.BASE_URL}brand/cellula-logo.svg`} alt="Cellula" height={22} />
        <span className="appframe__who">
          {granted ? (
            <>
              <span>Entraste como <b>{granted.name}</b></span>
              <Badge tone={granted.role === 'administrar' ? 'ok' : 'neutral'}>{ROLE_LABEL[granted.role]}</Badge>
            </>
          ) : null}
          <Button
            size="sm"
            icon={<LogOut className="cl-i" aria-hidden="true" />}
            onClick={() => {
              clearVisitor()
              navigate(`/i/${slug}`)
            }}
          >
            Salir
          </Button>
        </span>
      </header>

      <main className="appframe__body">
        {!granted || !gate.data ? (
          <Skeleton style={{ height: 320, width: '100%', maxWidth: 720 }} />
        ) : (
          <section className="cl-card appframe__card">
            <h1>{gate.data.name}</h1>
            <p className="lead">
              Acá se vería tu app. Cellula la protege: verificó tu cuenta de {granted.provider === 'microsoft' ? 'Microsoft' : 'Google'} y tu permiso antes de dejarte pasar. La app no tiene código de login.
            </p>

            <h2 className="side-title">Lo que Cellula le informa a la app en cada pedido</h2>
            <pre className="cl-code appframe__code" aria-label="Datos que recibe la app">{`X-Cellula-User: ${granted.email}
X-Cellula-Name: ${granted.name}
X-Cellula-Role: ${granted.role}`}</pre>
            <p className="muted">{ROLE_LABEL[granted.role]}: {roleHelp}</p>

            <div className="appframe__hint">
              <b>Probá la revocación inmediata.</b> En otra pestaña, entrá a Accesos de esta app y quitale el acceso a esta persona. En unos segundos, esta pantalla se cierra sola, sin tocar la app ni volver a publicarla.
            </div>
            <p className="appframe__caption">Pantalla de relleno del prototipo: en Cellula real, acá aparece tu app.</p>
          </section>
        )}
      </main>
    </div>
  )
}
