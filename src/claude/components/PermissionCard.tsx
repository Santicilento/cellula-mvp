import { Check, Ban, ShieldQuestion } from 'lucide-react'
import { decide } from '../store/controller'
import type { Part } from '../store/types'

type PermissionPart = Extract<Part, { type: 'permission' }>

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Qué va a hacer la herramienta, dicho en una frase. */
function describe(part: PermissionPart): string {
  const a = part.args
  switch (part.tool) {
    case 'publish_app':
      return `Publicar «${str(a.name)}» en Cellula. Queda online en un link privado: solo entran las personas que invites.`
    case 'grant_access':
      return `Darle acceso de ${str(a.role)} a ${str(a.email)} en «${str(a.app)}».`
    case 'revoke_access':
      return `Quitarle el acceso a ${str(a.person)} en «${str(a.app)}». El cambio es inmediato.`
    default:
      return `Usar «${part.title}» en ${part.connectorName}.`
  }
}

/** "Claude quiere usar Publicar app de Cellula": Permitir siempre / una vez / Rechazar. */
export function PermissionCard({ part }: { part: PermissionPart }) {
  if (part.decision !== 'pending') {
    const label =
      part.decision === 'deny' ? 'Rechazaste' : part.decision === 'allow-always' ? 'Permitiste siempre' : 'Permitiste una vez'
    return (
      <span className={`cd-perm__done${part.decision === 'deny' ? ' cd-perm__done--deny' : ''}`}>
        {part.decision === 'deny' ? <Ban className="cd-i" aria-hidden="true" /> : <Check className="cd-i" aria-hidden="true" />}
        {label}: {part.title} · {part.connectorName}
      </span>
    )
  }
  return (
    <div className="cd-perm" role="group" aria-label={`Permiso para usar ${part.title}`}>
      <div className="cd-perm__head">
        <span className="cd-tool__icon"><ShieldQuestion className="cd-i" aria-hidden="true" /></span>
        <div>
          <p className="cd-perm__title">Claude quiere usar «{part.title}» de {part.connectorName}</p>
          <p className="cd-perm__sub">{describe(part)}</p>
        </div>
      </div>
      <pre className="cd-perm__args">{JSON.stringify(part.args, null, 2)}</pre>
      <div className="cd-perm__actions">
        <button type="button" className="cd-btn cd-btn--primary" onClick={() => decide(part, 'allow-once')}>Permitir una vez</button>
        <button type="button" className="cd-btn" onClick={() => decide(part, 'allow-always')}>Permitir siempre</button>
        <button type="button" className="cd-btn cd-btn--ghost" onClick={() => decide(part, 'deny')}>Rechazar</button>
      </div>
    </div>
  )
}
