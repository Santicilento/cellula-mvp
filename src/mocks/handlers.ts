// Backend fake: la API REST de Cellula, simulada con Mock Service Worker.
// El front hace fetch('/api/...') como si hubiera un servidor real; acá se contesta con la base de src/mocks/db.ts.

import { delay, http, HttpResponse } from 'msw'
import type {
  AccessEntry,
  ActivityEvent,
  ActivityFilters,
  AgentStatus,
  AgentTestResult,
  AgentTool,
  ApiError,
  AppNotification,
  AppSummary,
  DemoState,
  GateInfo,
  GateResult,
  InviteInput,
  Provider,
  PublishInput,
  PublishProgress,
  Role,
  Trial,
  Usage,
} from '../api/types'
import { daysBetween, DAY_MS, isEmail, monthYear, slugify, startOfDay } from '../lib/format'
import { tableMetas, tablePage, tablesFor } from './data'
import {
  activeAccess,
  load,
  nextId,
  PUBLISH_PREPARE_MS,
  PUBLISH_UPLOAD_MS,
  QUOTA_MB,
  save,
  seed,
  tick,
  TRIAL_DAYS,
  TRIAL_INVITE_STEP_MS,
  TRIAL_REQUIRED,
  trialEndsAt,
  type AccessRecord,
  type AppRecord,
  type Db,
  type EventRecord,
} from './db'

const API = `${import.meta.env.BASE_URL}api`
const route = (path: string) => `${API}${path}`

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString())
const isoOrThrow = (ms: number): string => new Date(ms).toISOString()

async function latency(): Promise<void> {
  await delay(120 + Math.random() * 200)
}

function fail(status: number, error: string, message: string, field?: string) {
  const body: ApiError = { error, message, field }
  return HttpResponse.json(body, { status })
}

/** Relee el estado, avanza el reloj, ejecuta la lógica y guarda. */
function withDb<T>(fn: (db: Db, now: number) => T): T {
  const db = load()
  const now = Date.now()
  tick(db, now)
  const out = fn(db, now)
  save(db)
  return out
}

// ───────────── conversiones a la forma de la API ─────────────

function publishProgress(app: AppRecord, now: number): PublishProgress | null {
  if (app.status !== 'publishing') return null
  if (app.frozenPublish) return app.frozenPublish
  const elapsed = now - (app.publishStartedAt ?? now)
  if (elapsed < PUBLISH_PREPARE_MS) return { stage: 1, percent: 0 }
  if (elapsed < PUBLISH_PREPARE_MS + PUBLISH_UPLOAD_MS) {
    return { stage: 2, percent: Math.round(((elapsed - PUBLISH_PREPARE_MS) / PUBLISH_UPLOAD_MS) * 100) }
  }
  return { stage: 3, percent: 100 }
}

