import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAckNotifications, useNotifications } from '../api/queries'

/**
 * Escucha los avisos del backend ("Tu app está online", "Ingresaron 2 de 3") y los muestra como toast.
 * Es lo que cumple el "podés salir de esta pantalla: te avisamos cuando esté lista".
 */
export function NotificationsBridge() {
  const { data } = useNotifications()
  const ack = useAckNotifications()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const seen = useRef(new Set<string>())

  useEffect(() => {
    if (!data?.length) return
    const fresh = data.filter((n) => !seen.current.has(n.id))
    if (fresh.length === 0) return
    fresh.forEach((n) => seen.current.add(n.id))
    for (const n of fresh) {
      // Si ya estás mirando la pantalla de esa publicación, el aviso sobra: la pantalla misma muestra "¡Tu app está online!".
      if (n.kind === 'publish_done' && pathname === `/apps/publicar/${n.appSlug}`) continue
      toast.success(n.title, {
        description: n.body,
        action: n.appSlug ? { label: 'Ver app', onClick: () => navigate(`/apps/${n.appSlug}`) } : undefined,
      })
    }
    ack.mutate(fresh.map((n) => n.id))
    for (const key of ['apps', 'app', 'trial', 'activity', 'usage', 'demo']) qc.invalidateQueries({ queryKey: [key] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return null
}
