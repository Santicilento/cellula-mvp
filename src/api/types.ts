// Contrato de la API. Lo comparten el front-end y el backend fake (src/mocks).
// Si algún día hay backend real, este archivo es el contrato a respetar.

export type Role = 'ver' | 'usar' | 'administrar'
export type AppStatus = 'active' | 'publishing' | 'error'
export type Origin = 'agent' | 'manual'
export type Provider = 'google' | 'microsoft'
export type AgentTool = 'claude' | 'cursor'

export interface User {
  id: string
  name: string
  email: string
  initials: string
}

export interface TrialInvitee {
  id: string
  email: string
  state: 'pending' | 'entered'
  enteredAt: string | null
}

export interface Trial {
  /** locked = todavía no invitó a 3 personas (hard paywall). */
  status: 'locked' | 'active'
  daysTotal: number
  daysLeft: number
  unlockedAt: string | null
  endsAt: string | null
  required: number
  entered: number
  invitees: TrialInvitee[]
}

export interface AppSummary {
  id: string
  slug: string
  name: string
  /** Dirección sin protocolo, por ejemplo turnos-consultorio.cellula.app */
  url: string
  status: AppStatus
  origin: Origin
  /** Personas con acceso vigente (incluye a quien administra). */
  peopleCount: number
  publishedAt: string | null
  /** Solo mientras status = publishing. */
  publish: PublishProgress | null
  /** Quién subió la versión en curso o la última (para "Última vez: hace 3 días, por tu agente"). */
  lastPublishedBy: Origin
  fileName: string | null
  fileSize: number | null
}

export interface PublishProgress {
  /** 1 = Preparando, 2 = Publicando, 3 = Activando el acceso privado. */
  stage: 1 | 2 | 3
  /** Porcentaje del paso 2 (0–100). */
  percent: number
}

export interface PublishInput {
  name: string
  fileName: string
  fileSize: number
}

export interface AccessEntry {
  id: string
  name: string
  email: string
  role: Role
  /** ISO o null si no vence. */
  expiresAt: string | null
  lastEntryAt: string | null
  isYou: boolean
}

export interface InviteInput {
  email: string
  role: Role
  /** ISO (yyyy-mm-dd) o null. */
  expiresAt: string | null
}

export type EventType = 'publishing' | 'published' | 'entry' | 'grant' | 'role_change' | 'revoke'
export type EventActor = 'agent' | 'panel' | 'guest'

export interface ActivityEvent {
  id: string
  type: EventType
  actor: EventActor
  /** "Claude Code" o "Cursor" cuando actor = agent. */
  agentName: string | null
  provider: Provider | null
  appSlug: string
  appName: string
  at: string
  /** Persona afectada (quien entró, a quien se invitó, etc.). */
  person: string | null
  role: Role | null
  fromRole: Role | null
}

export interface ActivityFilters {
  app?: string
  actor?: 'all' | 'agent' | 'panel'
  type?: 'all' | 'entry' | 'publish' | 'permissions'
  range?: 'today' | '7d' | '30d'
}

export interface DataColumn {
  key: string
  label: string
}

export interface DataCell {
  text: string
  tone?: 'ok' | 'warn' | 'neutral'
  bold?: boolean
}

export interface DataTableMeta {
  key: string
  label: string
  count: number
}

export interface DataTablePage {
  key: string
  label: string
  columns: DataColumn[]
  rows: Record<string, DataCell>[]
  page: number
  pageSize: number
  total: number
}

export interface DataOverview {
  tables: DataTableMeta[]
  usedMB: number
  quotaMB: number
}

export interface AgentConnection {
  id: string
  tool: AgentTool
  name: string
  device: string
  lastUsedAt: string
}

export interface AgentStatus {
  connections: AgentConnection[]
}

export interface AgentTestResult {
  ok: boolean
  tool: AgentTool
  message: string
}

export interface Usage {
  activeApps: number
  publishedApps: number
  peopleWithAccess: number
  entriesThisMonth: number
  entriesByApp: { slug: string; name: string; entries: number }[]
  monthLabel: string
}

export interface AppNotification {
  id: string
  kind: 'publish_done' | 'trial_progress' | 'trial_unlocked'
  title: string
  body: string
  appSlug: string | null
  at: string
}

export interface GateInfo {
  slug: string
  name: string
  ownerName: string
  available: boolean
}

export type GateResult =
  | { status: 'granted'; email: string; name: string; role: Role; provider: Provider }
  | { status: 'denied'; email: string; reason: 'not_invited' | 'expired' | 'removed' }

export interface DemoState {
  scenario: 'with-apps' | 'new-user'
  pendingTrialInvites: number
}

export interface ApiError {
  error: string
  message: string
  field?: string
}
