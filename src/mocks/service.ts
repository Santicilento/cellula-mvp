// Lógica de dominio de Cellula, compartida por el panel (REST, handlers.ts) y por el conector del agente (MCP, mcp.ts).
// Las reglas del MVP viven acá una sola vez: prueba bloqueada, nombres únicos, invitaciones sin duplicados, etc.
// Las funciones reciben el estado ya cargado (db) y el "ahora", y tiran ServiceError cuando una regla no se cumple.
// Validan antes de modificar, así que un error nunca deja la base a medias.

import type {
  AccessEntry,
  ActivityEvent,
  ActivityFilters,
  AppSummary,
  EventActor,
  InviteInput,
  Origin,
  PublishInput,
  PublishProgress,
  Role,
  Trial,
} from '../api/types'
import { daysBetween, DAY_MS, isEmail, slugify, startOfDay } from '../lib/format'
import {
  activeAccess,
  nextId,
  PUBLISH_PREPARE_MS,
  PUBLISH_UPLOAD_MS,
  TRIAL_DAYS,
  TRIAL_REQUIRED,
  trialEndsAt,
  type AccessRecord,
  type AppRecord,
  type Db,
  type EventRecord,
} from './db'

export class ServiceError extends Error {
  status: number
  code: string
  field?: string

  constructor(status: number, code: string, message: string, field?: string) {
    super(message)
    this.status = status
    this.code = code
    this.field = field
  }
}

/** Quién hace la acción: la persona desde el panel o un agente por el conector. */
export type Actor = { kind: 'panel' } | { kind: 'agent'; name: string }

const PANEL: Actor = { kind: 'panel' }
export { PANEL }

function eventActor(actor: Actor): { actor: EventActor; agentName: string | null } {
  return actor.kind === 'agent' ? { actor: 'agent', agentName: actor.name } : { actor: 'panel', agentName: null }
}

// ───────────── conversiones a la forma de la API ─────────────

export const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString())
const isoOrThrow = (ms: number): string => new Date(ms).toISOString()

export function publishProgress(app: AppRecord, now: number): PublishProgress | null {
  if (app.status !== 'publishing') return null
  if (app.frozenPublish) return app.frozenPublish
  const elapsed = now - (app.publishStartedAt ?? now)
  if (elapsed < PUBLISH_PREPARE_MS) return { stage: 1, percent: 0 }
  if (elapsed < PUBLISH_PREPARE_MS + PUBLISH_UPLOAD_MS) {
    return { stage: 2, percent: Math.round(((elapsed - PUBLISH_PREPARE_MS) / PUBLISH_UPLOAD_MS) * 100) }
  }
  return { stage: 3, percent: 100 }
}

export function toApp(db: Db, app: AppRecord, now: number): AppSummary {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    url: `${app.slug}.cellula.app`,
    status: app.status,
    origin: app.origin,
    peopleCount: activeAccess(db, app.slug, now).length,
    publishedAt: iso(app.publishedAt),
    publish: publishProgress(app, now),
    lastPublishedBy: app.lastPublishedBy,
    fileName: app.fileName,
    fileSize: app.fileSize,
  }
}

export function toAccess(a: AccessRecord): AccessEntry {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    expiresAt: iso(a.expiresAt),
    lastEntryAt: iso(a.lastEntryAt),
    isYou: a.isYou,
  }
}

export function toEvent(e: EventRecord): ActivityEvent {
  return { ...e, at: isoOrThrow(e.at) }
}

export function toTrial(db: Db, now: number): Trial {
  const entered = db.trialInvites.filter((i) => i.enteredAt !== null).length
  const ends = trialEndsAt(db)
  return {
    status: db.trialUnlockedAt === null ? 'locked' : 'active',
    daysTotal: TRIAL_DAYS,
    daysLeft: ends === null ? TRIAL_DAYS : Math.max(0, daysBetween(new Date(now), new Date(ends))),
    unlockedAt: iso(db.trialUnlockedAt),
    endsAt: iso(ends),
    required: TRIAL_REQUIRED,
    entered,
    invitees: db.trialInvites.map((i) => ({
      id: i.id,
      email: i.email,
      state: i.enteredAt === null ? 'pending' : 'entered',
      enteredAt: iso(i.enteredAt),
    })),
  }
}

// ───────────── búsquedas ─────────────

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

export function knownName(db: Db, email: string): string | null {
  const needle = email.trim().toLowerCase()
  for (const list of Object.values(db.access)) {
    const hit = list.find((a) => a.email.toLowerCase() === needle)
    if (hit) return hit.name
  }
  if (needle === 'diego.fernandez@gmail.com') return 'Diego Fernández'
  return null
}