function toApp(db: Db, app: AppRecord, now: number): AppSummary {
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

function toAccess(a: AccessRecord): AccessEntry {
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

function toEvent(e: EventRecord): ActivityEvent {
  return { ...e, at: isoOrThrow(e.at) }
}

function toTrial(db: Db, now: number): Trial {
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

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function knownName(db: Db, email: string): string | null {
  const needle = email.trim().toLowerCase()
  for (const list of Object.values(db.access)) {
    const hit = list.find((a) => a.email.toLowerCase() === needle)
    if (hit) return hit.name
  }
  if (needle === 'diego.fernandez@gmail.com') return 'Diego Fernández'
  return null
}

function findApp(db: Db, slug: string): AppRecord | undefined {
  return db.apps.find((a) => a.slug === slug)
}

function addEvent(db: Db, e: Omit<EventRecord, 'id' | 'agentName' | 'provider' | 'person' | 'role' | 'fromRole'> & Partial<EventRecord>) {
  db.events.push({
    id: nextId(db, 'ev'),
    agentName: null, provider: null, person: null, role: null, fromRole: null,
    ...e,
  })
}

function trialIsOpen(db: Db, now: number): boolean {
  const ends = trialEndsAt(db)
  return db.trialUnlockedAt !== null && ends !== null && now < ends
}

function evaluateAccess(db: Db, slug: string, emailRaw: string, now: number):
  | { ok: true; record: AccessRecord }
  | { ok: false; reason: 'not_invited' | 'expired' } {
  const email = emailRaw.trim().toLowerCase()
  const record = (db.access[slug] ?? []).find((a) => a.email.toLowerCase() === email)
  if (!record) return { ok: false, reason: 'not_invited' }
  if (record.expiresAt !== null && record.expiresAt < startOfDay(new Date(now)).getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, record }
}

// ───────────── handlers ─────────────

export const handlers = [
  // Cuenta y prueba gratis
  http.get(route('/me'), async () => {
    await latency()
    return HttpResponse.json(withDb((db) => db.user))
  }),

  http.get(route('/trial'), async () => {
    await latency()
    return HttpResponse.json(withDb((db, now) => toTrial(db, now)))
  }),

  http.post(route('/trial/invites'), async ({ request }) => {
    const body = (await request.json()) as { emails?: string[] }
    await latency()
    const emails = (body.emails ?? []).map((e) => e.trim()).filter(Boolean)
    return withDb((db, now) => {
      if (emails.length === 0) return fail(422, 'invalid', 'Escribí al menos un email.', 'emails')
      const bad = emails.find((e) => !isEmail(e))
      if (bad) return fail(422, 'invalid', `«${bad}» no parece un email válido.`, 'emails')
      const seen = new Set(db.trialInvites.map((i) => i.email.toLowerCase()))
      seen.add(db.user.email.toLowerCase())
      const fresh: string[] = []
      for (const e of emails) {
        const key = e.toLowerCase()
        if (seen.has(key)) return fail(409, 'duplicate', `Ya invitaste a ${e}, o es tu propio email.`, 'emails')
        seen.add(key)
        fresh.push(e)
      }
      if (db.trialInvites.length + fresh.length > TRIAL_REQUIRED) {
        return fail(422, 'too_many', `Con ${TRIAL_REQUIRED} personas alcanza.`, 'emails')
      }
      let at = Math.max(now, ...db.trialInvites.map((i) => i.enterAt))
      for (const email of fresh) {
        at += TRIAL_INVITE_STEP_MS
        db.trialInvites.push({ id: nextId(db, 'inv'), email, sentAt: now, enterAt: at, enteredAt: null })
      }
      return HttpResponse.json(toTrial(db, now), { status: 201 })
    })
  }),

  // Apps
  http.get(route('/apps'), async () => {
    await latency()
    return HttpResponse.json(withDb((db, now) => db.apps.map((a) => toApp(db, a, now))))
  }),

  http.post(route('/apps'), async ({ request }) => {
    const body = (await request.json()) as PublishInput
    await latency()
    return withDb((db, now) => {
      if (!trialIsOpen(db, now)) {
        return fail(402, 'trial_locked', 'Para publicar, desbloqueá tu prueba gratis invitando a 3 personas.')
      }
      const name = (body.name ?? '').trim()
      if (name.length < 2) return fail(422, 'invalid', 'Ponele un nombre a tu app.', 'name')
      const slug = slugify(name)
      if (!slug) return fail(422, 'invalid', 'Usá letras o números en el nombre.', 'name')
      if (findApp(db, slug)) return fail(409, 'duplicate', 'Ya tenés una app con ese nombre.', 'name')
      const app: AppRecord = {
        id: nextId(db, 'app'), slug, name, status: 'publishing', origin: 'manual', publishedAt: null, lastPublishedBy: 'manual',
        fileName: body.fileName, fileSize: body.fileSize, publishStartedAt: now, frozenPublish: null, statusBefore: null,
        storageMB: 0.1, entriesThisMonth: 0,
      }
      db.apps.push(app)
      db.access[slug] = [{
        id: nextId(db, 'acc'), name: db.user.name, email: db.user.email, role: 'administrar', expiresAt: null, lastEntryAt: null, isYou: true,
      }]
      addEvent(db, { type: 'publishing', actor: 'panel', appSlug: slug, appName: name, at: now })
      return HttpResponse.json(toApp(db, app, now), { status: 201 })
    })
  }),

  http.get(route('/apps/:slug'), async ({ params }) => {
    await latency()
    return withDb((db, now) => {
      const app = findApp(db, String(params.slug))
      return app ? HttpResponse.json(toApp(db, app, now)) : fail(404, 'not_found', 'No encontramos esa app.')
    })
  }),

  http.patch(route('/apps/:slug'), async ({ params, request }) => {
    const body = (await request.json()) as { name?: string }
    await latency()
    return withDb((db, now) => {
      const app = findApp(db, String(params.slug))
      if (!app) return fail(404, 'not_found', 'No encontramos esa app.')
      const name = (body.name ?? '').trim()
      if (name.length < 2) return fail(422, 'invalid', 'Ponele un nombre a tu app.', 'name')
      app.name = name
      for (const e of db.events) if (e.appSlug === app.slug) e.appName = name
      return HttpResponse.json(toApp(db, app, now))
    })
  }),

  http.delete(route('/apps/:slug'), async ({ params }) => {
    await latency()
    return withDb((db) => {
      const slug = String(params.slug)
      if (!findApp(db, slug)) return fail(404, 'not_found', 'No encontramos esa app.')
      db.apps = db.apps.filter((a) => a.slug !== slug)
      delete db.access[slug]
      db.events = db.events.filter((e) => e.appSlug !== slug)
      return new HttpResponse(null, { status: 204 })
    })
  }),

  http.post(route('/apps/:slug/versions'), async ({ params, request }) => {
    const body = (await request.json()) as PublishInput
    await latency()
    return withDb((db, now) => {
      const app = findApp(db, String(params.slug))
      if (!app) return fail(404, 'not_found', 'No encontramos esa app.')
      if (!trialIsOpen(db, now)) return fail(402, 'trial_locked', 'Para publicar, desbloqueá tu prueba gratis invitando a 3 personas.')
      if (app.status === 'publishing') return fail(409, 'busy', 'Esta app ya se está publicando.')
      app.statusBefore = app.status
      app.status = 'publishing'
      app.publishStartedAt = now
      app.frozenPublish = null
      app.lastPublishedBy = 'manual'
      app.fileName = body.fileName
      app.fileSize = body.fileSize
      addEvent(db, { type: 'publishing', actor: 'panel', appSlug: app.slug, appName: app.name, at: now })
      return HttpResponse.json(toApp(db, app, now), { status: 201 })
    })
  }),

  http.post(route('/apps/:slug/cancel-publish'), async ({ params }) => {
    await latency()
    return withDb((db) => {
      const slug = String(params.slug)
      const app = findApp(db, slug)
      if (!app) return fail(404, 'not_found', 'No encontramos esa app.')
      if (app.status === 'publishing') {
        const started = app.publishStartedAt ?? 0
        db.events = db.events.filter((e) => !(e.type === 'publishing' && e.appSlug === slug && e.at >= started))
        if (app.statusBefore) {
          app.status = app.statusBefore
          app.statusBefore = null
          app.publishStartedAt = null
        } else {
          db.apps = db.apps.filter((a) => a.slug !== slug)
          delete db.access[slug]
        }
      }
      return new HttpResponse(null, { status: 204 })
    })
  }),

  // Accesos
  http.get(route('/apps/:slug/access'), async ({ params }) => {
    await latency()
    return withDb((db) => {
      const slug = String(params.slug)
      if (!findApp(db, slug)) return fail(404, 'not_found', 'No encontramos esa app.')
      return HttpResponse.json((db.access[slug] ?? []).map(toAccess))
    })
  }),

  http.post(route('/apps/:slug/access'), async ({ params, request }) => {
    const body = (await request.json()) as InviteInput
    await latency()
    return withDb((db, now) => {
      const slug = String(params.slug)
      const app = findApp(db, slug)
      if (!app) return fail(404, 'not_found', 'No encontramos esa app.')
      const email = (body.email ?? '').trim()
      if (!isEmail(email)) return fail(422, 'invalid', 'Escribí un email válido, por ejemplo nombre@ejemplo.com.', 'email')
      if (!(['ver', 'usar', 'administrar'] as Role[]).includes(body.role)) return fail(422, 'invalid', 'Elegí un rol.', 'role')
      if ((db.access[slug] ?? []).some((a) => a.email.toLowerCase() === email.toLowerCase())) {
        return fail(409, 'duplicate', 'Esa persona ya tiene acceso a esta app.', 'email')
      }
      let expiresAt: number | null = null
      if (body.expiresAt) {
        const [y, m, d] = body.expiresAt.split('-').map(Number)
        expiresAt = new Date(y, m - 1, d).getTime()
        if (expiresAt <= startOfDay(new Date(now)).getTime()) {
          return fail(422, 'invalid', 'La fecha de vencimiento tiene que ser posterior a hoy.', 'expiresAt')
        }
      }
      const record: AccessRecord = {
        id: nextId(db, 'acc'), name: knownName(db, email) ?? nameFromEmail(email), email, role: body.role,
        expiresAt, lastEntryAt: null, isYou: false,
      }
      ;(db.access[slug] ??= []).push(record)
      addEvent(db, { type: 'grant', actor: 'panel', appSlug: slug, appName: app.name, at: now, person: record.name, role: record.role })
      return HttpResponse.json(toAccess(record), { status: 201 })
    })
  }),

  http.delete(route('/apps/:slug/access/:id'), async ({ params }) => {
    await latency()
    return withDb((db, now) => {
      const slug = String(params.slug)
      const app = findApp(db, slug)
      const list = db.access[slug] ?? []
      const record = list.find((a) => a.id === params.id)
      if (!app || !record) return fail(404, 'not_found', 'No encontramos a esa persona.')
      if (record.isYou) return fail(400, 'forbidden', 'No podés quitarte el acceso a vos misma.')
      db.access[slug] = list.filter((a) => a.id !== record.id)
      addEvent(db, { type: 'revoke', actor: 'panel', appSlug: slug, appName: app.name, at: now, person: record.name })
      return new HttpResponse(null, { status: 204 })
    })
  }),

  // Actividad
  http.get(route('/activity'), async ({ request }) => {
    const url = new URL(request.url)
    const filters: ActivityFilters = {
      app: url.searchParams.get('app') ?? undefined,
      actor: (url.searchParams.get('actor') as ActivityFilters['actor']) ?? 'all',
      type: (url.searchParams.get('type') as ActivityFilters['type']) ?? 'all',
      range: (url.searchParams.get('range') as ActivityFilters['range']) ?? '7d',
    }
    await latency()
    return HttpResponse.json(
      withDb((db, now) => {
        const today = startOfDay(new Date(now)).getTime()
        const since = filters.range === 'today' ? today : filters.range === '30d' ? today - 29 * DAY_MS : today - 6 * DAY_MS
        return db.events
          .filter((e) => e.at >= since)
          .filter((e) => !filters.app || e.appSlug === filters.app)
          .filter((e) => filters.actor === 'all' || e.actor === filters.actor)
          .filter((e) => {
            if (filters.type === 'entry') return e.type === 'entry'
            if (filters.type === 'publish') return e.type === 'publishing' || e.type === 'published'
            if (filters.type === 'permissions') return e.type === 'grant' || e.type === 'role_change' || e.type === 'revoke'
            return true
          })
          .sort((a, b) => b.at - a.at)
          .slice(0, 100)
          .map(toEvent)
      }),
    )
  }),

  // Datos que guarda cada app
  http.get(route('/apps/:slug/data'), async ({ params }) => {
    await latency()
    return withDb((db) => {
      const slug = String(params.slug)
      const app = findApp(db, slug)
      if (!app) return fail(404, 'not_found', 'No encontramos esa app.')
      return HttpResponse.json({ tables: tableMetas(slug), usedMB: app.storageMB, quotaMB: QUOTA_MB })
    })
  }),

  http.get(route('/apps/:slug/data/:table'), async ({ params, request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? 6)))
    await latency()
    return withDb((db) => {
      const slug = String(params.slug)
      if (!findApp(db, slug)) return fail(404, 'not_found', 'No encontramos esa app.')
      const result = tablePage(slug, String(params.table), page, pageSize)
      if (!result || tablesFor(slug).length === 0) return fail(404, 'not_found', 'No encontramos esa tabla.')
      return HttpResponse.json(result)
    })
  }),

  // Conector del agente
  http.get(route('/agent'), async () => {
    await latency()
    return HttpResponse.json(
      withDb((db): AgentStatus => ({
        connections: db.agents.map((a) => ({
          id: a.id, tool: a.tool, name: a.tool === 'claude' ? 'Claude Code' : 'Cursor', device: a.device, lastUsedAt: isoOrThrow(a.lastUsedAt),
        })),
      })),
    )
  }),

  http.post(route('/agent/:tool/test'), async ({ params }) => {
    await delay(700 + Math.random() * 500)
    const tool = String(params.tool) as AgentTool
    return HttpResponse.json(
      withDb((db, now): AgentTestResult => {
        const existing = db.agents.find((a) => a.tool === tool)
        if (existing) {
          existing.lastUsedAt = now
          return { ok: true, tool, message: 'La conexión funciona: tu agente respondió con la lista de tus apps.' }
        }
        db.agentAttempts[tool] = (db.agentAttempts[tool] ?? 0) + 1
        if (db.agentAttempts[tool] >= 2) {
          db.agents.push({ id: nextId(db, 'ag'), tool, device: 'Este equipo', lastUsedAt: now })
          db.agentAttempts[tool] = 0
          return { ok: true, tool, message: '¡Listo! Tu agente respondió con la lista de tus apps.' }
        }
        return {
          ok: false, tool,
          message: 'Todavía no recibimos nada de tu agente. Revisá los pasos 2 y 3 y volvé a probar.',
        }
      }),
    )
  }),

  http.delete(route('/agent/connections/:id'), async ({ params }) => {
    await latency()
    return withDb((db) => {
      const found = db.agents.find((a) => a.id === params.id)
      if (!found) return fail(404, 'not_found', 'No encontramos esa conexión.')
      db.agents = db.agents.filter((a) => a.id !== found.id)
      db.agentAttempts[found.tool] = 0
      return new HttpResponse(null, { status: 204 })
    })
  }),

  // Uso y plan
  http.get(route('/usage'), async () => {
    await latency()
    return HttpResponse.json(
      withDb((db, now): Usage => {
        const people = db.apps.reduce((sum, a) => sum + activeAccess(db, a.slug, now).length, 0)
        const entries = db.apps.reduce((sum, a) => sum + a.entriesThisMonth, 0)
        return {
          activeApps: db.apps.filter((a) => a.status !== 'error').length,
          publishedApps: db.apps.length,
          peopleWithAccess: people,
          entriesThisMonth: entries,
          entriesByApp: db.apps.map((a) => ({ slug: a.slug, name: a.name, entries: a.entriesThisMonth })),
          monthLabel: monthYear(new Date(now)),
        }
      }),
    )
  }),

  // Avisos (reemplaza a un websocket: el front pregunta cada tanto)
  http.get(route('/notifications'), async () => {
    return HttpResponse.json(
      withDb((db): AppNotification[] =>
        db.notifications.filter((n) => !n.read).map((n) => ({ ...n, at: isoOrThrow(n.at) })),
      ),
    )
  }),

  http.post(route('/notifications/ack'), async ({ request }) => {
    const body = (await request.json()) as { ids: string[] }
    return withDb((db) => {
      for (const n of db.notifications) if (body.ids.includes(n.id)) n.read = true
      return new HttpResponse(null, { status: 204 })
    })
  }),

  // Puerta de la app (lo que ve quien recibe el link). El login y el permiso los resuelve Cellula, no la app.
  http.get(route('/gate/:slug'), async ({ params }) => {
    await latency()
    return withDb((db) => {
      const app = findApp(db, String(params.slug))
      if (!app) return fail(404, 'not_found', 'Esta app no existe.')
      const info: GateInfo = { slug: app.slug, name: app.name, ownerName: db.user.name, available: app.status === 'active' }
      return HttpResponse.json(info)
    })
  }),

  http.post(route('/gate/:slug/login'), async ({ params, request }) => {
    const body = (await request.json()) as { email: string; provider: Provider }
    await delay(500 + Math.random() * 300)
    return withDb((db, now) => {
      const slug = String(params.slug)
      const app = findApp(db, slug)
      if (!app) return fail(404, 'not_found', 'Esta app no existe.')
      const verdict = evaluateAccess(db, slug, body.email, now)
      if (!verdict.ok) {
        const denied: GateResult = { status: 'denied', email: body.email.trim(), reason: verdict.reason }
        return HttpResponse.json(denied)
      }
      verdict.record.lastEntryAt = now
      app.entriesThisMonth += 1
      addEvent(db, {
        type: 'entry', actor: 'guest', appSlug: slug, appName: app.name, at: now,
        person: verdict.record.name, provider: body.provider,
      })
      const granted: GateResult = {
        status: 'granted', email: verdict.record.email, name: verdict.record.name, role: verdict.record.role, provider: body.provider,
      }
      return HttpResponse.json(granted)
    })
  }),

  http.get(route('/gate/:slug/session'), async ({ params, request }) => {
    const email = new URL(request.url).searchParams.get('email') ?? ''
    const provider = (new URL(request.url).searchParams.get('provider') as Provider) ?? 'google'
    return withDb((db, now) => {
      const slug = String(params.slug)
      if (!findApp(db, slug)) return fail(404, 'not_found', 'Esta app no existe.')
      const verdict = evaluateAccess(db, slug, email, now)
      const out: GateResult = verdict.ok
        ? { status: 'granted', email: verdict.record.email, name: verdict.record.name, role: verdict.record.role, provider }
        : { status: 'denied', email, reason: verdict.reason === 'expired' ? 'expired' : 'removed' }
      return HttpResponse.json(out)
    })
  }),

  // Modo demo (no existe en un backend real)
  http.get(route('/demo'), async () => {
    return HttpResponse.json(
      withDb((db): DemoState => ({
        scenario: db.scenario,
        pendingTrialInvites: db.trialInvites.filter((i) => i.enteredAt === null).length,
      })),
    )
  }),

  http.post(route('/demo/scenario'), async ({ request }) => {
    const body = (await request.json()) as { scenario: Db['scenario'] }
    await latency()
    save(seed(body.scenario === 'new-user' ? 'new-user' : 'with-apps'))
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(route('/demo/reset'), async () => {
    await latency()
    save(seed(load().scenario))
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(route('/demo/simulate-invites'), async () => {
    await latency()
    withDb((db, now) => {
      for (const inv of db.trialInvites) if (inv.enteredAt === null) inv.enterAt = now
      tick(db, now)
    })
    return new HttpResponse(null, { status: 204 })
  }),
]
