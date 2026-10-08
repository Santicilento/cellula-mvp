// Pega el runner (el cerebro guionado) con el store, el cliente MCP y la interfaz.
// Las respuestas corren fuera de React: si te vas a otra pantalla, Claude sigue escribiendo.

import { create } from 'zustand'
import { toast } from 'sonner'
import { runTurn, type ConnectorState, type RunEvent, type TurnDeps } from '../brain/runner'
import type { Links } from '../brain/scripts'
import {
  authorize,
  callTool,
  completeRedirect,
  fetchTools,
  McpAuthError,
  McpConnectionError,
  OAuthCancelled,
  OAuthDenied,
  revokeToken,
} from '../mcp/client'
import { findCellula, useClaude } from './store'
import type { Connector, Decision, Message, Part } from './types'

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

// ───────────── estado de la interfaz (no se guarda) ─────────────

interface RuntimeState {
  running: Record<string, boolean>
  /** Artefacto abierto en el panel de la derecha. */
  panel: { chatId: string; artifactId: string } | null
  openPanel: (chatId: string, artifactId: string) => void
  closePanel: () => void
  /** Barra lateral como cajón en pantallas angostas (no se guarda: siempre arranca cerrado). */
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

export const useRuntime = create<RuntimeState>()((set) => ({
  running: {},
  panel: null,
  openPanel: (chatId, artifactId) => set({ panel: { chatId, artifactId } }),
  closePanel: () => set({ panel: null }),
  drawerOpen: false,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
}))

const setRunning = (chatId: string, on: boolean) =>
  useRuntime.setState((s) => ({ running: { ...s.running, [chatId]: on } }))

const runs = new Map<string, AbortController>()
const resolvers = new Map<string, (d: Decision) => void>()
const popups = new Map<string, Window | null>()

const abortError = () => new DOMException('Detenido', 'AbortError')

// ───────────── enlaces hacia Cellula ─────────────

const BASE = import.meta.env.BASE_URL
export const links: Links = {
  gate: (slug) => `${BASE}#/i/${slug}`,
  accesos: (slug) => `${BASE}#/apps/${slug}/accesos`,
  panel: `${BASE}#/apps`,
  agente: `${BASE}#/agente`,
}

// ───────────── conector de Cellula ─────────────

export function connectorState(c: Connector | undefined): ConnectorState {
  if (!c) return 'missing'
  if (c.status === 'needs-auth') return 'needs-auth'
  if (c.status !== 'connected' || !c.token) return 'missing'
  if (!c.enabled) return 'disabled'
  return 'ready'
}

// ───────────── una respuesta de Claude ─────────────

function shortTitle(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 44 ? `${t.slice(0, 43).trimEnd()}…` : t.charAt(0).toUpperCase() + t.slice(1)
}

function applyEvent(chatId: string, messageId: string, e: RunEvent) {
  const store = useClaude.getState()
  switch (e.kind) {
    case 'thinking':
      store.patchMessage(chatId, messageId, (m) => ({ ...m, thinking: e.label }))
      break
    case 'text':
      store.patchMessage(chatId, messageId, (m) => {
        const last = m.parts[m.parts.length - 1]
        const parts: Part[] =
          last?.type === 'text'
            ? [...m.parts.slice(0, -1), { type: 'text', text: last.text + e.chunk }]
            : [...m.parts, { type: 'text', text: e.chunk.replace(/^\n+/, '') }]
        return { ...m, parts, thinking: null }
      })
      break
    case 'part':
      store.patchMessage(chatId, messageId, (m) => ({ ...m, parts: [...m.parts, e.part] }))
      break
    case 'patch':
      store.patchPart(chatId, messageId, e.id, e.patch)
      break
    case 'artifact': {
      const chat = store.chats.find((c) => c.id === chatId)
      if (chat) store.patchChat(chatId, { artifacts: { ...chat.artifacts, [e.artifact.id]: e.artifact } })
      useRuntime.getState().openPanel(chatId, e.artifact.id)
      break
    }
    case 'chat': {
      const { title, ...rest } = e.patch
      if (title) store.renameChat(chatId, title)
      if (Object.keys(rest).length) store.patchChat(chatId, rest)
      break
    }
    case 'auth-lost': {
      const c = findCellula(useClaude.getState().connectors)
      if (c) store.patchConnector(c.id, { status: 'needs-auth', token: null, error: 'Se perdió la autorización. Volvé a conectar.' })
      break
    }
  }
}

function buildDeps(chatId: string, messageId: string, input: string, signal: AbortSignal): TurnDeps {
  const state = useClaude.getState()
  const chat = state.chats.find((c) => c.id === chatId)
  const cellula = findCellula(state.connectors)

  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(abortError())
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }, ms)
      const onAbort = () => {
        clearTimeout(timer)
        reject(abortError())
      }
      signal.addEventListener('abort', onAbort, { once: true })
    })

  return {
    input,
    chat: {
      hasArtifact: Object.keys(chat?.artifacts ?? {}).length > 0,
      lastApp: chat?.lastApp ?? null,
      pending: chat?.pending ?? null,
    },
    connector: {
      state: connectorState(cellula),
      name: cellula?.name ?? 'Cellula',
      tool: (name) => {
        const t = cellula?.tools.find((x) => x.name === name)
        const readOnly = t?.readOnly ?? false
        return {
          title: t?.title ?? name,
          readOnly,
          destructive: t?.destructive ?? false,
          mode: cellula?.permissions[name] ?? (readOnly ? 'allow' : 'ask'),
        }
      },
    },
    links,
    // Lee el conector en cada llamada: así toma el token vigente y no uno viejo.
    call: async (tool, args) => {
      const c = findCellula(useClaude.getState().connectors)
      if (!c?.token) throw new McpAuthError()
      const result = await callTool(c.url, c.token, tool, args)
      if (signal.aborted) throw abortError()
      return result
    },
    ask: (part) =>
      new Promise<Decision>((resolve, reject) => {
        resolvers.set(part.id, resolve)
        signal.addEventListener('abort', () => {
          resolvers.delete(part.id)
          reject(abortError())
        }, { once: true })
      }),
    emit: (e) => applyEvent(chatId, messageId, e),
    sleep,
    uid,
  }
}

