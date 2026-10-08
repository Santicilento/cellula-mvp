// Cliente MCP del clon de Claude: habla JSON-RPC 2.0 con un servidor MCP remoto y hace el login por OAuth.
// Es el mismo camino que seguiría claude.ai: sondea sin token (401), manda a la persona a autorizar y canjea el código.
//
// En esta demo, el servidor "https://mcp.cellula.app/mcp" no existe de verdad: lo atiende el backend fake del navegador.
// Por eso resolve() reescribe ese host a esta misma app (así no hay problemas de CORS). Cualquier otro servidor no se alcanza.

import { MCP_HOST } from '../../lib/agents'
import type { ConnectorTool } from '../store/types'

const BASE = import.meta.env.BASE_URL

export class McpAuthError extends Error {
  constructor() {
    super('Falta autorizar el conector.')
  }
}
export class McpConnectionError extends Error {}
export class McpProtocolError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.code = code
  }
}
export class OAuthCancelled extends Error {
  constructor() {
    super('Se cerró la ventana de autorización.')
  }
}
export class OAuthDenied extends Error {
  constructor() {
    super('No se dio el permiso.')
  }
}

export interface ToolResult {
  text: string
  data: Record<string, unknown> | null
  isError: boolean
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Convierte la dirección del servidor MCP en la ruta real del backend fake. */
async function resolve(url: string, path?: string): Promise<string> {
  let u: URL
  try {
    u = new URL(path ? new URL(path, url).toString() : url)
  } catch {
    throw new McpConnectionError('Esa dirección no es válida. Tiene que ser una URL que empiece con https://')
  }
  if (u.protocol !== 'https:') throw new McpConnectionError('Los servidores MCP remotos tienen que usar https://')
  if (u.hostname !== MCP_HOST) {
    await wait(900)
    throw new McpConnectionError(
      `No pudimos conectar con ${u.hostname}. Revisá la dirección y que sea un servidor MCP remoto. (En esta demo solo está disponible el de Cellula.)`,
    )
  }
  return `${BASE}api/_mcp${u.pathname}${u.search}`
}

let rpcId = 0

async function rpc<T>(url: string, token: string | null, method: string, params?: object): Promise<T> {
  const target = await resolve(url)
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  if (res.status === 401) throw new McpAuthError()
  if (!res.ok && res.status !== 202) throw new McpConnectionError(`El servidor respondió con un error (${res.status}).`)
  if (res.status === 202) return undefined as T
  const body = (await res.json()) as { result?: T; error?: { code: number; message: string } }
  if (body.error) throw new McpProtocolError(body.error.message, body.error.code)
  return body.result as T
}

async function notify(url: string, token: string, method: string): Promise<void> {
  const target = await resolve(url)
  await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', method }),
  })
}

/** ¿El servidor pide iniciar sesión? Un servidor MCP con OAuth contesta 401 a quien no trae token. */
export async function requiresAuth(url: string): Promise<boolean> {
  try {
    await rpc(url, null, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'claude-demo', version: '1.0.0' },
    })
    return false
  } catch (e) {
    if (e instanceof McpAuthError) return true
    throw e
  }
}

interface RawTool {
  name: string
  title?: string
  description?: string
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

/** initialize + tools/list: lo que hace claude.ai al terminar de conectar un conector. */
export async function fetchTools(url: string, token: string): Promise<ConnectorTool[]> {
  await rpc(url, token, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'claude-demo', version: '1.0.0' },
  })
  await notify(url, token, 'notifications/initialized')
  const { tools } = await rpc<{ tools: RawTool[] }>(url, token, 'tools/list')
  return tools.map((t) => ({
    name: t.name,
    title: t.title ?? t.name,
    description: t.description ?? '',
    readOnly: t.annotations?.readOnlyHint === true,
    destructive: t.annotations?.destructiveHint === true,
  }))
}

export async function callTool(url: string, token: string, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const res = await rpc<{ content?: { type: string; text?: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean }>(
    url,
    token,
    'tools/call',
    { name, arguments: args },
  )
  return {
    text: res.content?.map((c) => c.text ?? '').join('\n') ?? '',
    data: res.structuredContent ?? null,
    isError: res.isError === true,
  }
}

async function exchangeCode(url: string, clientId: string, code: string): Promise<string> {
  const target = await resolve(url, '/oauth/token')
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, client_id: clientId }),
  })
  const body = (await res.json()) as { access_token?: string; error_description?: string }
  if (!res.ok || !body.access_token) throw new McpConnectionError(body.error_description ?? 'No pudimos completar la conexión.')
  return body.access_token
}

