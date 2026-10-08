import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ClaudeMark } from '../components/ClaudeMark'
import { finishRedirect } from '../store/controller'

/** Vuelta de Cellula cuando el navegador no dejó abrir la ventana de autorización y se usó una redirección. */
export default function OAuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void finishRedirect(params.get('code'), params.get('state'), params.get('error')).then((result) => {
      if (result === 'denied') toast('No diste el permiso en Cellula. Podés intentarlo de nuevo.')
      else if (result === 'failed') toast.error('No pudimos completar la conexión. Probá de nuevo.')
      navigate('/configuracion/conectores', { replace: true })
    })
  }, [params, navigate])

  return (
    <div className="cd-callback" role="status">
      <div>
        <ClaudeMark />
        Terminando de conectar con Cellula…
      </div>
    </div>
  )
}
