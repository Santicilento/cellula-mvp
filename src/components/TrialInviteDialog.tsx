import * as Dialog from '@radix-ui/react-dialog'
import { Check, Clock, Info, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useInviteTrial, useTrial } from '../api/queries'
import { HttpError } from '../api/client'
import { isEmail } from '../lib/format'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Field } from './ui/Field'

/**
 * Hard paywall: la prueba gratis de 14 días se desbloquea cuando 3 personas invitadas ingresan con Google o Microsoft.
 * (Pantalla agregada en el prototipo: el MVP del TPO define la regla, pero no dibuja este paso.)
 */
export function TrialInviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: trial } = useTrial()
  const invite = useInviteTrial()
  const [emails, setEmails] = useState<string[]>(['', '', ''])
  const [error, setError] = useState<string | null>(null)

  const sent = trial?.invitees ?? []
  const required = trial?.required ?? 3
  const slots = Math.max(0, required - sent.length)
  const entered = trial?.entered ?? 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const filled = emails.slice(0, slots).map((v) => v.trim()).filter(Boolean)
    if (filled.length === 0) return setError('Escribí al menos un email.')
    const bad = filled.find((v) => !isEmail(v))
    if (bad) return setError(`«${bad}» no parece un email válido.`)
    setError(null)
    invite.mutate(filled, {
      onSuccess: () => {
        setEmails(['', '', ''])
        toast.success(`Invitamos a ${filled.length} ${filled.length === 1 ? 'persona' : 'personas'}`, {
          description: 'Apenas ingresen con su cuenta, avanza tu prueba gratis.',
        })
      },
      onError: (err) => setError(err instanceof HttpError ? err.message : 'No pudimos enviar las invitaciones. Probá de nuevo.'),
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="cl-scrim cl-scrim--fixed" />
        <Dialog.Content className="cl-dialog cl-dialog--fixed" aria-describedby="trial-desc">
          <div className="cl-dialog__head">
            <span className="cl-dialog__icon cl-dialog__icon--brand"><Clock className="cl-i cl-i--lg" aria-hidden="true" /></span>
            <div>
              <Dialog.Title asChild><h2>Desbloqueá tu prueba gratis</h2></Dialog.Title>
              <Dialog.Description asChild>
                <p id="trial-desc">
                  Invitá a {required} personas. Cuando ingresen con su cuenta de Google o Microsoft, tenés {trial?.daysTotal ?? 14} días para publicar y compartir tus apps.
                </p>
              </Dialog.Description>
            </div>
          </div>

          {sent.length > 0 && (
            <>
              <ul className="invite-list" aria-label="Personas invitadas">
                {sent.map((i) => (
                  <li key={i.id}>
                    <span className="invite-list__mail">{i.email}</span>
                    {i.state === 'entered' ? (
                      <Badge tone="ok" icon={Check}>Ingresó</Badge>
                    ) : (
                      <Badge tone="warn" icon={Clock}>Esperando</Badge>
                    )}
                  </li>
                ))}
              </ul>
              <p className="invite-progress" aria-live="polite">Ingresaron <b>{entered} de {required}</b></p>
            </>
          )}

          {slots > 0 && (
            <form onSubmit={submit} className="invite-form" noValidate>
              {Array.from({ length: slots }).map((_, i) => (
                <Field
                  key={i}
                  label={`Email de la persona ${sent.length + i + 1}`}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="nombre@ejemplo.com"
                  value={emails[i] ?? ''}
                  onChange={(e) => setEmails((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                />
              ))}
              {error && <p role="alert" className="cl-field__error"><Info className="cl-i" aria-hidden="true" />{error}</p>}
              <p className="invite-hint"><Info className="cl-i" aria-hidden="true" />Entran con su cuenta de Google o Microsoft, sin registrarse.</p>
              <div className="cl-dialog__actions">
                <Dialog.Close asChild><Button>Ahora no</Button></Dialog.Close>
                <Button type="submit" variant="primary" disabled={invite.isPending}>{invite.isPending ? 'Enviando…' : 'Enviar invitaciones'}</Button>
              </div>
            </form>
          )}

          {slots === 0 && (
            <div className="cl-dialog__actions">
              <Dialog.Close asChild><Button variant="primary">Listo</Button></Dialog.Close>
            </div>
          )}

          <Dialog.Close asChild>
            <button type="button" className="cl-iconbtn dialog-x" aria-label="Cerrar"><X className="cl-i" aria-hidden="true" /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
