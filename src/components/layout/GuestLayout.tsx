import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'

/** Pantallas de acceso (invitado): sin menú, logo centrado, tarjeta de 480 px y la línea del candado. */
export function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <div className="guest">
      <img className="guest__logo" src={`${import.meta.env.BASE_URL}brand/cellula-logo.svg`} alt="Cellula" />
      <main className="cl-auth">{children}</main>
      <p className="guest__lock">
        <Lock className="cl-i" aria-hidden="true" />
        El acceso lo protege Cellula, no la app.
      </p>
    </div>
  )
}
