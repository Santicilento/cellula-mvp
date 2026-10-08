import * as Dialog from '@radix-ui/react-dialog'
import { Zap, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: LucideIcon
  title: string
  /** Qué pasa ahora, dicho antes de pedir la confirmación. */
  description: ReactNode
  /** Aviso ámbar: "El cambio es inmediato…". */
  note?: ReactNode
  /** Camino de vuelta: "Si más adelante querés, podés volver a invitarla." */
  hint?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
}

/** Confirmación de una acción destructiva: explica el efecto, avisa que es inmediato y ofrece volver atrás. */
export function ConfirmDialog({
  open, onOpenChange, icon: Icon, title, description, note, hint, confirmLabel, cancelLabel = 'Cancelar', busy, onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="cl-scrim cl-scrim--fixed" />
        <Dialog.Content className="cl-dialog cl-dialog--fixed" aria-describedby="confirm-desc">
          <div className="cl-dialog__head">
            <span className="cl-dialog__icon">
              <Icon className="cl-i cl-i--lg" aria-hidden="true" />
            </span>
            <div>
              <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
              <Dialog.Description asChild><p id="confirm-desc">{description}</p></Dialog.Description>
            </div>
          </div>
          {note && (
            <div className="cl-dialog__note">
              <Zap className="cl-i cl-i--lg" aria-hidden="true" />
              <span>{note}</span>
            </div>
          )}
          {hint && <p className="cl-dialog__hint">{hint}</p>}
          <div className="cl-dialog__actions">
            <Dialog.Close asChild>
              <Button disabled={busy}>{cancelLabel}</Button>
            </Dialog.Close>
            <Button variant="danger" onClick={onConfirm} disabled={busy}>
              {busy ? 'Un momento…' : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