export function findApp(db: Db, slug: string): AppRecord | undefined {
  return db.apps.find((a) => a.slug === slug)
}

/** Busca una app por nombre o dirección exactos (sin importar mayúsculas ni acentos). Devuelve undefined si no hay. */
export function findExactApp(db: Db, query: string): AppRecord | undefined {
  const q = normalize(query)
  const slug = slugify(query)
  return db.apps.find((a) => a.slug === slug || normalize(a.name) === q)
}

/** Encuentra una app por dirección o por nombre (sin importar mayúsculas ni acentos). */
export function resolveApp(db: Db, query: string): AppRecord {
  const q = normalize(query)
  if (!q) throw new ServiceError(422, 'invalid', 'Decime de qué app hablás.', 'app')
  const asSlug = slugify(query)
  const hit =
    db.apps.find((a) => a.slug === asSlug) ??
    db.apps.find((a) => normalize(a.name) === q) ??
    db.apps.find((a) => normalize(a.name).includes(q) || q.includes(normalize(a.name)))
  if (!hit) throw new ServiceError(404, 'not_found', `No encontré ninguna app que se llame «${query}».`, 'app')
  return hit
}

/** Encuentra a una persona con acceso a la app por email o por nombre. */
export function resolvePerson(db: Db, slug: string, query: string): AccessRecord {
  const q = normalize(query)
  const list = db.access[slug] ?? []
  const hit =
    list.find((a) => normalize(a.email) === q) ??
    list.find((a) => normalize(a.name) === q) ??
    list.find((a) => normalize(a.name).includes(q) || normalize(a.email).startsWith(q))
  if (!hit) throw new ServiceError(404, 'not_found', `No encontré a «${query}» entre las personas con acceso.`, 'person')
  return hit
}

export function addEvent(
  db: Db,
  e: Omit<EventRecord, 'id' | 'agentName' | 'provider' | 'person' | 'role' | 'fromRole'> & Partial<EventRecord>,
): void {
  db.events.push({
    id: nextId(db, 'ev'),
    agentName: null, provider: null, person: null, role: null, fromRole: null,
    ...e,
  })
}

export function trialIsOpen(db: Db, now: number): boolean {
  const ends = trialEndsAt(db)
  return db.trialUnlockedAt !== null && ends !== null && now < ends
}

export function evaluateAccess(db: Db, slug: string, emailRaw: string, now: number):
  | { ok: true; record: AccessRecord }
  | { ok: false; reason: 'not_invited' | 'expired' } {
  const email = emailRaw.trim().toLowerCase()
  const record = (db.access[slug] ?? []).find((a) => a.email.toLowerCase() === email)
  if (!record) return { ok: false, reason: 'not_invited' }
  if (record.expiresAt !== null && record.expiresAt < startOfDay(new Date(now)).getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, record }
}

// ───────────── acciones ─────────────

export function listApps(db: Db, now: number): AppSummary[] {
  return db.apps.map((a) => toApp(db, a, now))
}

const TRIAL_LOCKED_MESSAGE = 'Para publicar, desbloqueá tu prueba gratis invitando a 3 personas.'

/** Publica una app nueva. Es la regla del hard paywall: sin prueba desbloqueada no se publica. */
export function publishApp(db: Db, now: number, actor: Actor, input: PublishInput): AppSummary {
  if (!trialIsOpen(db, now)) throw new ServiceError(402, 'trial_locked', TRIAL_LOCKED_MESSAGE)
  const name = (input.name ?? '').trim()
  if (name.length < 2) throw new ServiceError(422, 'invalid', 'Ponele un nombre a tu app.', 'name')
  const slug = slugify(name)
  if (!slug) throw new ServiceError(422, 'invalid', 'Usá letras o números en el nombre.', 'name')
  if (findExactApp(db, name)) throw new ServiceError(409, 'duplicate', 'Ya tenés una app con ese nombre.', 'name')

  const origin: Origin = actor.kind === 'agent' ? 'agent' : 'manual'
  const app: AppRecord = {
    id: nextId(db, 'app'), slug, name, status: 'publishing', origin, publishedAt: null, lastPublishedBy: origin,
    lastAgentName: actor.kind === 'agent' ? actor.name : null,
    fileName: input.fileName, fileSize: input.fileSize, publishStartedAt: now, frozenPublish: null, statusBefore: null,
    storageMB: 0.1, entriesThisMonth: 0,
  }
  db.apps.push(app)
  db.access[slug] = [{
    id: nextId(db, 'acc'), name: db.user.name, email: db.user.email, role: 'administrar', expiresAt: null, lastEntryAt: null, isYou: true,
  }]
  addEvent(db, { type: 'publishing', appSlug: slug, appName: name, at: now, ...eventActor(actor) })
  return toApp(db, app, now)
}

