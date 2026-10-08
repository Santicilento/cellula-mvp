// El "cerebro" guionado de la demo: dado lo que escribió la persona, decide qué hace Claude y lo va emitiendo como eventos
// (pensando, texto que se escribe de a poco, pedido de permiso, uso de una herramienta de Cellula, artefacto…).
//
// No hay un modelo de lenguaje: las respuestas son siempre las mismas para el mismo pedido. Lo que sí es de verdad es el
// uso del conector: cada herramienta se llama por MCP y el resultado sale del backend fake de Cellula.
// El runner no sabe nada de React ni del store: recibe dependencias (TurnDeps) y emite eventos, así se puede probar solo.

import type { Role } from '../../api/types'
import { dayTime, slugify } from '../../lib/format'
import { McpAuthError, type ToolResult } from '../mcp/client'
import type { Artifact, Decision, Part, PendingAction, PermissionMode } from '../store/types'
import { DEMO_PROMPT } from '../store/types'
import { detectIntent, fold, type Intent } from './intents'
import * as say from './scripts'

export type ConnectorState = 'ready' | 'missing' | 'needs-auth' | 'disabled'

export interface ToolInfo {
  title: string
  readOnly: boolean
  destructive: boolean
  mode: PermissionMode
}

export type RunEvent =
  | { kind: 'thinking'; label: string | null }
  | { kind: 'text'; chunk: string }
  | { kind: 'part'; part: Part }
  | { kind: 'patch'; id: string; patch: Partial<Part> }
  | { kind: 'artifact'; artifact: Artifact }
  | { kind: 'chat'; patch: { title?: string; lastApp?: string | null; pending?: PendingAction | null } }
  | { kind: 'auth-lost' }

type PermissionPart = Extract<Part, { type: 'permission' }>

export interface TurnDeps {
  input: string
  chat: { hasArtifact: boolean; lastApp: string | null; pending: PendingAction | null }
  connector: {
    state: ConnectorState
    name: string
    tool(name: string): ToolInfo
  }
  links: say.Links
  call(tool: string, args: Record<string, unknown>): Promise<ToolResult>
  /** Espera la decisión de la persona sobre un permiso ya mostrado. */
  ask(part: PermissionPart): Promise<Decision>
  emit(e: RunEvent): void
  /** Espera (y se corta si se detiene la respuesta). */
  sleep(ms: number): Promise<void>
  uid(prefix: string): string
}

interface AppRow {
  name: string
  slug: string
  url: string
  status: 'active' | 'publishing' | 'error'
  people: number
}

const STATUS_LABEL = { active: 'Activa', publishing: 'Publicando', error: 'Con error' } as const

class Turn {
  private needsBreak = false
  private d: TurnDeps

  constructor(deps: TurnDeps) {
    this.d = deps
  }

  // ───────────── piezas básicas ─────────────

  private part(part: Part) {
    this.d.emit({ kind: 'part', part })
    this.needsBreak = false
  }

  private patch(id: string, patch: Partial<Part>) {
    this.d.emit({ kind: 'patch', id, patch })
  }

  private async think(label: string, ms: number) {
    this.d.emit({ kind: 'thinking', label })
    if (ms > 0) await this.d.sleep(ms)
  }

  /** Escribe el texto de a poco, como cuando Claude responde. */
  private async say(text: string) {
    this.d.emit({ kind: 'thinking', label: null })
    if (this.needsBreak) this.d.emit({ kind: 'text', chunk: '\n\n' })
    const tokens = text.match(/\S+\s*|\s+/g) ?? []
    let buffer = ''
    let n = 0
    for (const token of tokens) {
      buffer += token
      n++
      if (n % 2 === 0) {
        this.d.emit({ kind: 'text', chunk: buffer })
        buffer = ''
        await this.d.sleep(20)
      }
    }
    if (buffer) this.d.emit({ kind: 'text', chunk: buffer })
    this.needsBreak = true
  }

  private actions(items: Extract<Part, { type: 'actions' }>['items']) {
    this.part({ type: 'actions', items })
  }

  private connectChip() {
    this.actions([{ id: this.d.uid('act'), label: 'Abrir conectores', kind: 'open-connectors' }])
  }

