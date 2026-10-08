import { describe, expect, it } from 'vitest'
import { seed, tick, type Db } from '../../mocks/db'
import { exchangeCode, handleMcp, TOOLS } from '../../mocks/mcp'
import { McpAuthError, type ToolResult } from '../mcp/client'
import type { Decision, Part, PendingAction } from '../store/types'
import { runTurn, type ConnectorState, type RunEvent, type TurnDeps } from './runner'

const START = new Date(2026, 9, 7, 12, 0, 0).getTime()

const links = {
  gate: (slug: string) => `/#/i/${slug}`,
  accesos: (slug: string) => `/#/apps/${slug}/accesos`,
  panel: '/#/apps',
  agente: '/#/agente',
}

interface Opts {
  scenario?: 'with-apps' | 'new-user'
  state?: ConnectorState
  hasArtifact?: boolean
  lastApp?: string | null
  pending?: PendingAction | null
  /** Decisiones sucesivas para los permisos (por defecto: permitir una vez). */
  decisions?: Decision[]
  authLost?: boolean
}

/** Un turno completo contra el backend MCP real, con reloj simulado: cada sleep() hace avanzar el tiempo. */
async function turn(input: string, opts: Opts = {}, shared?: { db: Db; token: string; clock: { now: number } }) {
  const db = shared?.db ?? seed(opts.scenario ?? 'with-apps', START)
  const clock = shared?.clock ?? { now: START }
  let token = shared?.token ?? ''
  if (!shared) {
    db.oauthCodes.push({ code: 'c', clientId: 'claude', createdAt: START })
    const res = exchangeCode(db, START, { grant_type: 'authorization_code', code: 'c', client_id: 'claude' })
    if (!res.ok) throw new Error('canje')
    token = res.access_token
  }
  const events: RunEvent[] = []
  const decisions = [...(opts.decisions ?? [])]
  const asked: string[] = []

  const deps: TurnDeps = {
    input,
    chat: { hasArtifact: opts.hasArtifact ?? false, lastApp: opts.lastApp ?? null, pending: opts.pending ?? null },
    connector: {
      state: opts.state ?? 'ready',
      name: 'Cellula',
      tool: (name) => {
        const t = TOOLS.find((x) => x.name === name)
        const readOnly = t?.annotations?.readOnlyHint === true
        return { title: t?.title ?? name, readOnly, destructive: t?.annotations?.destructiveHint === true, mode: readOnly ? 'allow' : 'ask' }
      },
    },
    links,
    call: async (tool, args): Promise<ToolResult> => {
      if (opts.authLost) throw new McpAuthError()
      tick(db, clock.now)
      const reply = handleMcp(db, clock.now, token, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } })
      if (reply.status === 401) throw new McpAuthError()
      const result = (reply.body as { result: { content: { text: string }[]; structuredContent: Record<string, unknown>; isError?: boolean } }).result
      return { text: result.content[0].text, data: result.structuredContent, isError: result.isError === true }
    },
    ask: async (part) => {
      asked.push(part.tool)
      return decisions.shift() ?? 'allow-once'
    },
    emit: (e) => events.push(e),
    sleep: async (ms) => {
      clock.now += ms
    },
    uid: (() => {
      let n = 0
      return (p: string) => `${p}_${++n}`
    })(),
  }
  await runTurn(deps)
  return { db, token, clock, events, asked }
}

const text = (events: RunEvent[]) => events.filter((e): e is Extract<RunEvent, { kind: 'text' }> => e.kind === 'text').map((e) => e.chunk).join('')
const parts = (events: RunEvent[]): Part[] => events.filter((e): e is Extract<RunEvent, { kind: 'part' }> => e.kind === 'part').map((e) => e.part)
const tools = (events: RunEvent[]) => parts(events).flatMap((p) => (p.type === 'tool' ? [p.tool] : []))
const chatPatches = (events: RunEvent[]) => events.filter((e): e is Extract<RunEvent, { kind: 'chat' }> => e.kind === 'chat').map((e) => e.patch)
const actions = (events: RunEvent[]) => parts(events).flatMap((p) => (p.type === 'actions' ? p.items : []))