async function runAssistant(chatId: string, messageId: string, input: string) {
  const controller = new AbortController()
  runs.set(chatId, controller)
  setRunning(chatId, true)
  let status: Message['status'] = 'done'
  try {
    await runTurn(buildDeps(chatId, messageId, input, controller.signal))
  } catch (e) {
    status = 'stopped'
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      console.error(e)
      toast.error('Algo salió mal al responder. Probá de nuevo.')
    }
  } finally {
    runs.delete(chatId)
    // Permisos que quedaron esperando: se dan por rechazados.
    useClaude.getState().patchMessage(chatId, messageId, (m) => ({
      ...m,
      status,
      thinking: null,
      parts: m.parts.map((p): Part => {
        if (p.type === 'permission' && p.decision === 'pending') return { ...p, decision: 'deny' }
        if (p.type === 'tool' && p.status === 'running') return { ...p, status: 'error', resultText: 'Se detuvo.', progress: undefined }
        return p
      }),
    }))
    setRunning(chatId, false)
  }
}

// ───────────── acciones de la interfaz ─────────────

export async function sendMessage(chatId: string, text: string) {
  const store = useClaude.getState()
  const chat = store.chats.find((c) => c.id === chatId)
  const trimmed = text.trim()
  if (!chat || !trimmed || useRuntime.getState().running[chatId]) return
  const now = Date.now()
  const user: Message = { id: uid('msg'), role: 'user', parts: [{ type: 'text', text: trimmed }], createdAt: now, status: 'done' }
  const bot: Message = { id: uid('msg'), role: 'assistant', parts: [], createdAt: now + 1, status: 'streaming', thinking: 'Pensando…' }
  store.addMessages(chatId, user, bot)
  if (chat.title === 'Chat nuevo') store.renameChat(chatId, shortTitle(trimmed))
  await runAssistant(chatId, bot.id, trimmed)
}

export function stopChat(chatId: string) {
  runs.get(chatId)?.abort()
}

/** Vuelve a generar la última respuesta. */
export async function retry(chatId: string, assistantMessageId: string) {
  const store = useClaude.getState()
  const chat = store.chats.find((c) => c.id === chatId)
  if (!chat || useRuntime.getState().running[chatId]) return
  const idx = chat.messages.findIndex((m) => m.id === assistantMessageId)
  const user = chat.messages[idx - 1]
  const input = user?.parts.find((p) => p.type === 'text')
  if (!user || input?.type !== 'text') return
  store.removeMessagesFrom(chatId, assistantMessageId)
  const bot: Message = { id: uid('msg'), role: 'assistant', parts: [], createdAt: Date.now(), status: 'streaming', thinking: 'Pensando…' }
  store.addMessages(chatId, bot)
  await runAssistant(chatId, bot.id, input.text)
}

