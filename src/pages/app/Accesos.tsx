import { Info, UserX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { HttpError } from '../../api/client'
import { useAccess, useInvite, useRevoke } from '../../api/queries'
import type { AccessEntry, Role } from '../../api/types'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState } from '../../components/ui/ErrorState'
import { Field } from '../../components/ui/Field'
import { RoleGroup } from '../../components/ui/RoleGroup'
import { Skeleton } from '../../components/ui/Skeleton'
import { dayTime, daysUntil, firstName, isEmail, maskDate, parseDateInput, shortDate } from '../../lib/format'
import { ROLE_LABEL } from '../../lib/roles'
import { useAppContext } from './useAppContext'

function ExpiryCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="cl-muted">Sin vencimiento</span>
  const left = daysUntil(iso)
  return (
    <>
      {shortDate(iso)}
      {left < 0 && <span className="cl-danger">Venció</span>}
      {left === 0 && <span className="cl-warn">Vence hoy</span>}
      {left === 1 && <span className="cl-warn">Vence mañana</span>}
      {left > 1 && left <= 14 && <span className="cl-warn">Vence en {left} días</span>}
    </>
  )
}

/** Accesos de una app: invitar por email, elegir rol y ver o quitar personas. */
export default function Accesos() {
  const { app } = useAppContext()
  const access = useAccess(app.slug)
  const invite = useInvite(app.slug)
  const revoke = useRevoke(app.slug)

  const [email, setEmail] = useState('')
  const [expires, setExpires] = useState('')
  const [role, setRole] = useState<Role>('ver')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [expiresError, setExpiresError] = useState<string | null>(null)
  const [target, setTarget] = useState<AccessEntry | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setExpiresError(null)
    if (!isEmail(email)) return setEmailError('Escribí un email válido, por ejemplo nombre@ejemplo.com.')
    let expiresAt: string | null = null
    if (expires.trim()) {
      expiresAt = parseDateInput(expires)
      if (!expiresAt) return setExpiresError('Usá el formato dd/mm/aaaa, por ejemplo 15/12/2026.')
    }
    invite.mutate(
      { email: email.trim(), role, expiresAt },
      {
        onSuccess: (entry) => {
          setEmail('')
          setExpires('')
          setRole('ver')
          toast.success(`Invitamos a ${entry.email}`, { description: `Rol ${ROLE_LABEL[entry.role]}. Entra con su cuenta de Google o Microsoft.` })
        },
        onError: (err) => {
          if (err instanceof HttpError && err.field === 'email') setEmailError(err.message)
          else if (err instanceof HttpError && err.field === 'expiresAt') setExpiresError(err.message)
          else toast.error('No pudimos enviar la invitación. Probá de nuevo.')
        },
      },
    )
  }

  function confirmRevoke() {
    if (!target) return
    const person = target
    revoke.mutate(person.id, {
      onSuccess: () => {
        setTarget(null)
        toast.success(`Se quitó el acceso de ${person.name}`, { description: 'Ya no puede entrar a la app.' })
      },
      onError: () => toast.error('No pudimos quitar el acceso. Probá de nuevo.'),
    })
  }

  return (
    <>
      <form className="cl-card invite-card" onSubmit={submit} noValidate>
        <div className="invite-card__row">
          <Field
            wrapperClassName="invite-card__email"
            label="Invitar por email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="nombre@ejemplo.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
            error={emailError}
          />
          <Field
            wrapperClassName="invite-card__date"
            label="Vence el"
            optional="(opcional)"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            value={expires}
            onChange={(e) => { setExpires(maskDate(e.target.value)); setExpiresError(null) }}
            error={expiresError}
          />
          <Button type="submit" variant="primary" className="invite-card__submit" disabled={invite.isPending}>
            {invite.isPending ? 'Invitando…' : 'Invitar'}
          </Button>
        </div>
        <RoleGroup value={role} onChange={setRole} />
        <p className="inline-help inline-help--strong">
          <Info className="cl-i" aria-hidden="true" style={{ color: 'var(--brand)', width: 18, height: 18 }} />
          Entran con su cuenta de Google o Microsoft, sin registrarse.
        </p>
      </form>

      {access.isError ? (
        <ErrorState onRetry={() => access.refetch()} />
      ) : !access.data ? (
        <Skeleton style={{ height: 300 }} />
      ) : (
        <div className="table-scroll">
          <table className="cl-table access-table">
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Rol</th>
                <th scope="col">Vence</th>
                <th scope="col">Último ingreso</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {access.data.map((p) => (
                <tr key={p.id} className={target?.id === p.id ? 'cl-row--target' : undefined}>
                  <td>
                    <div className="cl-person">
                      <Avatar name={p.name} tint />
                      <div>
                        <strong>{p.name}{p.isYou ? ' (vos)' : ''}</strong>
                        <span>{p.email}</span>
                      </div>
                    </div>
                  </td>
                  <td><Badge tone={p.role === 'administrar' ? 'ok' : 'neutral'}>{ROLE_LABEL[p.role]}</Badge></td>
                  <td><ExpiryCell iso={p.expiresAt} /></td>
                  <td>{p.lastEntryAt ? dayTime(p.lastEntryAt) : <span className="cl-muted">Todavía no ingresó</span>}</td>
                  <td className="cl-num">
                    {!p.isYou && (
                      <button type="button" className="cl-textbtn cl-textbtn--danger" aria-label={`Quitar acceso a ${p.name}`} onClick={() => setTarget(p)}>
                        Quitar acceso
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        icon={UserX}
        title={`¿Quitar el acceso de ${target?.name ?? ''}?`}
        description={
          <>
            {target ? firstName(target.name) : ''} va a dejar de poder entrar a <b>{app.name}</b> ahora mismo. Si tiene la app abierta, se le cierra.
          </>
        }
        note={<><b>El cambio es inmediato.</b> No hace falta tocar tu app ni volver a publicarla.</>}
        hint={`Si más adelante querés, podés volver a invitar a ${target ? firstName(target.name) : ''}.`}
        confirmLabel="Sí, quitar acceso"
        busy={revoke.isPending}
        onConfirm={confirmRevoke}
      />
    </>
  )
}