  // ───────────── conector de Cellula ─────────────

  /** Revisa que Cellula esté lista; si no, explica qué falta. */
  private async requireCellula(forWhat: string): Promise<boolean> {
    switch (this.d.connector.state) {
      case 'ready':
        return true
      case 'missing':
        await this.say(say.needsConnector(forWhat))
        this.connectChip()
        return false
      case 'needs-auth':
        await this.say(say.needsAuth())
        this.connectChip()
        return false
      case 'disabled':
        await this.say(say.connectorDisabled())
        this.connectChip()
        return false
    }
  }

  /** Usa una herramienta del conector: pide permiso si hace falta, muestra el bloque de uso y devuelve el resultado. */
  private async useTool(name: string, args: Record<string, unknown>, deniedAction: string): Promise<ToolResult | null> {
    const d = this.d
    const info = d.connector.tool(name)

    if (info.mode === 'ask') {
      d.emit({ kind: 'thinking', label: null })
      const part: PermissionPart = {
        type: 'permission', id: d.uid('perm'), connectorName: d.connector.name, tool: name, title: info.title, args, decision: 'pending',
      }
      this.part(part)
      const decision = await d.ask(part)
      this.patch(part.id, { decision })
      if (decision === 'deny') {
        await this.say(say.denied(deniedAction))
        return null
      }
    }

    const id = d.uid('tool')
    this.part({ type: 'tool', id, connectorName: d.connector.name, tool: name, title: info.title, args, status: 'running' })
    d.emit({ kind: 'thinking', label: `Usando ${info.title.toLowerCase()}…` })
    try {
      const res = await d.call(name, args)
      this.patch(id, { status: res.isError ? 'error' : 'done', resultText: res.text, data: res.data ?? undefined })
      d.emit({ kind: 'thinking', label: null })
      return res
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      if (e instanceof McpAuthError) {
        this.patch(id, { status: 'error', resultText: 'Falta autorizar el conector (401).' })
        d.emit({ kind: 'auth-lost' })
        await this.say(say.needsAuth())
        this.connectChip()
        return null
      }
      this.patch(id, { status: 'error', resultText: e instanceof Error ? e.message : 'Error desconocido.' })
      await this.say(say.toolFailed(e instanceof Error ? e.message : 'algo salió mal.'))
      return null
    }
  }

  /** Cuenta qué le pasó a una herramienta que devolvió un error de negocio. */
  private async explainError(res: ToolResult) {
    const code = (res.data as { error?: string } | null)?.error
    if (code === 'trial_locked') await this.say(say.trialLocked(this.d.links))
    else if (code === 'not_found') await this.say(say.appNotFound(res.text))
    else await this.say(say.toolFailed(res.text))
  }

  private rows(res: ToolResult): AppRow[] {
    const raw = (res.data as { apps?: { name: string; slug: string; url: string; status: AppRow['status']; people: number }[] } | null)?.apps ?? []
    return raw.map((a) => ({ name: a.name, slug: a.slug, url: a.url, status: a.status, people: a.people }))
  }

  /** Cuando falta saber en qué app, muestra las apps como opciones para tocar. */
  private async chooseApp(verb: string, message: (appName: string) => string) {
    const res = await this.useTool('list_apps', {}, 'miré tus apps')
    if (!res) return
    if (res.isError) return this.explainError(res)
    const apps = this.rows(res)
    if (apps.length === 0) return this.say(say.listEmpty())
    await this.say(say.askWhichApp(verb))
    this.actions(apps.map((a) => ({ id: this.d.uid('act'), label: a.name, kind: 'send' as const, text: message(a.name) })))
  }

  // ───────────── flujos ─────────────

  async run() {
    const intent = detectIntent(this.d.input)
    await this.d.sleep(250)
    switch (intent.kind) {
      case 'build': return this.build()
      case 'publish': return this.publish(intent)
      case 'grant': return this.grant(intent)
      case 'revoke': return this.revoke(intent)
      case 'list_apps': return this.listApps()
      case 'activity': return this.activity(intent)
      case 'status': return this.status()
      case 'connect_help': return this.connectHelp()
      case 'confirm': return this.confirm()
      case 'deny': return this.deny()
      case 'greeting': return this.greeting()
      case 'fallback': return this.fallback()
    }
  }

