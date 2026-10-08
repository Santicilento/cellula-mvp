import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, TriangleAlert, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { MCP_URL } from '../../lib/agents'
import { useClaude } from '../store/store'

/** "Agregar conector personalizado": nombre y dirección de un servidor MCP remoto. */
export function AddConnectorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const connectors = useClaude((s) => s.connectors)
  const addConnector = useClaude((s) => s.addConnector)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({})

  function reset() {
    setName('')
    setUrl('')
    setClientId('')
    setAdvanced(false)
    setErrors({})
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: { name?: string; url?: string } = {}
    const cleanUrl = url.trim()
    if (!name.trim()) next.name = 'Ponele un nombre al conector.'
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(cleanUrl)) next.url = 'Pegá la dirección completa del servidor, que empieza con https://'
    else if (connectors.some((c) => c.url.replace(/\/+$/, '') === cleanUrl.replace(/\/+$/, ''))) next.url = 'Ya agregaste un conector con esa dirección.'
    setErrors(next)
    if (next.name || next.url) return
    addConnector(name.trim(), cleanUrl, clientId.trim())
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="cd-overlay" />
        <Dialog.Content className="cd-dialog" aria-describedby="add-conn-desc">
          <Dialog.Title asChild><h2>Agregar conector personalizado</h2></Dialog.Title>
          <Dialog.Description asChild>
            <p id="add-conn-desc">Conectá Claude con las herramientas de tu equipo mediante un servidor MCP remoto.</p>
          </Dialog.Description>
          <form className="cd-form" onSubmit={submit} noValidate>
            <div className="cd-field">
              <label htmlFor="conn-name">Nombre</label>
              <input id="conn-name" className="cd-input" placeholder="Por ejemplo: Cellula" value={name} aria-invalid={errors.name ? true : undefined}
                onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })) }} autoFocus />
              {errors.name && <span className="cd-field__error" role="alert">{errors.name}</span>}
            </div>
            <div className="cd-field">
              <label htmlFor="conn-url">URL del servidor MCP remoto</label>
              <input id="conn-url" className="cd-input" placeholder="https://mcp.ejemplo.com/mcp" value={url} inputMode="url" aria-invalid={errors.url ? true : undefined}
                onChange={(e) => { setUrl(e.target.value); setErrors((x) => ({ ...x, url: undefined })) }} />
              {errors.url ? (
                <span className="cd-field__error" role="alert">{errors.url}</span>
              ) : (
                <button type="button" className="cd-linkbtn" onClick={() => { setName((n) => n || 'Cellula'); setUrl(MCP_URL); setErrors({}) }}>
                  Usar la dirección de Cellula
                </button>
              )}
            </div>
            <div>
              <button type="button" className="cd-conn__toggle" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
                <ChevronRight className="cd-i" aria-hidden="true" />
                Configuración avanzada
              </button>
              {advanced && (
                <div className="cd-field" style={{ marginTop: 10 }}>
                  <label htmlFor="conn-client">ID de cliente OAuth (opcional)</label>
                  <input id="conn-client" className="cd-input" placeholder="Si el servidor lo pide" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                  <span className="cd-field__help">Si lo dejás vacío, Claude se registra solo.</span>
                </div>
              )}
            </div>
            <div className="cd-warning">
              <TriangleAlert className="cd-i" aria-hidden="true" />
              <span>Agregá solo conectores de desarrolladores en los que confíes. Claude puede usar sus herramientas para leer o cambiar información por vos.</span>
            </div>
            <div className="cd-dialog__actions">
              <Dialog.Close asChild><button type="button" className="cd-btn">Cancelar</button></Dialog.Close>
              <button type="submit" className="cd-btn cd-btn--primary">Agregar</button>
            </div>
          </form>
          <Dialog.Close asChild>
            <button type="button" className="cd-iconbtn" aria-label="Cerrar" style={{ position: 'absolute', top: 14, right: 14 }}><X className="cd-i" aria-hidden="true" /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
