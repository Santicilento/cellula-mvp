// Backend fake: la API REST de Cellula, simulada con Mock Service Worker.
// El front hace fetch('/api/...') como si hubiera un servidor real; acá se contesta con la base de src/mocks/db.ts.
// Las reglas de negocio viven en src/mocks/service.ts (las comparte con el conector MCP de src/mocks/mcp.ts).

import { delay, http, HttpResponse } from 'msw'
import type {
  AgentStatus,
  AgentTestResult,
  AgentTool,
  AppNotification,
  DemoState,
  GateInfo,
  GateResult,
  InviteInput,
  OAuthAuthorizeInput,
  OAuthAuthorizeResult,
  Provider,
  PublishInput,
  Usage,
} from '../api/types'
import { AGENT_NAME } from '../lib/agents'
import { isEmail, monthYear } from '../lib/format'
import { tableMetas, tablePage, tablesFor } from './data'
import {
  activeAccess,
  load,
  nextId,
  QUOTA_MB,
  save,
  seed,
  tick,
  TRIAL_INVITE_STEP_MS,
  TRIAL_REQUIRED,
  type Db,
} from './db'
import { fail, guard, latency, route, withDb } from './runtime'
import {
  addEvent,
  evaluateAccess,
  findApp,
  grantAccess,
  listAccess,
  listActivity,
  listApps,
  PANEL,
  publishApp,
  publishVersion,
  revokeAccess,
  toApp,
  toTrial,
} from './service'

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
    return HttpResponse.json(withDb((db, now) => listApps(db, now)))
  }),

  http.post(route('/apps'), async ({ request }) => {
    const body = (await request.json()) as PublishInput
    await latency()
    return withDb((db, now) =>
      guard(() => HttpResponse.json(publishApp(db, now, PANEL, body), { status: 201 })),
    )
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
    return withDb((db, now) =>
      guard(() => HttpResponse.json(publishVersion(db, now, PANEL, String(params.slug), body), { status: 201 })),
    )
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
    return withDb((db) => guard(() => HttpResponse.json(listAccess(db, String(params.slug)))))
  }),

  http.post(route('/apps/:slug/access'), async ({ params, request }) => {
    const body = (await request.json()) as InviteInput
    await latency()
    return withDb((db, now) =>
      guard(() => HttpResponse.json(grantAccess(db, now, PANEL, String(params.slug), body), { status: 201 })),
    )
  }),

  http.delete(route('/apps/:slug/access/:id'), async ({ params }) => {
    await latency()
    return withDb((db, now) =>
      guard(() => {
        revokeAccess(db, now, PANEL, String(params.slug), String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
  }),

  // Actividad
  http.get(route('/activity'), async ({ request }) => {
    const url = new URL(request.url)
    await latency()
    return HttpResponse.json(
      withDb((db, now) =>
        listActivity(db, now, {
          app: url.searchParams.get('app') ?? undefined,
          actor: (url.searchParams.get('actor') as 'all' | 'agent' | 'panel') ?? 'all',
          type: (url.searchParams.get('type') as 'all' | 'entry' | 'publish' | 'permissions') ?? 'all',
          range: (url.searchParams.get('range') as 'today' | '7d' | '30d') ?? '7d',
        }),
      ),
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
          id: a.id, tool: a.tool, name: AGENT_NAME[a.tool], device: a.device, lastUsedAt: new Date(a.lastUsedAt).toISOString(),
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
        // Claude (web) se conecta de verdad desde Configuración → Conectores: acá no se "conecta solo".
        if (tool === 'claude-web') {
          return {
            ok: false, tool,
            message: 'Todavía no agregaste Cellula en Claude. Abrí Configuración → Conectores y seguí los pasos.',
          }
        }
        db.agentAttempts[tool] = (db.agentAttempts[tool] ?? 0) + 1
        if (db.agentAttempts[tool] >= 2) {
          db.agents.push({ id: nextId(db, 'ag'), tool, device: 'Este equipo', lastUsedAt: now, token: null })
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

  // Autorización del conector (la pantalla "Claude quiere conectarse a tu cuenta de Cellula" llama a esto al tocar Permitir).
  http.post(route('/oauth/authorize'), async ({ request }) => {
    const body = (await request.json()) as OAuthAuthorizeInput
    await latency()
    return withDb((db, now) => {
      if (body.client_id !== 'claude') return fail(400, 'invalid_client', 'No conocemos a esa aplicación.')
      const code = `cc_${nextId(db, 'code')}_${Math.random().toString(36).slice(2, 10)}`
      db.oauthCodes = [...db.oauthCodes.filter((c) => now - c.createdAt < 5 * 60_000), { code, clientId: body.client_id, createdAt: now }]
      const out: OAuthAuthorizeResult = { code, state: body.state }
      return HttpResponse.json(out)
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
        db.notifications.filter((n) => !n.read).map((n) => ({ ...n, at: new Date(n.at).toISOString() })),
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
