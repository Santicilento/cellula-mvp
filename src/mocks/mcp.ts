// Conector MCP de Cellula (falso, pero con el protocolo de verdad).
// El clon de Claude le habla a "https://mcp.cellula.app/mcp" con JSON-RPC 2.0 y un token Bearer, igual que un cliente MCP real.
// En el navegador, esas direcciones se atienden acá (ver src/claude/mcp/client.ts: reescribe el host a esta misma app).
//
// La lógica está separada en funciones puras (handleMcp, exchangeCode) para poder probarla sin navegador.

import { delay, http, HttpResponse } from 'msw'
import { AGENT_NAME } from '../lib/agents'
import { dayTime, plural, slugify } from '../lib/format'
import { ROLE_LABEL } from '../lib/roles'
import type { ActivityEvent, Role } from '../api/types'
import { nextId, type AgentRecord, type Db } from './db'
import { route, withDb } from './runtime'
import {
  findExactApp,
  grantAccess,
  listAccess,
  listActivity,
  listApps,
  publishApp,
  publishVersion,
  resolveApp,
  resolvePerson,
  revokeAccess,
  ServiceError,
  toApp,
  type Actor,
} from './service'

/** Prefijo propio de esta app para las rutas del "servidor MCP" (el cliente reescribe https://mcp.cellula.app a esto). */
export const mcpRoute = (path: string) => route(`/_mcp${path}`)

// ───────────── herramientas ─────────────

export interface McpTool {
  name: string
  title: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean }
}

const APP_PARAM = { type: 'string', description: 'Nombre o dirección de la app, por ejemplo «Agenda de clases».' }

