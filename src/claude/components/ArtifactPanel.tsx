import * as Tabs from '@radix-ui/react-tabs'
import { Check, Copy, X } from 'lucide-react'
import { useState } from 'react'
import AgendaDeClases from '../artifacts/AgendaDeClases'
import agendaSource from '../artifacts/AgendaDeClases.tsx?raw'
import { copyText } from '../../lib/clipboard'
import { useRuntime } from '../store/controller'
import type { Artifact } from '../store/types'

/** Panel de la derecha: vista previa interactiva y código del artefacto. */
export function ArtifactPanel({ artifact }: { artifact: Artifact }) {
  const close = useRuntime((s) => s.closePanel)
  const [copied, setCopied] = useState(false)
  const lines = agendaSource.split('\n')

  return (
    <Tabs.Root defaultValue="preview" className="cd-panel">
      <div className="cd-panel__head">
        <div className="cd-panel__title">
          <b>{artifact.title}</b>
          <span>Artefacto interactivo · React</span>
        </div>
        <Tabs.List className="cd-tabs" aria-label="Vista del artefacto">
          <Tabs.Trigger value="preview" className="cd-tab">Vista previa</Tabs.Trigger>
          <Tabs.Trigger value="code" className="cd-tab">Código</Tabs.Trigger>
        </Tabs.List>
        <button
          type="button"
          className="cd-iconbtn"
          aria-label="Copiar código"
          onClick={async () => {
            if (await copyText(agendaSource)) {
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }
          }}
        >
          {copied ? <Check className="cd-i" aria-hidden="true" /> : <Copy className="cd-i" aria-hidden="true" />}
        </button>
        <button type="button" className="cd-iconbtn" aria-label="Cerrar el panel" onClick={close}>
          <X className="cd-i" aria-hidden="true" />
        </button>
      </div>
      <div className="cd-panel__body">
        <Tabs.Content value="preview"><AgendaDeClases /></Tabs.Content>
        <Tabs.Content value="code">
          <pre className="cd-code" aria-label="Código de la app">
            {lines.map((line, i) => (
              <div key={i}><span>{line || ' '}</span></div>
            ))}
          </pre>
        </Tabs.Content>
      </div>
    </Tabs.Root>
  )
}
