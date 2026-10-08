import { Clock, Plug, Plus } from 'lucide-react'
import { useState } from 'react'
import { useApps, useTrial } from '../api/queries'
import { AddCard, AppCard } from '../components/AppCard'
import { PageHeader } from '../components/layout/PageHeader'
import { TrialInviteDialog } from '../components/TrialInviteDialog'
import { Banner } from '../components/ui/Banner'
import { Button, ButtonLink } from '../components/ui/Button'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { plural } from '../lib/format'
import { usePageTitle } from '../lib/usePageTitle'

const STEPS = [
  { title: 'Subí tu carpeta', text: 'O pedile a tu agente que la publique.' },
  { title: 'Te damos un link', text: 'Tu app queda online y privada.' },
  { title: 'Invitás a quien quieras', text: 'Entran con su cuenta de Google o Microsoft.' },
]

export default function MisApps() {
  usePageTitle('Mis apps')
  const apps = useApps()
  const trial = useTrial()
  const [inviteOpen, setInviteOpen] = useState(false)

  const list = apps.data ?? []
  const locked = trial.data?.status === 'locked'
  const hasInvites = (trial.data?.invitees.length ?? 0) > 0
  const isEmpty = apps.isSuccess && list.length === 0

  const banner =
    trial.data &&
    (locked ? (
      <Banner
        icon={Clock}
        actions={
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            {hasInvites ? 'Ver invitaciones' : 'Invitar personas'}
          </Button>
        }
      >
        <strong>Desbloqueá tu prueba gratis de {trial.data.daysTotal} días.</strong> Invitá a {trial.data.required} personas y que ingresen con su cuenta de Google o Microsoft. Ingresaron {trial.data.entered} de {trial.data.required}.
      </Banner>
    ) : (
      <Banner icon={Clock} actions={<ButtonLink to="/plan">Ver uso y plan</ButtonLink>}>
        <strong>Te {plural(trial.data.daysLeft, 'queda', 'quedan')} {trial.data.daysLeft} {plural(trial.data.daysLeft, 'día', 'días')} de prueba gratis.</strong> La desbloqueaste al invitar a {trial.data.required} personas.
      </Banner>
    ))

  return (
    <div className="page">
      <PageHeader
        title="Mis apps"
        subtitle={isEmpty ? 'Acá van a aparecer tus páginas y herramientas.' : 'Tus páginas y herramientas. Todas son privadas: solo entra quien vos invitás.'}
        actions={
          !isEmpty &&
          (locked ? (
            <Button variant="primary" disabled icon={<Plus className="cl-i" aria-hidden="true" />}>Publicar una app</Button>
          ) : (
            <ButtonLink to="/apps/publicar" variant="primary" icon={<Plus className="cl-i" aria-hidden="true" />}>Publicar una app</ButtonLink>
          ))
        }
      />

      {banner}

      {apps.isError ? (
        <ErrorState onRetry={() => apps.refetch()} />
      ) : apps.isLoading ? (
        <div className="app-grid" aria-busy="true" aria-label="Cargando tus apps">
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 260, borderRadius: 12 }} />)}
        </div>
      ) : isEmpty ? (
        <section className="cl-card empty">
          <img className="empty__mark" src={`${import.meta.env.BASE_URL}brand/cellula-isotipo.svg`} alt="" />
          <div className="empty__text">
            <h2>Todavía no publicaste ninguna app</h2>
            <p>Si tenés una página o herramienta que armó tu agente de IA, la ponemos online en un clic. Va a quedar privada: solo entran las personas que invites.</p>
          </div>
          <div className="empty__actions">
            {locked ? (
              <Button variant="primary" size="lg" disabled icon={<Plus className="cl-i" aria-hidden="true" />}>Publicar una app</Button>
            ) : (
              <ButtonLink to="/apps/publicar" variant="primary" size="lg" icon={<Plus className="cl-i" aria-hidden="true" />}>Publicar una app</ButtonLink>
            )}
            <ButtonLink to="/agente" size="lg" icon={<Plug className="cl-i" aria-hidden="true" />}>Conectar mi agente</ButtonLink>
          </div>
          {locked && <p className="empty__caption">Se habilita cuando desbloqueás la prueba gratis.</p>}
          <ol className="empty__steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="cl-step__n">{i + 1}</span>
                <span><b>{s.title}</b><br /><span className="muted">{s.text}</span></span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="app-grid" aria-label="Tus apps">
          {list.map((app) => <AppCard key={app.id} app={app} />)}
          <AddCard to="/apps/publicar" disabled={locked} />
        </section>
      )}

      <TrialInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}
