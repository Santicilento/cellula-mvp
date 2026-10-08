// Base de datos del backend fake.
// Vive en memoria y se persiste en localStorage, así los cambios sobreviven a un F5 y se comparten entre pestañas.
// Cada pedido de la API relee el estado (load), avanza el "reloj" (tick) y guarda (save).

import type {
  AgentTool,
  AppNotification,
  AppStatus,
  EventActor,
  EventType,
  Origin,
  Provider,
  Role,
  User,
} from '../api/types'

const STORAGE_KEY = 'cellula-mvp:db:v2'

export const TRIAL_DAYS = 14
export const TRIAL_REQUIRED = 3
export const QUOTA_MB = 50

/** Tiempos de la publicación simulada (ms desde que se aprieta "Publicar"). */
export const PUBLISH_PREPARE_MS = 1400
export const PUBLISH_UPLOAD_MS = 5200
export const PUBLISH_ACTIVATE_MS = 1400
export const PUBLISH_TOTAL_MS = PUBLISH_PREPARE_MS + PUBLISH_UPLOAD_MS + PUBLISH_ACTIVATE_MS

/** Cada invitado de la prueba "ingresa" a los 6, 12 y 18 segundos de haber sido invitado. */
export const TRIAL_INVITE_STEP_MS = 6000

export interface AppRecord {
  id: string
  slug: string
  name: string
  status: AppStatus
  origin: Origin
  publishedAt: number | null
  lastPublishedBy: Origin
  /** Qué agente hizo la última publicación (cuando lastPublishedBy = agent). */
  lastAgentName: string | null
  fileName: string | null
  fileSize: number | null
  /** Publicación real simulada: avanza con el reloj. */
  publishStartedAt: number | null
  /** Publicación "congelada" de los datos de ejemplo (Presupuestos de obra al 64 %). */
  frozenPublish: { stage: 1 | 2 | 3; percent: number } | null
  /** Estado al que se vuelve si se cancela una publicación nueva sobre una app existente. */
  statusBefore: AppStatus | null
  storageMB: number
  entriesThisMonth: number
}

export interface AccessRecord {
  id: string
  name: string
  email: string
  role: Role
  expiresAt: number | null
  lastEntryAt: number | null
  isYou: boolean
}

export interface EventRecord {
  id: string
  type: EventType
  actor: EventActor
  agentName: string | null
  provider: Provider | null
  appSlug: string
  appName: string
  at: number
  person: string | null
  role: Role | null
  fromRole: Role | null
}

export interface TrialInviteRecord {
  id: string
  email: string
  sentAt: number
  enterAt: number
  enteredAt: number | null
}

export interface AgentRecord {
  id: string
  tool: AgentTool
  device: string
  lastUsedAt: number
  /** Token de acceso del conector (OAuth). Solo lo tienen los agentes que se conectaron por el flujo de autorización. */
  token: string | null
}

export interface OAuthCodeRecord {
  code: string
  clientId: string
  createdAt: number
}

export interface NotificationRecord extends Omit<AppNotification, 'at'> {
  at: number
  read: boolean
}

