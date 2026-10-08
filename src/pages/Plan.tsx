import { Check, Clock } from 'lucide-react'
import { useState } from 'react'
import { useTrial, useUsage } from '../api/queries'
import { PageHeader } from '../components/layout/PageHeader'
import { TrialInviteDialog } from '../components/TrialInviteDialog'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { StatCard } from '../components/ui/StatCard'
import { dayMonth, formatNumber, longDate, plural } from '../lib/format'
import { usePageTitle } from '../lib/usePageTitle'

/** Uso y plan: estado de la prueba gratis, tres cifras y barras por app. */
export default function Plan() {
  usePageTitle('Uso y plan')
  const trial = useTrial()
  const usage = useUsage()
  const [inviteOpen, setInviteOpen] = useState(false)

  if (usage.isError || trial.isError) {
    return (
      <div className="page">
        <PageHeader title="Uso y plan" subtitle="Cuánto usaste este mes y cómo se calcula tu plan." />
        <ErrorState onRetry={() => { usage.refetch(); trial.refetch() }} />
      </div>
    )
  }

  const t = trial.data
  const u = usage.data
  const used = t && t.status === 'active' ? ((t.daysTotal - t.daysLeft) / t.daysTotal) * 100 : 0
  const maxEntries = Math.max(1, ...(u?.entriesByApp.map((a) => a.entries) ?? [1]))

  return (
    <div className="page">
      <PageHeader title="Uso y plan" subtitle="Cuánto usaste este mes y cómo se calcula tu plan." />

      {!t ? (
        <Skeleton style={{ height: 150 }} />
      ) : (
        <section className="cl-card trial-card">
          <div className="trial-card__main">
            <div className="trial-card__top">
              <span className="trial-card__label">Prueba gratis</span>
              {t.status === 'active' ? <Badge tone="ok">En curso</Badge> : <Badge tone="warn">Sin activar</Badge>}
            </div>
            <div className="trial-card__big">
              {t.status === 'active'
                ? `Te ${plural(t.daysLeft, 'queda', 'quedan')} ${t.daysLeft} ${plural(t.daysLeft, 'día', 'días')} de ${t.daysTotal}`
                : `${t.daysTotal} días para probar Cellula`}
            </div>
            <div className="cl-meter cl-meter--lg" role="progressbar" aria-label="Días de prueba usados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used)}>
              <span style={{ width: `${used}%` }} />
            </div>
            <span className="muted">
              {t.status === 'active' && t.endsAt ? `Termina el ${longDate(t.endsAt)}.` : 'Se activa cuando 3 personas que invitaste ingresan con su cuenta.'}
            </span>
          </div>
          <div className="trial-card__divider" aria-hidden="true" />
          <div className="trial-card__side">
            {t.status === 'active' && t.unlockedAt ? (
              <span>La desbloqueaste el {dayMonth(t.unlockedAt)}, cuando {t.required} personas que invitaste ingresaron con su cuenta de Google o Microsoft.</span>
            ) : (
              <span>Para desbloquearla, invitá a {t.required} personas y que ingresen con su cuenta de Google o Microsoft. Ingresaron {t.entered} de {t.required}.</span>
            )}
            <div className="trial-card__chips">
              {Array.from({ length: t.required }).map((_, i) => {
                const entered = t.invitees.filter((x) => x.state === 'entered').length > i
                return entered ? (
                  <Badge key={i} tone="ok" icon={Check}>Invitado {i + 1}</Badge>
                ) : (
                  <Badge key={i} tone="warn" icon={Clock}>Invitado {i + 1}</Badge>
                )
              })}
            </div>
            {t.status === 'locked' && (
              <div><Button variant="primary" onClick={() => setInviteOpen(true)}>{t.invitees.length > 0 ? 'Ver invitaciones' : 'Invitar personas'}</Button></div>
            )}
          </div>
        </section>
      )}

      <section className="stat-grid">
        {!u ? (
          [0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 130 }} />)
        ) : (
          <>
            <StatCard label="Apps activas" value={u.activeApps} note={`de ${u.publishedApps} ${plural(u.publishedApps, 'publicada', 'publicadas')}`} />
            <StatCard label="Personas con acceso" value={u.peopleWithAccess} note="sumando todas tus apps" />
            <StatCard label="Ingresos este mes" value={formatNumber(u.entriesThisMonth)} note={u.monthLabel} />
          </>
        )}
      </section>

      <section className="plan-grid">
        <div className="cl-card plan-card">
          <h2 className="side-title">Ingresos por app</h2>
          {!u ? (
            <Skeleton style={{ height: 160 }} />
          ) : u.entriesByApp.length === 0 ? (
            <p className="muted">Todavía no publicaste ninguna app.</p>
          ) : (
            <div className="cl-bars">
              {u.entriesByApp.map((a) => (
                <div key={a.slug} className="cl-bars__row">
                  <div><span>{a.name}</span><b>{formatNumber(a.entries)}</b></div>
                  <div className="cl-meter"><span style={{ width: `${(a.entries / maxEntries) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="cl-card plan-card plan-card--text">
          <h2 className="side-title">Cómo se calcula tu plan</h2>
          <p>Es una suscripción mensual que depende de cuánto usás: cuántas apps tenés publicadas y cuántas personas tienen acceso.</p>
          <p>Durante la prueba gratis no pagás nada. Un uso típico ronda los USD 33 por mes (estimado).</p>
          <p>Unos días antes de que termine la prueba te avisamos, con un resumen de lo que publicaste y usaste. Pasar al plan pago no te hace perder ninguna app.</p>
        </div>
      </section>

      <TrialInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}