describe('armar la app (el prompt de la demo)', () => {
  it('crea el artefacto y, sin Cellula conectada, sugiere el conector con su dirección', async () => {
    const { events } = await turn('Armame una app para que mis alumnas reserven clases de yoga', { state: 'missing' })
    expect(events.some((e) => e.kind === 'artifact' && e.artifact.title === 'Agenda de clases')).toBe(true)
    expect(parts(events).some((p) => p.type === 'artifact')).toBe(true)
    expect(text(events)).toContain('Cellula')
    expect(text(events)).toContain('https://mcp.cellula.app/mcp')
    expect(actions(events).map((a) => a.kind)).toContain('open-connectors')
    expect(chatPatches(events)).toContainEqual(expect.objectContaining({ lastApp: 'Agenda de clases', pending: { kind: 'publish', appName: 'Agenda de clases' } }))
  })

  it('con Cellula conectada, ofrece publicarla con un botón', async () => {
    const { events } = await turn('Armame una app de yoga', { state: 'ready' })
    expect(text(events)).toContain('¿La publico?')
    expect(actions(events)).toContainEqual(expect.objectContaining({ kind: 'send', text: 'Publicá esta app en Cellula' }))
  })

  it('si la conexión venció, avisa y ofrece reconectar', async () => {
    const { events } = await turn('Armame una app de yoga', { state: 'needs-auth' })
    expect(text(events)).toContain('Perdí la conexión')
    expect(actions(events).map((a) => a.kind)).toContain('open-connectors')
  })
})

describe('publicar', () => {
  it('sin el conector, explica cómo agregarlo y no usa ninguna herramienta', async () => {
    const { events } = await turn('Publicá esta app en Cellula', { state: 'missing' })
    expect(tools(events)).toEqual([])
    expect(text(events)).toContain('Configuración → Conectores')
  })

  it('recorre el flujo completo: lista, pide permiso, publica, sigue el avance y devuelve el link', async () => {
    const { events, db, asked } = await turn('Publicá esta app en Cellula', { hasArtifact: true, lastApp: 'Agenda de clases', pending: { kind: 'publish', appName: 'Agenda de clases' } })

    // herramientas, en orden, con un único permiso (solo las que escriben lo piden)
    expect(tools(events)).toEqual(['list_apps', 'publish_app', 'get_publish_status'])
    expect(asked).toEqual(['publish_app'])
    expect(parts(events).map((p) => p.type)).toEqual(expect.arrayContaining(['permission', 'tool']))

    // resultado real en Cellula
    const app = db.apps.find((a) => a.slug === 'agenda-de-clases')
    expect(app).toMatchObject({ status: 'active', origin: 'agent', lastAgentName: 'Claude' })
    expect(db.events.some((e) => e.appSlug === 'agenda-de-clases' && e.actor === 'agent' && e.agentName === 'Claude')).toBe(true)

    // el avance se ve en el bloque de la herramienta
    const progress = events.filter((e) => e.kind === 'patch' && (e.patch as { progress?: unknown }).progress)
    expect(progress.length).toBeGreaterThan(2)

    // la respuesta final lleva el link privado y sugiere invitar
    const answer = text(events)
    expect(answer).toContain('https://agenda-de-clases.cellula.app')
    expect(answer).toContain('/#/i/agenda-de-clases')
    expect(answer).toContain('privada')
    expect(answer).toContain('¿Querés que invite a alguien?')
    expect(chatPatches(events)).toContainEqual(expect.objectContaining({ lastApp: 'Agenda de clases', pending: null }))
  })

  it('si la persona rechaza el permiso, no se publica nada', async () => {
    const { events, db } = await turn('Publicá esta app en Cellula', { decisions: ['deny'] })
    expect(text(events)).toContain('no publiqué nada')
    expect(tools(events)).toEqual(['list_apps'])
    expect(db.apps.some((a) => a.slug === 'agenda-de-clases')).toBe(false)
  })

  it('con la prueba bloqueada explica cómo desbloquearla, con link a Cellula', async () => {
    const { events, db } = await turn('Publicá esta app en Cellula', { scenario: 'new-user' })
    expect(text(events)).toContain('prueba gratis')
    expect(text(events)).toContain('3 personas')
    expect(text(events)).toContain('/#/apps')
    expect(db.apps).toHaveLength(0)
    // la herramienta falló de verdad, y el bloque lo muestra como error
    expect(events.some((e) => e.kind === 'patch' && (e.patch as { status?: string }).status === 'error')).toBe(true)
  })

  it('si la app ya existe pregunta antes de publicar una versión nueva, y al confirmar la publica', async () => {
    const first = await turn('Publicá esta app en Cellula')
    const second = await turn('Publicá esta app en Cellula', { lastApp: 'Agenda de clases' }, first)
    expect(text(second.events)).toContain('¿Querés que publique una versión nueva')
    expect(tools(second.events)).toEqual(['list_apps'])
    const pending = chatPatches(second.events).find((p) => p.pending)?.pending
    expect(pending).toEqual({ kind: 'publish-version', appName: 'Agenda de clases' })

    const third = await turn('Sí', { lastApp: 'Agenda de clases', pending }, second)
    expect(tools(third.events)).toEqual(['publish_app', 'get_publish_status'])
    expect(text(third.events)).toContain('Publiqué la versión nueva')
  })

  it('publicar una app que ya está en Cellula (por nombre) también ofrece la versión nueva', async () => {
    const { events } = await turn('Publicá Control de stock en Cellula')
    expect(text(events)).toContain('ya está publicada')
  })

  it('"sí" sin nada pendiente no hace nada raro', async () => {
    const { events } = await turn('Sí')
    expect(tools(events)).toEqual([])
    expect(text(events)).toContain('nada pendiente')
  })
})

