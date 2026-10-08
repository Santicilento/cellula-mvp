import * as Tabs from '@radix-ui/react-tabs'
import { Activity, MousePointer2, Plug as PlugIcon, Sparkles, Unplug } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAgent, useDisconnectAgent, useTestAgent } from '../api/queries'
import type { AgentConnection, AgentTestResult, AgentTool } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { CodeBlock } from '../components/ui/CodeBlock'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { CopyIconButton } from '../components/ui/CopyButton'
import { Skeleton } from '../components/ui/Skeleton'
import { ago, clock } from '../lib/format'
import { usePageTitle } from '../lib/usePageTitle'

const CLAUDE_CMD = 'claude mcp add --transport http cellula https://mcp.cellula.app/mcp'
const CURSOR_CFG = '{ "mcpServers": { "cellula": { "url": "https://mcp.cellula.app/mcp" } } }'

const PHRASES = [
  '«Publicá esta app en Cellula»',
  '«Dale acceso de Ver a ana@ejemplo.com»',
  '«Quitale el acceso a Pablo Herrera en Control de stock»',
  '«¿Quién entró a Turnos del consultorio esta semana?»',
]

interface Step {
  title: string
  text?: string
  code?: string
}

const STEPS: Record<AgentTool, Step[]> = {
  claude: [
    { title: 'Copiá este comando', code: CLAUDE_CMD },
    { title: 'Pegalo en la terminal', text: 'Abrí la terminal (la ventana donde usás Claude Code), pegá el comando y apretá Enter.' },
    { title: 'Entrá a tu cuenta de Cellula', text: 'Abrí Claude Code, escribí /mcp, elegí Cellula y seguí los pasos en el navegador.' },
    { title: 'Probá que funcione', text: 'Escribile a tu agente: «Mostrame mis apps en Cellula». Si te responde con tu lista, ya está.' },
  ],
  cursor: [
    { title: 'Abrí los ajustes de Cursor', text: 'Abrí la sección MCP y agregá un servidor nuevo.' },
    { title: 'Pegá esta configuración', code: CURSOR_CFG },
    { title: 'Entrá a tu cuenta de Cellula', text: 'Cursor te va a pedir iniciar sesión. Aceptá y seguí los pasos en el navegador.' },
    { title: 'Probá que funcione', text: 'Escribile a tu agente: «Mostrame mis apps en Cellula». Si te responde con tu lista, ya está.' },
  ],
}

const TOOL_NAME: Record<AgentTool, string> = { claude: 'Claude Code', cursor: 'Cursor' }

/** "hoy, 09:18", "ayer", "hace 3 días". */
function usedLabel(iso: string): string {
  const when = ago(iso)
  return when === 'hoy' ? `hoy, ${clock(new Date(iso))}` : when
}