export interface Db {
  v: 2
  seq: number
  seededAt: number
  scenario: 'with-apps' | 'new-user'
  user: User
  trialUnlockedAt: number | null
  trialInvites: TrialInviteRecord[]
  apps: AppRecord[]
  access: Record<string, AccessRecord[]>
  events: EventRecord[]
  agents: AgentRecord[]
  agentAttempts: Record<AgentTool, number>
  oauthCodes: OAuthCodeRecord[]
  notifications: NotificationRecord[]
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const OWNER: User = { id: 'u_lucia', name: 'Lucía Benítez', email: 'lucia.benitez@gmail.com', initials: 'LB' }

function dayAt(base: number, daysAgo: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.getTime()
}

function startOfToday(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ───────────── datos de ejemplo ─────────────

function seedWithApps(now: number): Db {
  const today = startOfToday(now)
  let seq = 100
  const id = (p: string) => `${p}_${seq++}`

  const apps: AppRecord[] = [
    {
      id: 'app_turnos', slug: 'turnos-consultorio', name: 'Turnos del consultorio', status: 'active', origin: 'agent',
      publishedAt: today - 3 * DAY + 15 * HOUR, lastPublishedBy: 'agent', lastAgentName: 'Claude Code', fileName: 'turnos-consultorio.zip', fileSize: 2_410_000,
      publishStartedAt: null, frozenPublish: null, statusBefore: null, storageMB: 3.2, entriesThisMonth: 97,
    },
    {
      id: 'app_stock', slug: 'control-stock', name: 'Control de stock', status: 'active', origin: 'manual',
      publishedAt: dayAt(today, 1, '12:20'), lastPublishedBy: 'manual', lastAgentName: null, fileName: 'control-stock.zip', fileSize: 1_730_000,
      publishStartedAt: null, frozenPublish: null, statusBefore: null, storageMB: 1.4, entriesThisMonth: 31,
    },
    {
      id: 'app_presupuestos', slug: 'presupuestos-obra', name: 'Presupuestos de obra', status: 'publishing', origin: 'agent',
      publishedAt: null, lastPublishedBy: 'agent', lastAgentName: 'Claude Code', fileName: 'presupuestos-obra.zip', fileSize: 3_050_000,
      publishStartedAt: null, frozenPublish: { stage: 2, percent: 64 }, statusBefore: null, storageMB: 0.6, entriesThisMonth: 14,
    },
    {
      id: 'app_envios', slug: 'calculadora-envios', name: 'Calculadora de envíos', status: 'error', origin: 'manual',
      publishedAt: today - 5 * DAY + 11 * HOUR, lastPublishedBy: 'manual', lastAgentName: null, fileName: 'calculadora-envios.zip', fileSize: 980_000,
      publishStartedAt: null, frozenPublish: null, statusBefore: null, storageMB: 0.2, entriesThisMonth: 0,
    },
  ]

  const acc = (name: string, email: string, role: Role, expiresAt: number | null, lastEntryAt: number | null, isYou = false): AccessRecord => ({
    id: id('acc'), name, email, role, expiresAt, lastEntryAt, isYou,
  })

  const access: Record<string, AccessRecord[]> = {
    'turnos-consultorio': [
      acc('Lucía Benítez', 'lucia.benitez@gmail.com', 'administrar', null, dayAt(today, 0, '09:12'), true),
      acc('Martín Giménez', 'martin.gimenez@consultoriogimenez.com.ar', 'administrar', null, dayAt(today, 0, '08:40')),
      acc('Carolina Suárez', 'carolina.suarez@outlook.com', 'usar', null, dayAt(today, 1, '18:05')),
      acc('Pablo Herrera', 'pablo.herrera@estudioherrera.com.ar', 'ver', today + 54 * DAY, dayAt(today, 2, '11:20')),
      acc('Inés Morales', 'ines.morales@gmail.com', 'ver', today + 8 * DAY, null),
      acc('Rocío Paz', 'rocio.paz@gmail.com', 'usar', null, dayAt(today, 4, '15:47')),
    ],
    'control-stock': [
      acc('Lucía Benítez', 'lucia.benitez@gmail.com', 'administrar', null, dayAt(today, 1, '12:25'), true),
      acc('Pablo Herrera', 'pablo.herrera@estudioherrera.com.ar', 'ver', null, dayAt(today, 1, '17:30')),
      acc('Celeste Rojas', 'celeste.rojas@gmail.com', 'usar', null, dayAt(today, 3, '10:02')),
    ],
    'presupuestos-obra': [
      acc('Lucía Benítez', 'lucia.benitez@gmail.com', 'administrar', null, dayAt(today, 2, '09:30'), true),
      acc('Bruno Costa', 'bruno.costa@gmail.com', 'usar', null, null),
    ],
    'calculadora-envios': [acc('Lucía Benítez', 'lucia.benitez@gmail.com', 'administrar', null, dayAt(today, 5, '11:10'), true)],
  }

  const ev = (
    type: EventType, actor: EventActor, appSlug: string, appName: string, at: number,
    extra: Partial<Pick<EventRecord, 'agentName' | 'provider' | 'person' | 'role' | 'fromRole'>> = {},
  ): EventRecord => ({
    id: id('ev'), type, actor, appSlug, appName, at,
    agentName: extra.agentName ?? null, provider: extra.provider ?? null,
    person: extra.person ?? null, role: extra.role ?? null, fromRole: extra.fromRole ?? null,
  })

  const T = 'turnos-consultorio', TN = 'Turnos del consultorio'
  const S = 'control-stock', SN = 'Control de stock'
  const P = 'presupuestos-obra', PN = 'Presupuestos de obra'

  const events: EventRecord[] = [
    // Hoy
    ev('publishing', 'agent', P, PN, dayAt(today, 0, '09:18'), { agentName: 'Claude Code' }),
    ev('entry', 'guest', T, TN, dayAt(today, 0, '09:12'), { person: 'Lucía Benítez', provider: 'google' }),
    ev('entry', 'guest', T, TN, dayAt(today, 0, '08:40'), { person: 'Martín Giménez', provider: 'microsoft' }),
    ev('grant', 'agent', P, PN, dayAt(today, 0, '08:14'), { agentName: 'Claude Code', person: 'Bruno Costa', role: 'usar' }),
    // Ayer
    ev('entry', 'guest', T, TN, dayAt(today, 1, '18:05'), { person: 'Carolina Suárez', provider: 'microsoft' }),
    ev('entry', 'guest', S, SN, dayAt(today, 1, '17:30'), { person: 'Pablo Herrera', provider: 'google' }),
    ev('role_change', 'panel', S, SN, dayAt(today, 1, '16:48'), { person: 'Pablo Herrera', role: 'ver', fromRole: 'usar' }),
    ev('published', 'panel', S, SN, dayAt(today, 1, '12:20')),
    ev('revoke', 'panel', T, TN, dayAt(today, 1, '10:15'), { person: 'Sofía Duarte' }),
    // Más atrás (se ven con "Últimos 30 días")
    ev('grant', 'panel', T, TN, dayAt(today, 10, '11:20'), { person: 'Carolina Suárez', role: 'usar' }),
    ev('published', 'agent', S, SN, dayAt(today, 12, '17:02'), { agentName: 'Claude Code' }),
    ev('grant', 'panel', T, TN, dayAt(today, 15, '09:44'), { person: 'Martín Giménez', role: 'administrar' }),
    ev('entry', 'guest', S, SN, dayAt(today, 18, '20:10'), { person: 'Pablo Herrera', provider: 'google' }),
    ev('published', 'panel', T, TN, dayAt(today, 22, '16:00')),
    ev('grant', 'agent', T, TN, dayAt(today, 27, '10:30'), { agentName: 'Cursor', person: 'Rocío Paz', role: 'usar' }),
  ]

  const unlockedAt = dayAt(today, 5, '10:00')
  const trialInvites: TrialInviteRecord[] = ['Invitado 1', 'Invitado 2', 'Invitado 3'].map((_, i) => ({
    id: id('inv'),
    email: ['martin.gimenez@consultoriogimenez.com.ar', 'carolina.suarez@outlook.com', 'pablo.herrera@estudioherrera.com.ar'][i],
    sentAt: unlockedAt - DAY,
    enterAt: unlockedAt - (3 - i) * HOUR,
    enteredAt: unlockedAt - (3 - i) * HOUR,
  }))

  return {
    v: 2,
    seq,
    seededAt: now,
    scenario: 'with-apps',
    user: OWNER,
    trialUnlockedAt: unlockedAt,
    trialInvites,
    apps,
    access,
    events,
    agents: [
      { id: 'ag_claude', tool: 'claude', device: 'MacBook de Lucía', lastUsedAt: dayAt(today, 0, '09:18'), token: null },
      { id: 'ag_cursor', tool: 'cursor', device: 'PC del estudio', lastUsedAt: today - 3 * DAY + 16 * HOUR, token: null },
    ],
    agentAttempts: { claude: 0, cursor: 0, 'claude-web': 0 },
    oauthCodes: [],
    notifications: [],
  }
}

function seedNewUser(now: number): Db {
  return {
    v: 2,
    seq: 100,
    seededAt: now,
    scenario: 'new-user',
    user: OWNER,
    trialUnlockedAt: null,
    trialInvites: [],
    apps: [],
    access: {},
    events: [],
    agents: [],
    agentAttempts: { claude: 0, cursor: 0, 'claude-web': 0 },
    oauthCodes: [],
    notifications: [],
  }
}

export function seed(scenario: Db['scenario'], now = Date.now()): Db {
  return scenario === 'new-user' ? seedNewUser(now) : seedWithApps(now)
}

// ───────────── persistencia ─────────────

export function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed?.v === 2) return parsed
    }
  } catch {
    // estado dañado: se vuelve a sembrar
  }
  const fresh = seed('with-apps')
  save(fresh)
  return fresh
}