describe('dar y quitar acceso', () => {
  it('dar acceso: pide permiso, usa grant_access y queda en Cellula como acción del agente', async () => {
    const { events, db, asked } = await turn('Dale acceso de Usar a ines@ejemplo.com en Turnos del consultorio')
    expect(asked).toEqual(['grant_access'])
    expect(tools(events)).toEqual(['grant_access'])
    expect(db.access['turnos-consultorio'].find((a) => a.email === 'ines@ejemplo.com')).toMatchObject({ role: 'usar' })
    expect(db.events.find((e) => e.type === 'grant' && e.person === 'Ines')).toMatchObject({ actor: 'agent', agentName: 'Claude' })
    expect(text(events)).toContain('rol **Usar**')
    expect(text(events)).toContain('/#/apps/turnos-consultorio/accesos')
  })

  it('sin rol dicho usa Ver y lo aclara', async () => {
    const { events } = await turn('Dale acceso a ines@ejemplo.com en Turnos del consultorio')
    expect(text(events)).toContain('el más restrictivo')
  })

  it('sin email pregunta a quién', async () => {
    const { events } = await turn('Dale acceso a mi socia', { lastApp: 'Turnos del consultorio' })
    expect(tools(events)).toEqual([])
    expect(text(events)).toContain('¿A qué email')
  })

  it('sin app en la charla ofrece las apps para elegir', async () => {
    const { events } = await turn('Dale acceso de Ver a ines@ejemplo.com')
    expect(tools(events)).toEqual(['list_apps'])
    const choices = actions(events).filter((a) => a.kind === 'send')
    expect(choices.map((c) => c.label)).toContain('Turnos del consultorio')
    expect(choices[0]).toMatchObject({ text: expect.stringContaining('ines@ejemplo.com en ') })
  })

  it('quitar acceso: explica el efecto inmediato y la persona deja de figurar', async () => {
    const { events, db } = await turn('Quitale el acceso a Pablo Herrera en Control de stock')
    expect(db.access['control-stock'].some((a) => a.name === 'Pablo Herrera')).toBe(false)
    expect(text(events)).toContain('inmediato')
    expect(db.events.find((e) => e.type === 'revoke' && e.person === 'Pablo Herrera')).toMatchObject({ actor: 'agent' })
  })

  it('una persona que no existe se informa sin romper nada', async () => {
    const { events } = await turn('Quitale el acceso a Fulano en Control de stock')
    expect(text(events)).toContain('No encontré a «Fulano»')
  })

  it('si el permiso se rechaza, no se quita nada', async () => {
    const { db } = await turn('Quitale el acceso a Pablo Herrera en Control de stock', { decisions: ['deny'] })
    expect(db.access['control-stock'].some((a) => a.name === 'Pablo Herrera')).toBe(true)
  })
})