/** Conectar mi agente: pasos para Claude Code o Cursor, qué pedirle y agentes conectados. */
export default function Agente() {
  usePageTitle('Conectar mi agente')
  const agent = useAgent()
  const test = useTestAgent()
  const disconnect = useDisconnectAgent()
  const [tool, setTool] = useState<AgentTool>('claude')
  const [result, setResult] = useState<AgentTestResult | null>(null)
  const [target, setTarget] = useState<AgentConnection | null>(null)

  const connections = agent.data?.connections ?? []
  const current = connections.find((c) => c.tool === tool)

  function runTest() {
    setResult(null)
    test.mutate(tool, { onSuccess: setResult, onError: () => toast.error('No pudimos hacer la prueba. Probá de nuevo.') })
  }

  return (
    <div className="page">
      <PageHeader
        title="Conectar mi agente"
        subtitle="Conectalo una sola vez y tu agente puede publicar y dar permisos por vos. Todo lo que hace queda en Actividad."
      />

      <div className="agent-layout">
        <Tabs.Root value={tool} onValueChange={(v) => { setTool(v as AgentTool); setResult(null) }} className="cl-card agent-main">
          <div className="agent-main__head">
            <Tabs.List className="cl-seg" aria-label="Herramienta">
              <Tabs.Trigger value="claude" className="cl-seg__item">Claude Code</Tabs.Trigger>
              <Tabs.Trigger value="cursor" className="cl-seg__item">Cursor</Tabs.Trigger>
            </Tabs.List>
            {!agent.data ? null : current ? (
              <Badge tone="ok" dot>Conectado · {usedLabel(current.lastUsedAt)}</Badge>
            ) : (
              <Badge tone="warn">Sin conectar</Badge>
            )}
          </div>

          {(['claude', 'cursor'] as AgentTool[]).map((t) => (
            <Tabs.Content key={t} value={t} className="agent-steps-wrap">
              <ol className="cl-steps">
                {STEPS[t].map((s, i) => (
                  <li key={s.title} className="cl-step">
                    <span className="cl-step__n">{i + 1}</span>
                    <div className="agent-step">
                      <h3>{s.title}</h3>
                      {s.text && <p>{s.text}</p>}
                      {s.code && <CodeBlock code={s.code} />}
                    </div>
                  </li>
                ))}
              </ol>
            </Tabs.Content>
          ))}

          <div className="agent-main__test">
            <span>¿No sabés si quedó bien? Hacemos una prueba rápida.</span>
            <Button icon={<Activity className="cl-i" aria-hidden="true" />} onClick={runTest} disabled={test.isPending}>
              {test.isPending ? 'Probando…' : 'Probar conexión'}
            </Button>
          </div>
          {result && (
            <div role="status">
              <Banner tone={result.ok ? 'brand' : 'warn'} icon={result.ok ? PlugIcon : Unplug}>
                <strong>{result.ok ? 'Conexión lista.' : 'Todavía no conecta.'}</strong> {result.message}
              </Banner>
            </div>
          )}
        </Tabs.Root>

        <aside className="agent-side">
          <section className="cl-card side-card">
            <h2 className="side-title">Qué le podés pedir</h2>
            {PHRASES.map((p) => (
              <div key={p} className="cl-phrase">
                <span>{p}</span>
                <CopyIconButton text={p.replace(/^«|»$/g, '')} label="Copiar frase" />
              </div>
            ))}
          </section>

          <section className="cl-card side-card">
            <h2 className="side-title">Agentes conectados</h2>
            {!agent.data ? (
              <Skeleton style={{ height: 96 }} />
            ) : connections.length === 0 ? (
              <p className="muted">Todavía no conectaste ningún agente. Seguí los pasos de la izquierda.</p>
            ) : (
              <ul className="agent-list">
                {connections.map((c) => (
                  <li key={c.id}>
                    <span className="cl-ico cl-ico--square">
                      {c.tool === 'claude' ? <Sparkles className="cl-i" aria-hidden="true" /> : <MousePointer2 className="cl-i" aria-hidden="true" />}
                    </span>
                    <span className="agent-list__text">
                      <b>{TOOL_NAME[c.tool]}</b>
                      <span>{c.device} · usado {usedLabel(c.lastUsedAt)}</span>
                    </span>
                    <Button variant="danger-outline" size="sm" onClick={() => setTarget(c)} aria-label={`Desconectar ${TOOL_NAME[c.tool]}`}>
                      Desconectar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/como-funciona" className="side-link">¿Cómo funciona el conector?</Link>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        icon={Unplug}
        title={`¿Desconectar ${target ? TOOL_NAME[target.tool] : ''}?`}
        description={<>{target ? TOOL_NAME[target.tool] : 'Tu agente'} va a dejar de poder publicar apps y dar permisos por vos ahora mismo. Tus apps y accesos quedan como están.</>}
        hint="Si más adelante querés, podés volver a conectarlo con los mismos pasos."
        note={<><b>El cambio es inmediato.</b> No hace falta tocar nada en tu agente.</>}
        confirmLabel="Sí, desconectar"
        busy={disconnect.isPending}
        onConfirm={() => {
          if (!target) return
          const t = target
          disconnect.mutate(t.id, {
            onSuccess: () => {
              setTarget(null)
              setResult(null)
              toast.success(`Desconectamos ${TOOL_NAME[t.tool]}`)
            },
          })
        }}
      />
    </div>
  )
}
