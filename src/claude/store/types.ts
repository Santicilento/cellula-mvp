// Modelo de datos del clon de Claude: conectores, chats, mensajes y sus partes.

export type PermissionMode = 'ask' | 'allow'
export type ConnectorStatus = 'disconnected' | 'connecting' | 'connected' | 'needs-auth' | 'error'

export interface ConnectorTool {
  name: string
  title: string
  description: string
  readOnly: boolean
  destructive: boolean
}

/** Un conector MCP remoto (en claude.ai: Configuración → Conectores). */
export interface Connector {
  id: string
  name: string
  url: string
  status: ConnectorStatus
  /** Último error al conectar, para mostrarlo en la tarjeta. */
  error: string | null
  token: string | null
  /** Interruptor del menú de herramientas del compositor. */
  enabled: boolean
  tools: ConnectorTool[]
  /** Permiso elegido por herramienta. Si falta, las de solo lectura se permiten y el resto pregunta. */
  permissions: Record<string, PermissionMode>
  oauthClientId: string
  connectedAt: number | null
}

export type Decision = 'pending' | 'allow-once' | 'allow-always' | 'deny'

export type ActionItem =
  | { id: string; label: string; kind: 'send'; text: string }
  | { id: string; label: string; kind: 'open-connectors' }
  | { id: string; label: string; kind: 'open-link'; href: string }

export type Part =
  | { type: 'text'; text: string }
  | {
      type: 'tool'
      id: string
      connectorName: string
      tool: string
      title: string
      args: Record<string, unknown>
      status: 'running' | 'done' | 'error'
      resultText?: string
      data?: unknown
      /** Avance en vivo (por ejemplo, "Publicando… 64 %"). */
      progress?: { label: string; percent: number | null }
    }
  | {
      type: 'permission'
      id: string
      connectorName: string
      tool: string
      title: string
      args: Record<string, unknown>
      decision: Decision
    }
  | { type: 'artifact'; artifactId: string }
  | { type: 'actions'; items: ActionItem[] }

export interface Message {
  id: string
  role: 'user' | 'assistant'
  parts: Part[]
  createdAt: number
  status: 'done' | 'streaming' | 'stopped'
  /** "Pensando…" antes de empezar a escribir. */
  thinking?: string | null
}

export interface Artifact {
  id: string
  title: string
  kind: 'agenda-yoga'
}

/** Lo que Claude "recuerda" de la charla: de qué app venimos hablando y qué le pidió confirmar. */
export type PendingAction = { kind: 'publish'; appName: string } | { kind: 'publish-version'; appName: string }

export interface Chat {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
  artifacts: Record<string, Artifact>
  lastApp: string | null
  pending: PendingAction | null
}

export type ModelId = 'opus-5-5' | 'sonnet-5-5' | 'haiku-4-5'

export const MODELS: { id: ModelId; name: string; hint: string }[] = [
  { id: 'opus-5-5', name: 'Opus 5.5', hint: 'El más capaz para tareas complejas' },
  { id: 'sonnet-5-5', name: 'Sonnet 5.5', hint: 'Equilibrado para el día a día' },
  { id: 'haiku-4-5', name: 'Haiku 4.5', hint: 'El más rápido para respuestas cortas' },
]

/** El prompt que ya viene escrito en el inicio, para apretar Enter y arrancar la demo. */
export const DEMO_PROMPT = 'Armame una app para que mis alumnas reserven clases de yoga y yo vea quién se anotó'
