import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MCP_URL } from '../../lib/agents'
import type { Chat, Connector, Message, ModelId, Part } from './types'

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function newConnector(name: string, url: string, oauthClientId = ''): Connector {
  return {
    id: uid('con'), name, url: url.trim(), status: 'disconnected', error: null, token: null, enabled: true,
    tools: [], permissions: {}, oauthClientId, connectedAt: null,
  }
}

interface ClaudeState {
  chats: Chat[]
  connectors: Connector[]
  model: ModelId
  sidebarOpen: boolean

  createChat: () => string
  deleteChat: (id: string) => void
  renameChat: (id: string, title: string) => void
  patchChat: (id: string, patch: Partial<Chat>) => void
  addMessages: (chatId: string, ...messages: Message[]) => void
  patchMessage: (chatId: string, messageId: string, fn: (m: Message) => Message) => void
  removeMessagesFrom: (chatId: string, messageId: string) => void
  patchPart: (chatId: string, messageId: string, partId: string, patch: Partial<Part>) => void

  addConnector: (name: string, url: string, oauthClientId?: string) => Connector
  patchConnector: (id: string, patch: Partial<Connector>) => void
  removeConnector: (id: string) => void

  setModel: (m: ModelId) => void
  setSidebarOpen: (open: boolean) => void
  resetAll: () => void
}

const initial = { chats: [] as Chat[], connectors: [] as Connector[], model: 'opus-5-5' as ModelId, sidebarOpen: true }

export const useClaude = create<ClaudeState>()(
  persist(
    (set, get) => ({
      ...initial,

      createChat: () => {
        const id = uid('chat')
        const now = Date.now()
        const chat: Chat = { id, title: 'Chat nuevo', createdAt: now, updatedAt: now, messages: [], artifacts: {}, lastApp: null, pending: null }
        set((s) => ({ chats: [chat, ...s.chats] }))
        return id
      },
      deleteChat: (id) => set((s) => ({ chats: s.chats.filter((c) => c.id !== id) })),
      renameChat: (id, title) => set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, title } : c)) })),
      patchChat: (id, patch) => set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)) })),
      addMessages: (chatId, ...messages) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, ...messages], updatedAt: Date.now() } : c)),
        })),
      patchMessage: (chatId, messageId, fn) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? fn(m) : m)) } : c,
          ),
        })),
      removeMessagesFrom: (chatId, messageId) =>
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c
            const idx = c.messages.findIndex((m) => m.id === messageId)
            return idx < 0 ? c : { ...c, messages: c.messages.slice(0, idx) }
          }),
        })),
      patchPart: (chatId, messageId, partId, patch) =>
        get().patchMessage(chatId, messageId, (m) => ({
          ...m,
          parts: m.parts.map((p) => (('id' in p && p.id === partId ? ({ ...p, ...patch } as Part) : p))),
        })),

      addConnector: (name, url, oauthClientId) => {
        const connector = newConnector(name, url, oauthClientId)
        set((s) => ({ connectors: [...s.connectors, connector] }))
        return connector
      },
      patchConnector: (id, patch) => set((s) => ({ connectors: s.connectors.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeConnector: (id) => set((s) => ({ connectors: s.connectors.filter((c) => c.id !== id) })),

      setModel: (model) => set({ model }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      resetAll: () => set({ ...initial }),
    }),
    {
      name: 'claude-demo:v1',
      version: 1,
      partialize: (s) => ({ chats: s.chats, connectors: s.connectors, model: s.model, sidebarOpen: s.sidebarOpen }),
      // Si la página se cerró a mitad de una respuesta, no puede haber nada "escribiéndose" ni permisos esperando.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ClaudeState>
        const chats = (p.chats ?? []).map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({
            ...m,
            status: m.status === 'streaming' ? ('stopped' as const) : m.status,
            thinking: null,
            parts: m.parts.map((part): Part => {
              if (part.type === 'permission' && part.decision === 'pending') return { ...part, decision: 'deny' }
              if (part.type === 'tool' && part.status === 'running') return { ...part, status: 'error', resultText: 'Se interrumpió.' }
              return part
            }),
          })),
        }))
        const connectors = (p.connectors ?? []).map((c) => (c.status === 'connecting' ? { ...c, status: 'disconnected' as const } : c))
        return { ...current, ...p, chats, connectors }
      },
    },
  ),
)

/** El conector de Cellula: el que apunta a la dirección del servidor MCP de Cellula. */
export function findCellula(connectors: Connector[]): Connector | undefined {
  const norm = (u: string) => u.trim().replace(/\/+$/, '').toLowerCase()
  return connectors.find((c) => norm(c.url) === norm(MCP_URL))
}
