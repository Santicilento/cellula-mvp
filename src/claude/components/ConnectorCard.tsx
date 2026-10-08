import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronRight, LoaderCircle, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cancelConnecting, connectConnector, disconnectConnector } from '../store/controller'
import { openAuthPopup } from '../mcp/client'
import { useClaude } from '../store/store'
import type { Connector, PermissionMode } from '../store/types'

function StatusBadge({ status }: { status: Connector['status'] }) {
  if (status === 'connected') return <span className="cd-badge cd-badge--ok">Conectado</span>
  if (status === 'needs-auth') return <span className="cd-badge cd-badge--warn">Requiere autenticación</span>
  if (status === 'connecting') return <span className="cd-badge cd-badge--warn">Conectando…</span>
  if (status === 'error') return <span className="cd-badge cd-badge--error">Error de conexión</span>
  return <span className="cd-badge">Sin conectar</span>
}

function ToolPermissions({ connector }: { connector: Connector }) {
  const patch = useClaude((s) => s.patchConnector)
  const readOnly = connector.tools.filter((t) => t.readOnly)
  const write = connector.tools.filter((t) => !t.readOnly)

  const row = (t: Connector['tools'][number]) => {
    const mode: PermissionMode = connector.permissions[t.name] ?? (t.readOnly ? 'allow' : 'ask')
    return (
      <div key={t.name} className="cd-toolperm__row">
        <div>
          <b>{t.title}</b>
          <code>{t.name}</code>
          <p>{t.description}</p>
        </div>
        <select
          className="cd-select"
          value={mode}
          aria-label={`Permiso para ${t.title}`}
          onChange={(e) => patch(connector.id, { permissions: { ...connector.permissions, [t.name]: e.target.value as PermissionMode } })}
        >
          <option value="ask">Preguntar siempre</option>
          <option value="allow">Permitir siempre</option>
        </select>
      </div>
    )
  }

  return (
    <div className="cd-toolperm">
      {readOnly.length > 0 && <h4>Herramientas de solo lectura</h4>}
      {readOnly.map(row)}
      {write.length > 0 && <h4>Herramientas que modifican cosas</h4>}
      {write.map(row)}
    </div>
  )
}

/** Un conector en Configuración → Conectores. */
export function ConnectorCard({ connector: c }: { connector: Connector }) {
  const remove = useClaude((s) => s.removeConnector)
  const [showTools, setShowTools] = useState(false)

  async function connect() {
    // La ventana tiene que abrirse en este mismo clic, antes de cualquier espera, o el navegador la bloquea.
    const popup = openAuthPopup()
    await connectConnector(c.id, popup)
  }

  return (
    <div className="cd-conn">
      <div className="cd-conn__row">
        <span className="cd-conn__logo" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span>
        <div className="cd-conn__text">
          <b>{c.name} <StatusBadge status={c.status} /></b>
          <span title={c.url}>{c.url}</span>
        </div>
        {c.status === 'connecting' ? (
          <>
            <LoaderCircle className="cd-i cd-spin" aria-hidden="true" />
            <button type="button" className="cd-btn" onClick={() => cancelConnecting(c.id)}>Cancelar</button>
          </>
        ) : c.status === 'connected' ? (
          <button type="button" className="cd-btn" onClick={() => void disconnectConnector(c.id)}>Desconectar</button>
        ) : (
          <button type="button" className="cd-btn cd-btn--clay" onClick={() => void connect()}>
            {c.status === 'needs-auth' ? 'Reconectar' : 'Conectar'}
          </button>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="cd-iconbtn" aria-label={`Más opciones de ${c.name}`}><MoreHorizontal className="cd-i" aria-hidden="true" /></button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="cd-menu" align="end" sideOffset={6} style={{ minWidth: 200 }}>
              <DropdownMenu.Item
                className="cd-menu__item cd-menu__item--danger"
                onSelect={async () => {
                  if (c.status === 'connected') await disconnectConnector(c.id)
                  remove(c.id)
                  toast(`Quitaste ${c.name}`)
                }}
              >
                <Trash2 className="cd-i" aria-hidden="true" />
                Quitar conector
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {c.status === 'connecting' && (
        <p className="cd-conn__info" role="status">Esperando que autorices a Claude en la ventana de Cellula. Si no se abrió, revisá que el navegador no la haya bloqueado.</p>
      )}
      {c.error && c.status !== 'connecting' && <p className="cd-conn__error" role="alert">{c.error}</p>}

      {c.status === 'connected' && c.tools.length > 0 && (
        <div className="cd-conn__tools">
          <button type="button" className="cd-conn__toggle" aria-expanded={showTools} onClick={() => setShowTools((v) => !v)}>
            <ChevronRight className="cd-i" aria-hidden="true" />
            Herramientas y permisos ({c.tools.length})
          </button>
          {showTools && <ToolPermissions connector={c} />}
        </div>
      )}
    </div>
  )
}
