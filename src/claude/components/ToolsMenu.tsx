import * as Popover from '@radix-ui/react-popover'
import * as Switch from '@radix-ui/react-switch'
import { Plug, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClaude } from '../store/store'
import type { Connector } from '../store/types'

function statusText(c: Connector): string {
  if (c.status === 'connected') return `${c.tools.length} herramientas`
  if (c.status === 'needs-auth') return 'Requiere autenticación'
  if (c.status === 'connecting') return 'Conectando…'
  return 'Sin conectar'
}

/** El botón de herramientas del compositor: conectores activos y acceso a su configuración. */
export function ToolsMenu() {
  const connectors = useClaude((s) => s.connectors)
  const patch = useClaude((s) => s.patchConnector)
  const navigate = useNavigate()
  const active = connectors.filter((c) => c.status === 'connected' && c.enabled).length

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="cd-composer__tools" aria-label="Herramientas y conectores">
          <Settings2 className="cd-i" aria-hidden="true" />
          {active > 0 && <span className="cd-badge-dot" aria-hidden="true" />}
          <span>{active > 0 ? `${active} ${active === 1 ? 'conector' : 'conectores'}` : 'Herramientas'}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="cd-menu" side="top" align="start" sideOffset={8} collisionPadding={12} style={{ width: 300 }}>
          <div className="cd-menu__title">Conectores</div>
          {connectors.length === 0 ? (
            <div className="cd-toolrow">
              <div className="cd-toolrow__text">
                <b>Todavía no agregaste ninguno</b>
                <span>Con un conector, Claude puede usar tus herramientas, como Cellula.</span>
              </div>
            </div>
          ) : (
            connectors.map((c) => (
              <div key={c.id} className="cd-toolrow">
                <Plug className="cd-i" aria-hidden="true" />
                <div className="cd-toolrow__text">
                  <b>{c.name}</b>
                  <span>{statusText(c)}</span>
                </div>
                <Switch.Root
                  className="cd-switch"
                  checked={c.enabled && c.status === 'connected'}
                  disabled={c.status !== 'connected'}
                  onCheckedChange={(enabled) => patch(c.id, { enabled })}
                  aria-label={`Usar ${c.name} en este chat`}
                >
                  <Switch.Thumb />
                </Switch.Root>
              </div>
            ))
          )}
          <div className="cd-menu__sep" />
          <Popover.Close asChild>
            <button type="button" className="cd-menu__item" onClick={() => navigate('/configuracion/conectores')}>
              <Settings2 className="cd-i" aria-hidden="true" />
              Administrar conectores
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
