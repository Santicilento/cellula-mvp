import { GuestLayout } from '../components/layout/GuestLayout'
import { ButtonLink } from '../components/ui/Button'
import { usePageTitle } from '../lib/usePageTitle'

export default function NotFound() {
  usePageTitle('No encontramos esa página')
  return (
    <GuestLayout>
      <h1>No encontramos esa página</h1>
      <p>Puede que el link esté incompleto o que ya no exista.</p>
      <ButtonLink to="/apps" variant="primary">Ir a Mis apps</ButtonLink>
    </GuestLayout>
  )
}
