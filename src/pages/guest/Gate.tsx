import * as Dialog from '@radix-ui/react-dialog'
import { Lock, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGate, useGateLogin } from '../../api/queries'
import type { Provider } from '../../api/types'
import { GuestLayout } from '../../components/layout/GuestLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { isEmail } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { getVisitor, setVisitor } from '../../lib/visitor'

const ACCOUNTS = [
  { name: 'Lucía Benítez', email: 'lucia.benitez@gmail.com' },
  { name: 'Martín Giménez', email: 'martin.gimenez@consultoriogimenez.com.ar' },
  { name: 'Carolina Suárez', email: 'carolina.suarez@outlook.com' },
  { name: 'Inés Morales', email: 'ines.morales@gmail.com' },
  { name: 'Diego Fernández', email: 'diego.fernandez@gmail.com' },
]

function GoogleMark() {
  return <span className="sso-mark sso-mark--g" aria-hidden="true">G</span>
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="2" y="2" width="9.5" height="9.5" fill="currentColor" />
      <rect x="12.5" y="2" width="9.5" height="9.5" fill="currentColor" />
      <rect x="2" y="12.5" width="9.5" height="9.5" fill="currentColor" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="currentColor" />
    </svg>
  )
}

/** Lo que ve quien recibe el link: la app es privada y se entra con Google o Microsoft. */
export default function Gate() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const gate = useGate(slug)
  const login = useGateLogin(slug)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [other, setOther] = useState('')
  const [otherError, setOtherError] = useState<string | null>(null)
  usePageTitle(gate.data ? `${gate.data.name} es privada` : 'Esta app es privada')

  // Si ya había entrado con una cuenta, pasa directo (la app verifica el permiso de nuevo).
  useEffect(() => {
    if (gate.data?.available && getVisitor()) navigate(`/i/${slug}/app`, { replace: true })
  }, [gate.data, navigate, slug])

  function signIn(email: string) {
    if (!provider) return
    login.mutate(
      { email, provider },
      {
        onSuccess: (res) => {
          if (res.status === 'granted') {
            setVisitor({ email: res.email, name: res.name, provider })
            navigate(`/i/${slug}/app`)
          } else {
            navigate(`/i/${slug}/sin-acceso?cuenta=${encodeURIComponent(res.email)}`)
          }
        },
      },
    )
  }

  if (gate.isError) {
    return (
      <GuestLayout>
        <span className="cl-auth__icon cl-auth__icon--warn"><TriangleAlert className="cl-i cl-i--xl" aria-hidden="true" /></span>
        <h1>Esta app no existe</h1>
        <p>Revisá que el link esté completo, o pedile a quien te lo compartió que te lo mande de nuevo.</p>
      </GuestLayout>
    )
  }

  if (!gate.data) {
    return (
      <GuestLayout>
        <Skeleton style={{ height: 280 }} />
      </GuestLayout>
    )
  }

  if (!gate.data.available) {
    return (
      <GuestLayout>
        <span className="cl-auth__icon cl-auth__icon--warn"><TriangleAlert className="cl-i cl-i--xl" aria-hidden="true" /></span>
        <h1>Esta app no está disponible por ahora</h1>
        <p><b>{gate.data.name}</b><br />Probá de nuevo en unos minutos.</p>
      </GuestLayout>
    )
  }

  return (
    <GuestLayout>
      <span className="cl-auth__icon"><Lock className="cl-i cl-i--xl" aria-hidden="true" /></span>
      <h1>Esta app es privada</h1>
      <p>
        <b className="ink">{gate.data.name}</b>
        <br />
        Entrá con tu cuenta para continuar. Solo pueden pasar las personas que invitó {gate.data.ownerName}.
      </p>
      <div className="sso-list">
        <Button className="cl-btn--sso" icon={<GoogleMark />} onClick={() => setProvider('google')}>Ingresar con Google</Button>
        <Button className="cl-btn--sso" icon={<MicrosoftMark />} onClick={() => setProvider('microsoft')}>Ingresar con Microsoft</Button>
      </div>
      <p className="cl-auth__small">No hace falta registrarse. Usás la cuenta que ya tenés.</p>

      <Dialog.Root open={provider !== null} onOpenChange={(open) => !open && !login.isPending && setProvider(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="cl-scrim cl-scrim--fixed" />
          <Dialog.Content className="cl-dialog cl-dialog--fixed chooser" aria-describedby="chooser-desc">
            <Dialog.Title asChild><h2>Elegí una cuenta de {provider === 'microsoft' ? 'Microsoft' : 'Google'}</h2></Dialog.Title>
            <Dialog.Description asChild>
              <p id="chooser-desc" className="chooser__note">
                Simulación del prototipo: en Cellula real, acá se abre el login de tu cuenta. Probá con alguien invitado, con quien no, o escribí otro email.
              </p>
            </Dialog.Description>
            <ul className="chooser__list">
              {ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button type="button" className="chooser__item" disabled={login.isPending} onClick={() => signIn(a.email)}>
                    <Avatar name={a.name} tint />
                    <span><b>{a.name}</b><span>{a.email}</span></span>
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="chooser__other"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                if (!isEmail(other)) return setOtherError('Escribí un email válido.')
                setOtherError(null)
                signIn(other.trim())
              }}
            >
              <div className="chooser__other-row">
                <input
                  className="cl-input"
                  type="email"
                  placeholder="Usar otro email"
                  aria-label="Usar otro email"
                  aria-invalid={otherError ? true : undefined}
                  value={other}
                  onChange={(e) => { setOther(e.target.value); setOtherError(null) }}
                />
                <Button type="submit" variant="primary" disabled={login.isPending}>Continuar</Button>
              </div>
              {otherError && <span role="alert" className="cl-field__error">{otherError}</span>}
            </form>
            {login.isPending && <p className="chooser__note" role="status">Verificando tu cuenta…</p>}
            <Dialog.Close asChild>
              <button type="button" className="cl-iconbtn dialog-x" aria-label="Cerrar" disabled={login.isPending}><X className="cl-i" aria-hidden="true" /></button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </GuestLayout>
  )
}