  private async build() {
    const d = this.d
    await this.think('Pensando…', 900)
    await this.say(say.buildIntro())
    const artifact: Artifact = { id: d.uid('art'), title: 'Agenda de clases', kind: 'agenda-yoga' }
    d.emit({ kind: 'artifact', artifact })
    this.part({ type: 'artifact', artifactId: artifact.id })
    d.emit({ kind: 'chat', patch: { title: 'App de reservas de yoga', lastApp: artifact.title, pending: { kind: 'publish', appName: artifact.title } } })
    await this.d.sleep(350)
    await this.say(say.buildFeatures())

    if (d.connector.state === 'ready') {
      await this.say(say.offerPublish())
      this.actions([{ id: d.uid('act'), label: 'Publicar con Cellula', kind: 'send', text: 'Publicá esta app en Cellula' }])
    } else if (d.connector.state === 'needs-auth') {
      await this.say(say.needsAuth())
      this.connectChip()
    } else if (d.connector.state === 'disabled') {
      await this.say(say.connectorDisabled())
      this.connectChip()
    } else {
      await this.say(say.suggestCellula())
      this.connectChip()
    }
  }

  private async publish(intent: Intent) {
    const d = this.d
    const named = intent.app ?? d.chat.lastApp
    const appName = named ?? 'Agenda de clases'
    if (!(await this.requireCellula('publicar tu app'))) return

    await this.think('Pensando…', 500)
    await this.say(say.publishStart(appName, !named))
    await this.publishAfterCheck(appName)
  }

