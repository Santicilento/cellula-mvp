import { Check, ChevronRight, CircleAlert, LoaderCircle, Plug } from 'lucide-react'
import { useState } from 'react'
import type { Part } from '../store/types'

type ToolPart = Extract<Part, { type: 'tool' }>

/** Fila colapsable "Cellula · publicar app": lo que usó Claude, con la solicitud y la respuesta del conector. */
export function ToolBlock({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false)
  const state =
    part.status === 'running' ? (
      <span className="cd-tool__state"><LoaderCircle className="cd-i cd-spin" style={{ width: 15, height: 15 }} aria-hidden="true" />En curso</span>
    ) : part.status === 'done' ? (
      <span className="cd-tool__state cd-tool__state--done"><Check className="cd-i" style={{ width: 15, height: 15 }} aria-hidden="true" />Listo</span>
    ) : (
      <span className="cd-tool__state cd-tool__state--error"><CircleAlert className="cd-i" style={{ width: 15, height: 15 }} aria-hidden="true" />Error</span>
    )

  return (
    <div className="cd-tool">
      <button type="button" className="cd-tool__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="cd-tool__icon"><Plug className="cd-i" aria-hidden="true" /></span>
        <span className="cd-tool__name">
          {part.connectorName} · {part.title}
          <code>{part.tool}</code>
        </span>
        {state}
        <ChevronRight className="cd-i cd-tool__chev" aria-hidden="true" />
      </button>

      {part.progress && (
        <div className="cd-tool__progress" aria-live="polite">
          <p>{part.progress.label}</p>
          <div className="cd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={part.progress.percent ?? undefined}>
            <span style={{ width: `${part.progress.percent ?? 4}%` }} />
          </div>
        </div>
      )}

      {open && (
        <div className="cd-tool__body">
          <div>
            <p className="cd-tool__label">Solicitud</p>
            <pre className="cd-tool__code">{JSON.stringify(part.args, null, 2)}</pre>
          </div>
          <div>
            <p className="cd-tool__label">Respuesta</p>
            <pre className="cd-tool__code">
              {part.resultText ? part.resultText : part.status === 'running' ? 'Esperando la respuesta…' : '—'}
              {part.data ? `\n\n${JSON.stringify(part.data, null, 2)}` : ''}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
