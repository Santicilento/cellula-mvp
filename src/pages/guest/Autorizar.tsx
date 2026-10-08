import { Eye, ScrollText, Send, UserCog } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, HttpError } from '../../api/client'
import { useMe } from '../../api/queries'
import type { OAuthAuthorizeResult } from '../../api/types'
import { GuestLayout } from '../../components/layout/GuestLayout'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { usePageTitle } from '../../lib/usePageTitle'

const PERMISSIONS = [
  { icon: Eye, text: 'Ver tus apps y quién tiene acceso' },
  { icon: Send, text: 'Publicar apps y versiones nuevas' },
  { icon: UserCog, text: 'Dar y quitar accesos' },
  { icon: ScrollText, text: 'Ver la actividad de tus apps' },
]

/**
 * Pantalla de autorización del conector (OAuth). La abre Claude en una ventana aparte.
 * Es la parte de Cellula del flujo: Cellula resuelve quién sos y qué le permitís al agente.
 * Al permitir, le devuelve a Claude un código por postMessage (o por redirección si no hay ventana de origen).
 */
export default function Autorizar() {
  usePageTitle('Autorizar a Claude')
  const [params] = useSearchParams()
  const { data: me } = useMe()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientId = params.get('client_id') ?? 'claude'
  const state = params.get('state') ?? ''
  const redirect = params.get('redirect_uri')
  const clientName = clientId === 'claude' ? 'Claude' : 'Esta aplicación'

  function deliver(payload: { type: 'cellula-oauth'; code?: string; state: string; error?: string }) {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin)
      window.close()
      return true
    }
    if (redirect) {
      // La ruta de vuelta puede ser de una página con "#/": los datos van dentro del hash, que es lo que lee su router.
      const url = new URL(redirect, window.location.origin)
      const extra = new URLSearchParams()
      if (payload.code) extra.set('code', payload.code)
      if (payload.error) extra.set('error', payload.error)
      extra.set('state', payload.state)
      if (url.hash.startsWith('#/')) {
        url.hash = `${url.hash}${url.hash.includes('?') ? '&' : '?'}${extra.toString()}`
      } else {
        extra.forEach((v, k) => url.searchParams.set(k, v))
      }
      window.location.href = url.toString()
      return true
    }
    return false
  }

  async function allow() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<OAuthAuthorizeResult>('/oauth/authorize', { client_id: clientId, state })
      if (!deliver({ type: 'cellula-oauth', code: res.code, state: res.state })) {
        setError('Listo, pero no encontramos dónde devolver la autorización. Volvé a Claude y probá de nuevo.')
        setBusy(false)
      }
    } catch (e) {
      setError(e instanceof HttpError ? e.message : 'No pudimos autorizar. Probá de nuevo.')
      setBusy(false)
    }
  }

  function cancel() {
    if (!deliver({ type: 'cellula-oauth', state, error: 'access_denied' })) window.history.back()
  }

  return (
    <GuestLayout>
      <span className="cl-auth__icon"><UserCog className="cl-i cl-i--xl" aria-hidden="true" /></span>
      <h1>{clientName} quiere conectarse a tu cuenta de Cellula</h1>

      {me && (
        <div className="authorize__who">
          <Avatar name={me.name} />
          <span><b>{me.name}</b><span>{me.email}</span></span>
        </div>
      )}

      <div className="authorize__perms">
        <p className="authorize__label">{clientName} va a poder:</p>
        <ul>
          {PERMISSIONS.map(({ icon: Icon, text }) => (
            <li key={text}>
              <span className="cl-ico cl-ico--sm"><Icon className="cl-i" aria-hidden="true" /></span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="cl-auth__small">Todo lo que haga queda en Actividad como «Tu agente». Podés desconectarlo cuando quieras desde Conectar mi agente.</p>
      {error && <p role="alert" className="cl-field__error">{error}</p>}
      <div className="authorize__actions">
        <Button onClick={cancel} disabled={busy}>Cancelar</Button>
        <Button variant="primary" onClick={allow} disabled={busy}>{busy ? 'Conectando…' : 'Permitir'}</Button>
      </div>
    </GuestLayout>
  )
}
