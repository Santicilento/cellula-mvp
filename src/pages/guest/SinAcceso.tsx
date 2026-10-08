import { LockKeyhole } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { GuestLayout } from '../../components/layout/GuestLayout'
import { Button } from '../../components/ui/Button'
import { usePageTitle } from '../../lib/usePageTitle'
import { clearVisitor } from '../../lib/visitor'

/** Invitado sin permiso (nunca lo invitaron, le venció o se lo quitaron). */
export default function SinAcceso() {
  usePageTitle('No tenés acceso')
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const account = params.get('cuenta')
  const reason = params.get('motivo')

  const lead =
    reason === 'removed'
      ? 'Te quitaron el acceso. Pedile a quien te compartió el link que te vuelva a invitar.'
      : reason === 'expired'
        ? 'Tu acceso venció. Pedile a quien te compartió el link que lo renueve.'
        : 'Pedíselo a quien te compartió el link.'

  return (
    <GuestLayout>
      <span className="cl-auth__icon cl-auth__icon--warn"><LockKeyhole className="cl-i cl-i--xl" aria-hidden="true" /></span>
      <h1>No tenés acceso a esta app</h1>
      <p className="ink-soft">{lead}</p>
      {account && (
        <div className="account-box">
          Ingresaste como
          <br />
          <b>{account}</b>
        </div>
      )}
      <div className="sso-list">
        <Button
          className="cl-btn--sso"
          onClick={() => {
            clearVisitor()
            navigate(`/i/${slug}`)
          }}
        >
          Probar con otra cuenta
        </Button>
      </div>
      <p className="cl-auth__small">Si creés que ya te invitaron, avisale a esa persona que revise que usó este mismo email.</p>
    </GuestLayout>
  )
}
