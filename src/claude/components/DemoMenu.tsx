import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRuntime } from '../store/controller'
import { useClaude } from '../store/store'

const AGENDA_KEY = 'claude-demo:agenda-de-clases'

/** La pastilla "Demo" de la barra lateral: aclara que es una simulación y permite volver a empezar. */
export function DemoMenu() {
  const navigate = useNavigate()
  const resetAll = useClaude((s) => s.resetAll)
  const closePanel = useRuntime((s) => s.closePanel)

  function reset() {
    resetAll()
    closePanel()
    try {
      localStorage.removeItem(AGENDA_KEY)
    } catch {
      // sin almacenamiento: nada que borrar
    }
    navigate('/')
    toast.success('Demo restablecida', { description: 'Se borraron los chats y los conectores de Claude. Cellula no se toca.' })
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="cd-demo-pill" aria-label="Menú de la demo" style={{ border: 0, cursor: 'pointer' }}>Demo</button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cd-menu" align="start" sideOffset={8} collisionPadding={12} style={{ width: 280 }}>
          <DropdownMenu.Label className="cd-menu__title">Esto es una demo</DropdownMenu.Label>
          <p style={{ margin: '0 10px 8px', fontSize: 12.5, lineHeight: '18px', color: 'var(--cd-muted)' }}>
            Recrea claude.ai para mostrar el flujo con Cellula. Las respuestas son guionadas; el conector sí funciona de verdad contra Cellula.
          </p>
          <DropdownMenu.Item className="cd-menu__item" onSelect={() => window.open(import.meta.env.BASE_URL, '_blank', 'noopener')}>
            <ExternalLink className="cd-i" aria-hidden="true" />
            Abrir Cellula en otra pestaña
          </DropdownMenu.Item>
          <DropdownMenu.Item className="cd-menu__item" onSelect={reset}>
            <RotateCcw className="cd-i" aria-hidden="true" />
            Restablecer esta demo
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