export function save(db: Db): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // sin localStorage (modo privado): el backend fake sigue funcionando en cada pedido con el último estado válido
  }
}

export function nextId(db: Db, prefix: string): string {
  return `${prefix}_${db.seq++}`
}

// ───────────── reloj simulado ─────────────

export function trialEndsAt(db: Db): number | null {
  return db.trialUnlockedAt === null ? null : db.trialUnlockedAt + TRIAL_DAYS * DAY
}

export function pushNotification(db: Db, n: Omit<NotificationRecord, 'id' | 'read' | 'at'>, now: number): void {
  db.notifications.push({ ...n, id: nextId(db, 'ntf'), at: now, read: false })
}

/** Avanza lo que pasa "solo" con el tiempo: publicaciones que terminan e invitados de la prueba que ingresan. */
export function tick(db: Db, now: number): void {
  for (const app of db.apps) {
    if (app.status === 'publishing' && app.publishStartedAt !== null && now - app.publishStartedAt >= PUBLISH_TOTAL_MS) {
      app.status = 'active'
      app.publishedAt = app.publishStartedAt + PUBLISH_TOTAL_MS
      app.publishStartedAt = null
      app.statusBefore = null
      db.events.push({
        id: nextId(db, 'ev'), type: 'published',
        actor: app.lastPublishedBy === 'agent' ? 'agent' : 'panel',
        agentName: app.lastPublishedBy === 'agent' ? (app.lastAgentName ?? 'Claude Code') : null,
        provider: null, appSlug: app.slug, appName: app.name, at: app.publishedAt, person: null, role: null, fromRole: null,
      })
      pushNotification(db, {
        kind: 'publish_done', title: '¡Tu app está online!', body: `${app.name} ya tiene su link y es privada.`, appSlug: app.slug,
      }, app.publishedAt)
    }
  }

  let changed = false
  for (const inv of db.trialInvites) {
    if (inv.enteredAt === null && now >= inv.enterAt) {
      inv.enteredAt = inv.enterAt
      changed = true
      const entered = db.trialInvites.filter((i) => i.enteredAt !== null).length
      if (entered < TRIAL_REQUIRED) {
        pushNotification(db, {
          kind: 'trial_progress', title: `Ingresaron ${entered} de ${TRIAL_REQUIRED}`,
          body: `${inv.email} entró con su cuenta.`, appSlug: null,
        }, inv.enterAt)
      }
    }
  }
  if (changed && db.trialUnlockedAt === null) {
    const entered = db.trialInvites.filter((i) => i.enteredAt !== null).length
    if (entered >= TRIAL_REQUIRED) {
      const last = Math.max(...db.trialInvites.map((i) => i.enteredAt ?? 0))
      db.trialUnlockedAt = last
      pushNotification(db, {
        kind: 'trial_unlocked', title: '¡Desbloqueaste tu prueba gratis!',
        body: `Tenés ${TRIAL_DAYS} días para publicar y compartir tus apps.`, appSlug: null,
      }, last)
    }
  }
}

export function activeAccess(db: Db, slug: string, now: number): AccessRecord[] {
  return (db.access[slug] ?? []).filter((a) => a.expiresAt === null || a.expiresAt >= startOfToday(now))
}