  private async publishCall(appName: string, mode: 'new' | 'version') {
    const d = this.d
    if (mode === 'version') await this.say(say.publishVersionStart(appName))

    const res = await this.useTool('publish_app', { name: appName, folder: `${slugify(appName) || 'app'}.zip` }, 'publiqué nada')
    if (!res) return
    if (res.isError) return this.explainError(res)

    const out = res.data as { app: { name: string; slug: string; url: string }; mode: 'new' | 'version' }
    const { name, slug, url } = out.app

    // Seguir el avance hasta que quede online (se ve en vivo en el bloque de la herramienta).
    const info = d.connector.tool('get_publish_status')
    const id = d.uid('tool')
    this.part({ type: 'tool', id, connectorName: d.connector.name, tool: 'get_publish_status', title: info.title, args: { app: slug }, status: 'running', progress: { label: 'Preparando…', percent: 0 } })
    d.emit({ kind: 'thinking', label: 'Publicando en Cellula…' })

    let status = 'publishing'
    let text = ''
    try {
      for (let i = 0; i < 80 && status === 'publishing'; i++) {
        await d.sleep(700)
        const poll = await d.call('get_publish_status', { app: slug })
        const data = (poll.data ?? {}) as { status?: string; stage?: number | null; percent?: number | null }
        status = data.status ?? 'error'
        text = poll.text
        if (status === 'publishing') {
          const label = data.stage === 1 ? 'Preparando…' : data.stage === 3 ? 'Activando el acceso privado…' : `Publicando… ${data.percent ?? 0} %`
          this.patch(id, { progress: { label, percent: data.stage === 3 ? 100 : (data.percent ?? 0) } })
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      this.patch(id, { status: 'error', resultText: e instanceof Error ? e.message : 'Error desconocido.', progress: undefined })
      if (e instanceof McpAuthError) {
        d.emit({ kind: 'auth-lost' })
        await this.say(say.needsAuth())
        this.connectChip()
      } else {
        await this.say(say.toolFailed('se cortó la conexión con Cellula.'))
      }
      return
    }

    this.patch(id, { status: status === 'active' ? 'done' : 'error', resultText: text, progress: undefined })
    d.emit({ kind: 'thinking', label: null })
    d.emit({ kind: 'chat', patch: { lastApp: name, pending: null } })
    if (status === 'active') await this.say(say.published(name, url, slug, out.mode, d.links))
    else await this.say(say.publishStatus(name, status, url, null))
  }

  private async grant(intent: Intent) {
    const d = this.d
    if (!(await this.requireCellula('darle acceso a alguien'))) return
    const role = intent.role ?? 'ver'
    const appName = intent.app ?? d.chat.lastApp
    if (!intent.email) {
      await this.say(say.askEmail())
      return
    }
    const email = intent.email
    if (!appName) {
      await this.chooseApp('le doy acceso', (app) => `Dale acceso de ${roleWord(role)} a ${email} en ${app}`)
      return
    }
    await this.think('Pensando…', 400)
    await this.say(say.grantStart(email, role, intent.roleExplicit === true, appName))
    const res = await this.useTool('grant_access', { app: appName, email, role }, 'di acceso a nadie')
    if (!res) return
    if (res.isError) return this.explainError(res)
    const out = res.data as { app: string; app_slug: string; person: { name: string; email: string; role: Role } }
    d.emit({ kind: 'chat', patch: { lastApp: out.app } })
    await this.say(say.granted(out.person.name, out.person.email, out.person.role, out.app, out.app_slug, d.links))
  }

  private async revoke(intent: Intent) {
    const d = this.d
    if (!(await this.requireCellula('quitarle el acceso a alguien'))) return
    if (!intent.person) {
      await this.say(say.askPerson())
      return
    }
    const person = intent.person
    const appName = intent.app ?? d.chat.lastApp
    if (!appName) {
      await this.chooseApp('le quito el acceso', (app) => `Quitale el acceso a ${person} en ${app}`)
      return
    }
    await this.think('Pensando…', 400)
    await this.say(say.revokeStart(person, appName))
    const res = await this.useTool('revoke_access', { app: appName, person }, 'quité el acceso a nadie')
    if (!res) return
    if (res.isError) return this.explainError(res)
    const out = res.data as { app: string; app_slug: string; person: { name: string } }
    d.emit({ kind: 'chat', patch: { lastApp: out.app } })
    await this.say(say.revoked(out.person.name, out.app, out.app_slug, d.links))
  }

  private async listApps() {
    if (!(await this.requireCellula('mostrarte tus apps'))) return
    await this.think('Pensando…', 300)
    await this.say(say.listIntro())
    const res = await this.useTool('list_apps', {}, 'miré tus apps')
    if (!res) return
    if (res.isError) return this.explainError(res)
    const apps = this.rows(res)
    if (apps.length === 0) return this.say(say.listEmpty())
    const table = [
      '| App | Link | Estado | Personas |',
      '|---|---|---|---|',
      ...apps.map((a) => `| **${a.name}** | [${a.url}](${this.d.links.gate(a.slug)}) | ${STATUS_LABEL[a.status]} | ${a.people} |`),
    ].join('\n')
    await this.say(`Tenés ${apps.length} ${apps.length === 1 ? 'app' : 'apps'}, todas privadas:\n\n${table}\n\nSi querés, publico una nueva, doy acceso o te cuento quién entró.`)
    this.d.emit({ kind: 'chat', patch: { lastApp: this.d.chat.lastApp ?? apps[0].name } })
  }

  private async activity(intent: Intent) {
    if (!(await this.requireCellula('ver la actividad'))) return
    const app = intent.app ?? null
    const days = intent.days ?? 7
    await this.think('Pensando…', 300)
    await this.say(say.activityIntro(app, days, intent.onlyEntries === true))
    const res = await this.useTool('get_activity', { ...(app ? { app } : {}), days }, 'miré la actividad')
    if (!res) return
    if (res.isError) return this.explainError(res)
    let events = ((res.data as { events?: { text: string; app: string; who: string; at: string }[] } | null)?.events ?? [])
    if (intent.onlyEntries) events = events.filter((e) => e.text.includes('entró'))
    if (events.length === 0) {
      await this.say(intent.onlyEntries ? 'En ese período no entró nadie.' : 'No hubo movimientos en ese período.')
      return
    }
    const bullets = events.map((e) => `- **${e.text}** · ${e.app} · ${e.who} · ${dayTime(e.at)}`).join('\n')
    await this.say(`${intent.onlyEntries ? 'Esto es lo que encontré:' : 'Esto pasó:'}\n\n${bullets}`)
  }

  private async status() {
    const appName = this.d.chat.lastApp
    if (!(await this.requireCellula('ver cómo va la publicación'))) return
    if (!appName) {
      await this.chooseApp('miro la publicación', (app) => `¿Cómo va la publicación de ${app}?`)
      return
    }
    const res = await this.useTool('get_publish_status', { app: appName }, 'miré la publicación')
    if (!res) return
    if (res.isError) return this.explainError(res)
    const data = res.data as { name: string; status: string; url: string; stage: number | null; percent: number | null }
    const detail = data.stage === 2 ? `${data.percent} %` : data.stage === 1 ? 'preparando' : data.stage === 3 ? 'activando el acceso privado' : null
    await this.say(say.publishStatus(data.name, data.status, data.url, detail))
  }

  private async connectHelp() {
    await this.think('Pensando…', 400)
    if (this.d.connector.state === 'ready') {
      await this.say(say.alreadyConnected())
      return
    }
    await this.say(say.connectHelp())
    this.connectChip()
  }

  private async confirm() {
    const pending = this.d.chat.pending
    if (!pending) return this.say(say.nothingToConfirm())
    if (pending.kind === 'publish') {
      if (!(await this.requireCellula('publicar tu app'))) return
      await this.say(say.publishStart(pending.appName, false))
      await this.publishAfterCheck(pending.appName)
      return
    }
    if (!(await this.requireCellula('publicar tu app'))) return
    this.d.emit({ kind: 'chat', patch: { pending: null } })
    await this.publishCall(pending.appName, 'version')
  }

  /** Publica una app nueva, o avisa si ya existe (misma comprobación que "Publicá esta app"). */
  private async publishAfterCheck(appName: string) {
    const list = await this.useTool('list_apps', {}, 'miré tus apps')
    if (!list) return
    if (list.isError) return this.explainError(list)
    const existing = this.rows(list).find((a) => fold(a.name) === fold(appName) || a.slug === slugify(appName))
    if (existing?.status === 'publishing') return this.say(say.alreadyPublishing(existing.name))
    if (existing) {
      this.d.emit({ kind: 'chat', patch: { lastApp: existing.name, pending: { kind: 'publish-version', appName: existing.name } } })
      await this.say(say.alreadyPublished(existing.name, existing.url))
      this.actions([{ id: this.d.uid('act'), label: 'Sí, publicar versión nueva', kind: 'send', text: 'Sí, publicá la versión nueva' }])
      return
    }
    await this.publishCall(appName, 'new')
  }

  private async deny() {
    this.d.emit({ kind: 'chat', patch: { pending: null } })
    await this.say(say.nothingPending())
  }

  private async greeting() {
    await this.say(say.greeting())
    this.suggestions()
  }

  private async fallback() {
    await this.think('Pensando…', 500)
    await this.say(say.fallback(this.d.connector.state === 'ready'))
    this.suggestions()
  }

  private suggestions() {
    const d = this.d
    const items: Extract<Part, { type: 'actions' }>['items'] = [
      { id: d.uid('act'), label: 'Armar una app de yoga', kind: 'send', text: DEMO_PROMPT },
    ]
    if (d.connector.state === 'ready') {
      items.push({ id: d.uid('act'), label: 'Mostrar mis apps', kind: 'send', text: 'Mostrame mis apps en Cellula' })
      items.push({ id: d.uid('act'), label: 'Publicar con Cellula', kind: 'send', text: 'Publicá esta app en Cellula' })
    } else {
      items.push({ id: d.uid('act'), label: '¿Cómo conecto Cellula?', kind: 'send', text: '¿Cómo conecto Cellula?' })
    }
    this.actions(items)
  }
}

function roleWord(role: Role): string {
  return role === 'administrar' ? 'Administrar' : role === 'usar' ? 'Usar' : 'Ver'
}

/** Corre un turno de la charla: lo que Claude contesta (y hace) frente a un mensaje. */
export async function runTurn(deps: TurnDeps): Promise<void> {
  await new Turn(deps).run()
}
