import { TriangleAlert } from 'lucide-react'
import { Button } from './Button'

export function ErrorState({ message = 'Algo salió mal. Probá de nuevo.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="cl-card state-box" role="alert">
      <span className="cl-ico cl-ico--danger"><TriangleAlert className="cl-i" aria-hidden="true" /></span>
      <p className="state-box__text">{message}</p>
      {onRetry && <Button onClick={onRetry}>Reintentar</Button>}
    </div>
  )
}