/** La persona respondió a una tarjeta de permiso. */
export function decide(part: Extract<Part, { type: 'permission' }>, decision: Exclude<Decision, 'pending'>) {
  if (decision === 'allow-always') {
    const c = findCellula(useClaude.getState().connectors)
    if (c) useClaude.getState().patchConnector(c.id, { permissions: { ...c.permissions, [part.tool]: 'allow' } })
  }
  resolvers.get(part.id)?.(decision)
  resolvers.delete(part.id)
}

// ───────────── conectores ─────────────

/** Conecta un conector (OAuth + tools/list). `popup` tiene que abrirse en el mismo clic. */
export async function connectConnector(id: string, popup: Window | null): Promise<boolean> {
  const store = useClaude.getState()
  const connector = store.connectors.find((c) => c.id === id)
  if (!connector) return false
  popups.set(id, popup)
  store.patchConnector(id, { status: 'connecting', error: null })
  try {
    const token = await authorize(connector.url, connector.oauthClientId || 'claude', popup)
    const tools = await fetchTools(connector.url, token)
    useClaude.getState().patchConnector(id, { status: 'connected', token, tools, error: null, connectedAt: Date.now(), enabled: true })
    toast.success(`${connector.name} conectado`, { description: `${tools.length} herramientas disponibles.` })
    return true
  } catch (e) {
    try {
      popup?.close()
    } catch {
      // ya estaba cerrada
    }
    if (e instanceof OAuthCancelled) {
      useClaude.getState().patchConnector(id, { status: 'disconnected', error: null })
    } else if (e instanceof OAuthDenied) {
      useClaude.getState().patchConnector(id, { status: 'disconnected', error: 'No diste el permiso en Cellula. Podés intentarlo de nuevo.' })
    } else {
      const message = e instanceof McpConnectionError ? e.message : 'No pudimos completar la conexión. Probá de nuevo.'
      useClaude.getState().patchConnector(id, { status: 'error', error: message })
    }
    return false
  } finally {
    popups.delete(id)
  }
}

export function cancelConnecting(id: string) {
  try {
    popups.get(id)?.close()
  } catch {
    // ya estaba cerrada
  }
  useClaude.getState().patchConnector(id, { status: 'disconnected', error: null })
}

export async function disconnectConnector(id: string) {
  const c = useClaude.getState().connectors.find((x) => x.id === id)
  if (!c) return
  if (c.token) await revokeToken(c.url, c.token)
  useClaude.getState().patchConnector(id, { status: 'disconnected', token: null, tools: [], error: null, connectedAt: null })
  toast(`${c.name} desconectado`)
}

/** Vuelve a mirar si cada conector sigue autorizado (por ejemplo, si lo desconectaron desde Cellula). */
export async function verifyConnectors() {
  for (const c of useClaude.getState().connectors) {
    if (c.status !== 'connected' || !c.token) continue
    try {
      const tools = await fetchTools(c.url, c.token)
      useClaude.getState().patchConnector(c.id, { tools })
    } catch (e) {
      if (e instanceof McpAuthError) {
        useClaude.getState().patchConnector(c.id, { status: 'needs-auth', token: null, error: 'Se perdió la autorización. Volvé a conectar.' })
      }
    }
  }
}

/** Fin del OAuth cuando se usó la redirección en vez de la ventana emergente. */
export async function finishRedirect(code: string | null, state: string | null, error: string | null): Promise<'ok' | 'denied' | 'failed'> {
  try {
    const { url, token } = await completeRedirect(code, state, error)
    const connector = useClaude.getState().connectors.find((c) => c.url === url)
    if (!connector) return 'failed'
    const tools = await fetchTools(url, token)
    useClaude.getState().patchConnector(connector.id, { status: 'connected', token, tools, error: null, connectedAt: Date.now(), enabled: true })
    toast.success(`${connector.name} conectado`, { description: `${tools.length} herramientas disponibles.` })
    return 'ok'
  } catch (e) {
    return e instanceof OAuthDenied ? 'denied' : 'failed'
  }
}