export const TOOLS: McpTool[] = [
  {
    name: 'list_apps',
    title: 'Mostrar mis apps',
    description: 'Lista las apps que la persona tiene en Cellula, con su estado, su link y cuántas personas tienen acceso.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'publish_app',
    title: 'Publicar app',
    description:
      'Publica una app en Cellula y devuelve su link privado. Si ya existe una app con ese nombre, publica una versión nueva. La app queda privada: solo entran las personas invitadas.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la app, por ejemplo «Agenda de clases».' },
        folder: { type: 'string', description: 'Carpeta o archivo .zip con la app. Si no se indica, se usa el nombre.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_publish_status',
    title: 'Ver el estado de una publicación',
    description: 'Dice si una app ya está online o cuánto falta para que termine de publicarse.',
    inputSchema: { type: 'object', properties: { app: APP_PARAM }, required: ['app'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'grant_access',
    title: 'Dar acceso',
    description:
      'Invita a una persona por email a una app. Roles: ver (puede ver, sin cambiar nada), usar (puede ver y cargar datos) o administrar (puede todo, e invitar o quitar personas). Entra con su cuenta de Google o Microsoft.',
    inputSchema: {
      type: 'object',
      properties: {
        app: APP_PARAM,
        email: { type: 'string', description: 'Email de la persona a invitar.' },
        role: { type: 'string', enum: ['ver', 'usar', 'administrar'], description: 'Rol que va a tener.' },
        expires_at: { type: 'string', description: 'Fecha de vencimiento opcional, en formato aaaa-mm-dd.' },
      },
      required: ['app', 'email', 'role'],
    },
  },
  {
    name: 'revoke_access',
    title: 'Quitar acceso',
    description:
      'Quita el acceso de una persona a una app. El cambio es inmediato: en su próximo pedido, Cellula la rechaza, sin tocar la app ni volver a publicarla.',
    inputSchema: {
      type: 'object',
      properties: { app: APP_PARAM, person: { type: 'string', description: 'Nombre o email de la persona.' } },
      required: ['app', 'person'],
    },
    annotations: { destructiveHint: true },
  },
  {
    name: 'list_access',
    title: 'Ver quién tiene acceso',
    description: 'Lista las personas con acceso a una app, con su rol, vencimiento y último ingreso.',
    inputSchema: { type: 'object', properties: { app: APP_PARAM }, required: ['app'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_activity',
    title: 'Ver la actividad',
    description: 'Muestra quién entró, qué se publicó y qué permisos cambiaron. Se puede limitar a una app y a los últimos días.',
    inputSchema: {
      type: 'object',
      properties: {
        app: { ...APP_PARAM, description: 'Opcional: solo esta app.' },
        days: { type: 'number', description: 'Cuántos días mirar para atrás (1, 7 o 30). Por defecto 7.' },
      },
    },
    annotations: { readOnlyHint: true },
  },
]

interface ToolOutput {
  text: string
  data: unknown
  isError?: boolean
}

function guessSize(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 1_100_000 + (h % 2_100_000)
}

function eventText(e: ActivityEvent): string {
  switch (e.type) {
    case 'entry': return `${e.person} entró a la app`
    case 'grant': return `Se le dio acceso de ${e.role ? ROLE_LABEL[e.role] : ''} a ${e.person}`
    case 'role_change': return `El rol de ${e.person} pasó de ${e.fromRole ? ROLE_LABEL[e.fromRole] : ''} a ${e.role ? ROLE_LABEL[e.role] : ''}`
    case 'revoke': return `Se quitó el acceso de ${e.person}`
    case 'publishing': return 'Se está publicando una nueva versión'
    case 'published': return 'Se publicó una nueva versión'
  }
}

function who(e: ActivityEvent): string {
  if (e.actor === 'agent') return `${e.agentName ?? 'Tu agente'} (agente)`
  if (e.actor === 'panel') return 'Vos, desde el panel'
  return `Ingresó con ${e.provider === 'microsoft' ? 'Microsoft' : 'Google'}`
}

function callTool(db: Db, now: number, actor: Actor, name: string, args: Record<string, unknown>): ToolOutput {
  const str = (key: string): string => (typeof args[key] === 'string' ? (args[key] as string) : '')

  switch (name) {
    case 'list_apps': {
      const apps = listApps(db, now).map((a) => ({
        name: a.name, slug: a.slug, url: a.url, status: a.status, people: a.peopleCount, published_at: a.publishedAt, origin: a.origin,
      }))
      const text = apps.length === 0
        ? 'Todavía no hay apps publicadas.'
        : apps.map((a) => `• ${a.name} — ${a.url} — ${STATUS_TEXT[a.status]} — ${a.people} ${plural(a.people, 'persona', 'personas')} con acceso`).join('\n')
      return { text, data: { apps } }
    }

    case 'publish_app': {
      const appName = str('name').trim()
      const folder = str('folder').trim() || `${slugify(appName) || 'app'}.zip`
      const input = { name: appName, fileName: folder, fileSize: guessSize(folder) }
      const existing = findExactApp(db, appName)
      const app = existing ? publishVersion(db, now, actor, existing.slug, input) : publishApp(db, now, actor, input)
      const mode = existing ? 'version' : 'new'
      return {
        text: `${mode === 'version' ? 'Empezó a publicarse una versión nueva' : 'Empezó la publicación'} de «${app.name}». Link privado: https://${app.url}. Tarda unos segundos: consultá get_publish_status hasta que figure como activa.`,
        data: { app: { name: app.name, slug: app.slug, url: app.url, status: app.status }, mode },
      }
    }

    case 'get_publish_status': {
      const app = toApp(db, resolveApp(db, str('app')), now)
      const progress = app.publish
      const stageText = progress
        ? progress.stage === 1 ? 'Preparando' : progress.stage === 2 ? `Publicando (${progress.percent} %)` : 'Activando el acceso privado'
        : null
      return {
        text:
          app.status === 'active' ? `«${app.name}» ya está online y es privada: https://${app.url}` :
          app.status === 'publishing' ? `«${app.name}» se está publicando. Paso actual: ${stageText}.` :
          `«${app.name}» tiene un error y no está disponible.`,
        data: { name: app.name, slug: app.slug, url: app.url, status: app.status, stage: progress?.stage ?? null, percent: progress?.percent ?? null },
      }
    }

    case 'grant_access': {
      const app = resolveApp(db, str('app'))
      const role = str('role') as Role
      const entry = grantAccess(db, now, actor, app.slug, { email: str('email'), role, expiresAt: str('expires_at') || null })
      return {
        text: `Listo: ${entry.name} (${entry.email}) ya puede entrar a «${app.name}» con rol ${ROLE_LABEL[entry.role]}. Entra con su cuenta de Google o Microsoft.`,
        data: { app: app.name, app_slug: app.slug, person: { name: entry.name, email: entry.email, role: entry.role, expires_at: entry.expiresAt } },
      }
    }

    case 'revoke_access': {
      const app = resolveApp(db, str('app'))
      const person = resolvePerson(db, app.slug, str('person'))
      const removed = revokeAccess(db, now, actor, app.slug, person.id)
      return {
        text: `Se quitó el acceso de ${removed.name} a «${app.name}». El cambio es inmediato.`,
        data: { app: app.name, app_slug: app.slug, person: { name: removed.name, email: removed.email } },
      }
    }

    case 'list_access': {
      const app = resolveApp(db, str('app'))
      const people = listAccess(db, app.slug).map((p) => ({
        name: p.name, email: p.email, role: p.role, expires_at: p.expiresAt, last_entry_at: p.lastEntryAt, is_owner: p.isYou,
      }))
      const text = people
        .map((p) => `• ${p.name} (${p.email}) — ${ROLE_LABEL[p.role]} — ${p.last_entry_at ? `último ingreso ${dayTime(p.last_entry_at, new Date(now))}` : 'todavía no ingresó'}`)
        .join('\n')
      return { text, data: { app: app.name, app_slug: app.slug, people } }
    }

    case 'get_activity': {
      const app = str('app') ? resolveApp(db, str('app')) : null
      const days = typeof args.days === 'number' ? args.days : 7
      const range = days <= 1 ? 'today' : days <= 7 ? '7d' : '30d'
      const events = listActivity(db, now, { app: app?.slug, range }).slice(0, 15)
      const items = events.map((e) => ({ text: eventText(e), app: e.appName, who: who(e), at: e.at }))
      const text = items.length === 0
        ? 'No hubo movimientos en ese período.'
        : items.map((i) => `• ${i.text} — ${i.app} — ${i.who} — ${dayTime(i.at, new Date(now))}`).join('\n')
      return { text, data: { events: items } }
    }

    default:
      throw new ServiceError(404, 'unknown_tool', `Cellula no tiene una herramienta llamada «${name}».`)
  }
}

const STATUS_TEXT = { active: 'activa', publishing: 'publicándose', error: 'con error' } as const

// ───────────── protocolo (JSON-RPC 2.0) ─────────────

export interface RpcRequest {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

export interface McpReply {
  status: number
  body: unknown | null
  headers?: Record<string, string>
}

const WWW_AUTHENTICATE =
  'Bearer realm="cellula", resource_metadata="https://mcp.cellula.app/.well-known/oauth-protected-resource"'

export function findAgentByToken(db: Db, token: string | null): AgentRecord | null {
  if (!token) return null
  return db.agents.find((a) => a.token === token) ?? null
}

/** Atiende un pedido JSON-RPC del cliente MCP. Sin un token válido contesta 401, como pide la especificación. */
export function handleMcp(db: Db, now: number, token: string | null, rpc: RpcRequest): McpReply {
  const agent = findAgentByToken(db, token)
  if (!agent) {
    return { status: 401, body: { error: 'unauthorized', message: 'Falta iniciar sesión en Cellula.' }, headers: { 'WWW-Authenticate': WWW_AUTHENTICATE } }
  }
  agent.lastUsedAt = now
  const reply = (result: unknown): McpReply => ({ status: 200, body: { jsonrpc: '2.0', id: rpc.id, result } })
  const rpcError = (code: number, message: string): McpReply => ({ status: 200, body: { jsonrpc: '2.0', id: rpc.id, error: { code, message } } })

  // Las notificaciones (sin id) no llevan respuesta.
  if (rpc.id === undefined) return { status: 202, body: null }

  switch (rpc.method) {
    case 'initialize':
      return reply({
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'cellula', title: 'Cellula', version: '1.0.0' },
        instructions: 'Cellula publica y comparte, de forma privada, las apps que arma un agente de IA. Todo lo que se hace por acá queda en Actividad como «Tu agente».',
      })
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      const name = String(rpc.params?.name ?? '')
      const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>
      try {
        const out = callTool(db, now, { kind: 'agent', name: AGENT_NAME[agent.tool] }, name, args)
        return reply({ content: [{ type: 'text', text: out.text }], structuredContent: out.data })
      } catch (e) {
        if (e instanceof ServiceError && e.code === 'unknown_tool') return rpcError(-32602, e.message)
        if (e instanceof ServiceError) {
          return reply({ content: [{ type: 'text', text: e.message }], structuredContent: { error: e.code, field: e.field ?? null }, isError: true })
        }
        throw e
      }
    }
    default:
      return rpcError(-32601, `Cellula no entiende el método «${rpc.method}».`)
  }
}

// ───────────── OAuth: canje del código por un token ─────────────

export type TokenReply =
  | { ok: true; access_token: string; token_type: 'Bearer'; expires_in: number }
  | { ok: false; error: string; error_description: string }

/** Canjea el código que emitió la pantalla "Autorizar" por un token, y deja a Claude registrado como agente conectado. */
export function exchangeCode(db: Db, now: number, params: { grant_type?: string; code?: string; client_id?: string }): TokenReply {
  if (params.grant_type !== 'authorization_code') {
    return { ok: false, error: 'unsupported_grant_type', error_description: 'Solo se acepta authorization_code.' }
  }
  const found = db.oauthCodes.find((c) => c.code === params.code && now - c.createdAt < 5 * 60_000)
  if (!found || found.clientId !== params.client_id) {
    return { ok: false, error: 'invalid_grant', error_description: 'El código venció o ya se usó. Volvé a conectar.' }
  }
  db.oauthCodes = db.oauthCodes.filter((c) => c.code !== found.code)
  const token = `clt_${nextId(db, 'tok')}_${Math.random().toString(36).slice(2, 12)}`
  const existing = db.agents.find((a) => a.tool === 'claude-web')
  if (existing) {
    existing.token = token
    existing.lastUsedAt = now
  } else {
    db.agents.push({ id: nextId(db, 'ag'), tool: 'claude-web', device: 'claude.ai', lastUsedAt: now, token })
  }
  return { ok: true, access_token: token, token_type: 'Bearer', expires_in: 60 * 60 * 24 * 30 }
}

/** Cierra la conexión de un token (RFC 7009): Claude deja de figurar como agente conectado. */
export function revokeToken(db: Db, token: string | null): boolean {
  const agent = findAgentByToken(db, token)
  if (!agent) return false
  db.agents = db.agents.filter((a) => a.id !== agent.id)
  return true
}

// ───────────── handlers de MSW ─────────────

function bearerOf(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(header)
  return m ? m[1] : null
}

export const mcpHandlers = [
  http.post(mcpRoute('/mcp'), async ({ request }) => {
    const rpc = (await request.json()) as RpcRequest
    await delay(150 + Math.random() * 250)
    const token = bearerOf(request)
    const reply = withDb((db, now) => handleMcp(db, now, token, rpc))
    return reply.body === null
      ? new HttpResponse(null, { status: reply.status, headers: reply.headers })
      : HttpResponse.json(reply.body, { status: reply.status, headers: reply.headers })
  }),

  http.post(mcpRoute('/oauth/revoke'), async ({ request }) => {
    const body = (await request.json()) as { token?: string }
    await delay(150)
    withDb((db) => revokeToken(db, body.token ?? null))
    return HttpResponse.json({})
  }),

  http.post(mcpRoute('/oauth/token'), async ({ request }) => {
    const type = request.headers.get('Content-Type') ?? ''
    let params: Record<string, string> = {}
    if (type.includes('application/json')) {
      params = (await request.json()) as Record<string, string>
    } else {
      const form = await request.formData()
      params = Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, String(v)]))
    }
    await delay(250 + Math.random() * 200)
    const result = withDb((db, now) => exchangeCode(db, now, params))
    return result.ok
      ? HttpResponse.json({ access_token: result.access_token, token_type: result.token_type, expires_in: result.expires_in })
      : HttpResponse.json({ error: result.error, error_description: result.error_description }, { status: 400 })
  }),
]