describe('consultas', () => {
  it('mostrar mis apps arma una tabla con las cuatro apps y no pide permiso (solo lectura)', async () => {
    const { events, asked } = await turn('Mostrame mis apps en Cellula')
    expect(asked).toEqual([])
    const answer = text(events)
    expect(answer).toContain('| App | Link | Estado | Personas |')
    expect(answer).toContain('Turnos del consultorio')
    expect(answer).toContain('Calculadora de envíos')
    expect(answer).toContain('/#/i/turnos-consultorio')
  })

  it('¿Quién entró? filtra los ingresos', async () => {
    const { events } = await turn('¿Quién entró a Turnos del consultorio esta semana?')
    const answer = text(events)
    expect(answer).toContain('entró a la app')
    expect(answer).not.toContain('Se le dio acceso')
  })

  it('actividad del agente después de usarlo', async () => {
    const first = await turn('Dale acceso de Ver a ines@ejemplo.com en Turnos del consultorio')
    const second = await turn('mostrame la actividad de Turnos del consultorio', {}, first)
    expect(text(second.events)).toContain('Claude (agente)')
  })
})

describe('problemas de conexión', () => {
  it('si Cellula contesta 401, avisa que hay que reconectar y lo marca en el estado', async () => {
    const { events } = await turn('Mostrame mis apps en Cellula', { authLost: true })
    expect(events.some((e) => e.kind === 'auth-lost')).toBe(true)
    expect(text(events)).toContain('Perdí la conexión')
    expect(actions(events).map((a) => a.kind)).toContain('open-connectors')
  })

  it('un token revocado en Cellula también se detecta', async () => {
    const first = await turn('Mostrame mis apps en Cellula')
    first.db.agents = first.db.agents.filter((a) => a.tool !== 'claude-web') // "Desconectar" desde Cellula
    const second = await turn('Mostrame mis apps en Cellula', {}, first)
    expect(second.events.some((e) => e.kind === 'auth-lost')).toBe(true)
  })

  it('detener la respuesta (abort) corta el turno', async () => {
    const controller = new AbortController()
    await expect(
      runTurn({
        input: 'Armame una app de yoga',
        chat: { hasArtifact: false, lastApp: null, pending: null },
        connector: { state: 'missing', name: 'Cellula', tool: () => ({ title: '', readOnly: true, destructive: false, mode: 'allow' }) },
        links,
        call: async () => {
          throw new Error('no debería llamarse')
        },
        ask: async () => 'allow-once',
        emit: () => controller.abort(),
        sleep: async () => controller.signal.throwIfAborted(),
        uid: (p) => p,
      }),
    ).rejects.toThrow()
  })
})

describe('conversación', () => {
  it('saludo y respuesta fija ofrecen sugerencias', async () => {
    const hi = await turn('Hola!')
    expect(text(hi.events)).toContain('¡Hola, Lucía!')
    expect(actions(hi.events).length).toBeGreaterThan(1)

    const other = await turn('¿Cuál es la capital de Francia?', { state: 'missing' })
    expect(text(other.events)).toContain('demo')
    expect(actions(other.events).some((a) => a.kind === 'send')).toBe(true)
  })

  it('ayuda para conectar y, si ya está conectada, lo que se puede pedir', async () => {
    const help = await turn('¿Cómo conecto Cellula?', { state: 'missing' })
    expect(text(help.events)).toContain('Agregar conector personalizado')
    const ready = await turn('¿Cómo conecto Cellula?', { state: 'ready' })
    expect(text(ready.events)).toContain('Ya tenés **Cellula** conectada')
  })

  it('rechazar una propuesta limpia lo pendiente', async () => {
    const { events } = await turn('no', { pending: { kind: 'publish', appName: 'Agenda de clases' } })
    expect(chatPatches(events)).toContainEqual({ pending: null })
  })
})