/** Publica una versión nueva de una app que ya existe. */
export function publishVersion(db: Db, now: number, actor: Actor, slug: string, input: PublishInput): AppSummary {
  const app = findApp(db, slug)
  if (!app) throw new ServiceError(404, 'not_found', 'No encontramos esa app.')
  if (!trialIsOpen(db, now)) throw new ServiceError(402, 'trial_locked', TRIAL_LOCKED_MESSAGE)
  if (app.status === 'publishing') throw new ServiceError(409, 'busy', 'Esta app ya se está publicando.')
  app.statusBefore = app.status
  app.status = 'publishing'
  app.publishStartedAt = now
  app.frozenPublish = null
  app.lastPublishedBy = actor.kind === 'agent' ? 'agent' : 'manual'
  app.lastAgentName = actor.kind === 'agent' ? actor.name : null
  app.fileName = input.fileName
  app.fileSize = input.fileSize
  addEvent(db, { type: 'publishing', appSlug: app.slug, appName: app.name, at: now, ...eventActor(actor) })
  return toApp(db, app, now)
}

export function listAccess(db: Db, slug: string): AccessEntry[] {
  if (!findApp(db, slug)) throw new ServiceError(404, 'not_found', 'No encontramos esa app.')
  return (db.access[slug] ?? []).map(toAccess)
}

export function grantAccess(db: Db, now: number, actor: Actor, slug: string, input: InviteInput): AccessEntry {
  const app = findApp(db, slug)
  if (!app) throw new ServiceError(404, 'not_found', 'No encontramos esa app.')
  const email = (input.email ?? '').trim()
  if (!isEmail(email)) throw new ServiceError(422, 'invalid', 'Escribí un email válido, por ejemplo nombre@ejemplo.com.', 'email')
  if (!(['ver', 'usar', 'administrar'] as Role[]).includes(input.role)) throw new ServiceError(422, 'invalid', 'Elegí un rol.', 'role')
  if ((db.access[slug] ?? []).some((a) => a.email.toLowerCase() === email.toLowerCase())) {
    throw new ServiceError(409, 'duplicate', 'Esa persona ya tiene acceso a esta app.', 'email')
  }
  let expiresAt: number | null = null
  if (input.expiresAt) {
    const [y, m, d] = input.expiresAt.split('-').map(Number)
    expiresAt = new Date(y, m - 1, d).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= startOfDay(new Date(now)).getTime()) {
      throw new ServiceError(422, 'invalid', 'La fecha de vencimiento tiene que ser posterior a hoy.', 'expiresAt')
    }
  }
  const record: AccessRecord = {
    id: nextId(db, 'acc'), name: knownName(db, email) ?? nameFromEmail(email), email, role: input.role,
    expiresAt, lastEntryAt: null, isYou: false,
  }
  ;(db.access[slug] ??= []).push(record)
  addEvent(db, { type: 'grant', appSlug: slug, appName: app.name, at: now, person: record.name, role: record.role, ...eventActor(actor) })
  return toAccess(record)
}

export function revokeAccess(db: Db, now: number, actor: Actor, slug: string, accessId: string): AccessRecord {
  const app = findApp(db, slug)
  const list = db.access[slug] ?? []
  const record = list.find((a) => a.id === accessId)
  if (!app || !record) throw new ServiceError(404, 'not_found', 'No encontramos a esa persona.')
  if (record.isYou) throw new ServiceError(400, 'forbidden', 'No podés quitarte el acceso a vos misma.')
  db.access[slug] = list.filter((a) => a.id !== record.id)
  addEvent(db, { type: 'revoke', appSlug: slug, appName: app.name, at: now, person: record.name, ...eventActor(actor) })
  return record
}

export function listActivity(db: Db, now: number, filters: ActivityFilters): ActivityEvent[] {
  const today = startOfDay(new Date(now)).getTime()
  const since = filters.range === 'today' ? today : filters.range === '30d' ? today - 29 * DAY_MS : today - 6 * DAY_MS
  return db.events
    .filter((e) => e.at >= since)
    .filter((e) => !filters.app || e.appSlug === filters.app)
    .filter((e) => !filters.actor || filters.actor === 'all' || e.actor === filters.actor)
    .filter((e) => {
      if (filters.type === 'entry') return e.type === 'entry'
      if (filters.type === 'publish') return e.type === 'publishing' || e.type === 'published'
      if (filters.type === 'permissions') return e.type === 'grant' || e.type === 'role_change' || e.type === 'revoke'
      return true
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 100)
    .map(toEvent)
}