/** Avisa al servidor que este token ya no se usa (RFC 7009). Si falla, no pasa nada: el token queda sin uso. */
export async function revokeToken(url: string, token: string): Promise<void> {
  try {
    const target = await resolve(url, '/oauth/revoke')
    await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  } catch {
    // sin conexión con el servidor: nada más que hacer
  }
}

// ───────────── OAuth con ventana emergente ─────────────

const REDIRECT_KEY = 'claude-demo:oauth'

/** Hay que abrirla en el mismo instante del clic: si no, el navegador la bloquea. */
export function openAuthPopup(): Window | null {
  const w = 480
  const h = 720
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2)
  const popup = window.open('', 'cellula-oauth', `popup=yes,width=${w},height=${h},left=${left},top=${top}`)
  if (popup) {
    try {
      popup.document.title = 'Conectando con Cellula…'
      popup.document.body.style.cssText = 'font-family:system-ui,sans-serif;color:#555;display:grid;place-items:center;height:100vh;margin:0'
      popup.document.body.textContent = 'Conectando con Cellula…'
    } catch {
      // ventana de otro origen: no importa
    }
  }
  return popup
}

function randomState(): string {
  return `st_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
}

function waitForCode(popup: Window, state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      window.clearInterval(poll)
      window.clearTimeout(timeout)
      fn()
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const data = e.data as { type?: string; state?: string; code?: string; error?: string } | null
      if (data?.type !== 'cellula-oauth' || data.state !== state) return
      finish(() => (data.error || !data.code ? reject(new OAuthDenied()) : resolve(data.code)))
    }
    window.addEventListener('message', onMessage)
    // Si cierran la ventana sin elegir, se cancela (con un margen para que llegue un mensaje en camino).
    const poll = window.setInterval(() => {
      if (popup.closed) window.setTimeout(() => finish(() => reject(new OAuthCancelled())), 500)
    }, 400)
    const timeout = window.setTimeout(() => finish(() => reject(new OAuthCancelled())), 5 * 60_000)
  })
}

function authorizeUrl(clientId: string, state: string): string {
  const callback = `${window.location.origin}${BASE}claude/#/oauth/callback`
  const q = new URLSearchParams({ client_id: clientId, state, redirect_uri: callback })
  return `${window.location.origin}${BASE}#/autorizar?${q.toString()}`
}

/**
 * Conecta con el servidor: sondea, manda a la persona a autorizar en Cellula y devuelve el token.
 *
 * Hay dos caminos. Con ventana emergente, la ventana avisa por postMessage y se sigue acá.
 * Si el navegador la bloquea, o la "ventana" resulta ser esta misma pestaña (pasa en algunos navegadores embebidos),
 * la página se va a Cellula y vuelve por /oauth/callback: por eso el estado se guarda ANTES de abrir nada.
 */
export async function authorize(url: string, clientId: string, popup: Window | null): Promise<string> {
  if (!(await requiresAuth(url))) throw new McpConnectionError('Este servidor no pide iniciar sesión. En esta demo se espera un servidor con OAuth.')
  const state = randomState()
  const target = authorizeUrl(clientId, state)

  try {
    localStorage.setItem(REDIRECT_KEY, JSON.stringify({ url, clientId, state }))
  } catch {
    if (!popup) throw new McpConnectionError('El navegador bloqueó la ventana de autorización y no pudimos seguir de otra forma.')
  }

  if (!popup || popup.closed) {
    window.location.href = target
    return new Promise<string>(() => undefined) // la página se va: sigue en la ruta /oauth/callback
  }

  popup.location.href = target
  try {
    const code = await waitForCode(popup, state)
    return await exchangeCode(url, clientId, code)
  } finally {
    // Este camino terminó acá: el respaldo por redirección ya no hace falta.
    try {
      localStorage.removeItem(REDIRECT_KEY)
    } catch {
      // nada que borrar
    }
  }
}

export interface RedirectResult {
  url: string
  token: string
}

/** Segunda mitad del OAuth cuando se usó la redirección en vez de la ventana emergente. */
export async function completeRedirect(code: string | null, state: string | null, error: string | null): Promise<RedirectResult> {
  let saved: { url: string; clientId: string; state: string } | null = null
  try {
    saved = JSON.parse(localStorage.getItem(REDIRECT_KEY) ?? 'null')
    localStorage.removeItem(REDIRECT_KEY)
  } catch {
    saved = null
  }
  if (!saved || saved.state !== state) throw new McpConnectionError('La autorización venció o no coincide. Volvé a conectar.')
  if (error || !code) throw new OAuthDenied()
  return { url: saved.url, token: await exchangeCode(saved.url, saved.clientId, code) }
}
