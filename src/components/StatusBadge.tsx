import { RotateCw, Sparkles, TriangleAlert, Upload } from 'lucide-react'
import type { AppStatus, Origin } from '../api/types'
import { Badge } from './ui/Badge'

/** Estados fijos de una app: Activa, Publicando, Con error. */
export function StatusBadge({ status }: { status: AppStatus }) {
  if (status === 'active') return <Badge tone="ok" dot>Activa</Badge>
  if (status === 'publishing') return <Badge tone="warn" icon={RotateCw}>Publicando</Badge>
  return <Badge tone="error" icon={TriangleAlert}>Con error</Badge>
}

/** Origen: "Publicada por tu agente" o "Subida manual". */
export function OriginBadge({ origin }: { origin: Origin }) {
  return origin === 'agent' ? (
    <Badge icon={Sparkles}>Publicada por tu agente</Badge>
  ) : (
    <Badge icon={Upload}>Subida manual</Badge>
  )
}
