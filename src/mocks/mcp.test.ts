import { describe, expect, it } from 'vitest'
import { PUBLISH_TOTAL_MS, seed, tick, type Db } from './db'
import { exchangeCode, handleMcp, revokeToken, TOOLS, type RpcRequest } from './mcp'

const NOW = new Date(2026, 9, 7, 12, 0, 0).getTime()

/** Un Claude ya conectado: pasa por el mismo canje de código que usa el clon. */
function connected(scenario: 'with-apps' | 'new-user' = 'with-apps'): { db: Db; token: string } {
  const db = seed(scenario, NOW)
  db.oauthCodes.push({ code: 'cc_test', clientId: 'claude', createdAt: NOW })
  const res = exchangeCode(db, NOW, { grant_type: 'authorization_code', code: 'cc_test', client_id: 'claude' })
  if (!res.ok) throw new Error('el canje debería funcionar')
  return { db, token: res.access_token }
}

let rpcId = 0
function call(db: Db, token: string | null, method: string, params?: RpcRequest['params'], now = NOW) {
  const reply = handleMcp(db, now, token, { jsonrpc: '2.0', id: ++rpcId, method, params })
  return reply
}

function tool(db: Db, token: string, name: string, args: Record<string, unknown> = {}, now = NOW) {
  const reply = call(db, token, 'tools/call', { name, arguments: args }, now)
  const result = (reply.body as { result: { content: { text: string }[]; structuredContent: Record<string, unknown>; isError?: boolean } }).result
  return { text: result.content[0].text, data: result.structuredContent, isError: result.isError === true }
}

describe('OAuth: canje del código', () => {
  it('registra a Claude como agente conectado, con token', () => {
    const { db, token } = connected()
    const agent = db.agents.find((a) => a.tool === 'claude-web')
    expect(agent?.token).toBe(token)
    expect(agent?.device).toBe('claude.ai')
  })

  it('el código se usa una sola vez', () => {
    const { db } = connected()
    const again = exchangeCode(db, NOW, { grant_type: 'authorization_code', code: 'cc_test', client_id: 'claude' })
    expect(again.ok).toBe(false)
  })

  it('rechaza un código vencido', () => {
    const db = seed('with-apps', NOW)
    db.oauthCodes.push({ code: 'viejo', clientId: 'claude', createdAt: NOW - 10 * 60_000 })
    expect(exchangeCode(db, NOW, { grant_type: 'authorization_code', code: 'viejo', client_id: 'claude' }).ok).toBe(false)
  })

  it('reconectar reemplaza el token y mantiene un solo agente Claude', () => {
    const { db, token } = connected()
    db.oauthCodes.push({ code: 'cc_2', clientId: 'claude', createdAt: NOW })
    const second = exchangeCode(db, NOW, { grant_type: 'authorization_code', code: 'cc_2', client_id: 'claude' })
    expect(second.ok && second.access_token).not.toBe(token)
    expect(db.agents.filter((a) => a.tool === 'claude-web')).toHaveLength(1)
    expect(call(db, token, 'ping').status).toBe(401)
  })
})

describe('protocolo MCP', () => {
  it('sin token o con un token inválido responde 401 con WWW-Authenticate', () => {
    const { db } = connected()
    for (const token of [null, 'clt_inventado']) {
      const reply = call(db, token, 'tools/list')
      expect(reply.status).toBe(401)
      expect(reply.headers?.['WWW-Authenticate']).toContain('Bearer')
    }
  })

  it('initialize presenta a Cellula', () => {
    const { db, token } = connected()
    const reply = call(db, token, 'initialize', { protocolVersion: '2025-06-18' })
    expect(reply.status).toBe(200)
    expect((reply.body as { result: { serverInfo: { name: string } } }).result.serverInfo.name).toBe('cellula')
  })

  it('tools/list ofrece las siete herramientas con su esquema', () => {
    const { db, token } = connected()
    const reply = call(db, token, 'tools/list')
    const tools = (reply.body as { result: { tools: typeof TOOLS } }).result.tools
    expect(tools.map((t) => t.name)).toEqual([
      'list_apps', 'publish_app', 'get_publish_status', 'grant_access', 'revoke_access', 'list_access', 'get_activity',
    ])
    expect(tools.every((t) => t.inputSchema.type === 'object' && t.description.length > 20)).toBe(true)
  })

  it('las notificaciones (sin id) se contestan con 202 y sin cuerpo', () => {
    const { db, token } = connected()
    const reply = handleMcp(db, NOW, token, { jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(reply.status).toBe(202)
    expect(reply.body).toBeNull()
  })

  it('un método desconocido devuelve un error JSON-RPC', () => {
    const { db, token } = connected()
    const body = call(db, token, 'resources/list').body as { error: { code: number } }
    expect(body.error.code).toBe(-32601)
  })

  it('cada pedido actualiza "último uso" del agente', () => {
    const { db, token } = connected()
    call(db, token, 'ping', undefined, NOW + 5000)
    expect(db.agents.find((a) => a.tool === 'claude-web')?.lastUsedAt).toBe(NOW + 5000)
  })
})

describe('herramientas', () => {
  it('list_apps devuelve las cuatro apps de ejemplo', () => {
    const { db, token } = connected()
    const out = tool(db, token, 'list_apps')
    expect((out.data.apps as unknown[]).length).toBe(4)
    expect(out.text).toContain('Turnos del consultorio')
  })

  it('publish_app crea la app como "Publicada por tu agente" y la deja registrada en Actividad como Claude', () => {
    const { db, token } = connected()
    const out = tool(db, token, 'publish_app', { name: 'Agenda de clases', folder: 'agenda-clases.zip' })
    expect(out.isError).toBe(false)
    expect(out.data).toMatchObject({ mode: 'new', app: { slug: 'agenda-de-clases', url: 'agenda-de-clases.cellula.app', status: 'publishing' } })

    const app = db.apps.find((a) => a.slug === 'agenda-de-clases')
    expect(app).toMatchObject({ origin: 'agent', lastPublishedBy: 'agent', lastAgentName: 'Claude' })
    const event = db.events.find((e) => e.appSlug === 'agenda-de-clases')
    expect(event).toMatchObject({ type: 'publishing', actor: 'agent', agentName: 'Claude' })
  })

  it('al terminar la publicación queda activa y se registra "publicada" por Claude', () => {
    const { db, token } = connected()
    tool(db, token, 'publish_app', { name: 'Agenda de clases' })
    const mid = tool(db, token, 'get_publish_status', { app: 'agenda de clases' }, NOW + 3000)
    expect(mid.data.status).toBe('publishing')
    expect(mid.data.stage).toBeGreaterThanOrEqual(1)

    tick(db, NOW + PUBLISH_TOTAL_MS + 1)
    const done = tool(db, token, 'get_publish_status', { app: 'agenda-de-clases' }, NOW + PUBLISH_TOTAL_MS + 1)
    expect(done.data.status).toBe('active')
    expect(db.events.find((e) => e.appSlug === 'agenda-de-clases' && e.type === 'published')).toMatchObject({ actor: 'agent', agentName: 'Claude' })
    expect(db.notifications.some((n) => n.kind === 'publish_done')).toBe(true)
  })

  it('publish_app sobre una app que ya existe publica una versión nueva', () => {
    const { db, token } = connected()
    const out = tool(db, token, 'publish_app', { name: 'Control de stock' })
    expect(out.isError).toBe(false)
    expect(out.data).toMatchObject({ mode: 'version' })
    expect(db.apps.find((a) => a.slug === 'control-stock')?.status).toBe('publishing')
  })

  it('con la prueba bloqueada, publicar falla como en el panel (hard paywall)', () => {
    const { db, token } = connected('new-user')
    const out = tool(db, token, 'publish_app', { name: 'Agenda de clases' })
    expect(out.isError).toBe(true)
    expect(out.data.error).toBe('trial_locked')
    expect(db.apps).toHaveLength(0)
  })

  it('grant_access invita a la persona y lo registra como acción del agente', () => {
    const { db, token } = connected()
    const out = tool(db, token, 'grant_access', { app: 'Turnos del consultorio', email: 'nueva.persona@ejemplo.com', role: 'usar' })
    expect(out.isError).toBe(false)
    const entry = db.access['turnos-consultorio'].find((a) => a.email === 'nueva.persona@ejemplo.com')
    expect(entry).toMatchObject({ role: 'usar', name: 'Nueva Persona' })
    expect(db.events.find((e) => e.type === 'grant' && e.person === 'Nueva Persona')).toMatchObject({ actor: 'agent', agentName: 'Claude' })
  })

  it('grant_access no repite invitaciones ni acepta emails o roles inválidos', () => {
    const { db, token } = connected()
    expect(tool(db, token, 'grant_access', { app: 'turnos', email: 'rocio.paz@gmail.com', role: 'ver' }).data.error).toBe('duplicate')
    expect(tool(db, token, 'grant_access', { app: 'turnos', email: 'no-es-un-mail', role: 'ver' }).data.error).toBe('invalid')
    expect(tool(db, token, 'grant_access', { app: 'turnos', email: 'a@b.com', role: 'jefe' }).data.error).toBe('invalid')
  })

  it('revoke_access encuentra a la persona por nombre y le quita el acceso al instante', () => {
    const { db, token } = connected()
    const out = tool(db, token, 'revoke_access', { app: 'Turnos del consultorio', person: 'Pablo Herrera' })
    expect(out.isError).toBe(false)
    expect(db.access['turnos-consultorio'].some((a) => a.name === 'Pablo Herrera')).toBe(false)
    expect(db.events.find((e) => e.type === 'revoke' && e.person === 'Pablo Herrera')).toMatchObject({ actor: 'agent' })
  })

  it('revoke_access no deja quitarle el acceso a la dueña ni inventa personas', () => {
    const { db, token } = connected()
    expect(tool(db, token, 'revoke_access', { app: 'turnos', person: 'Lucía Benítez' }).isError).toBe(true)
    expect(tool(db, token, 'revoke_access', { app: 'turnos', person: 'Fulano' }).data.error).toBe('not_found')
  })

  it('una app inexistente se informa como error de negocio, no como caída', () => {
    const { db, token } = connected()
    const out = tool(db, token, 'list_access', { app: 'La app que no existe' })
    expect(out.isError).toBe(true)
    expect(out.data.error).toBe('not_found')
  })

  it('get_activity respeta el filtro de app y trae lo que hizo el agente', () => {
    const { db, token } = connected()
    tool(db, token, 'grant_access', { app: 'control de stock', email: 'otra@ejemplo.com', role: 'ver' })
    const out = tool(db, token, 'get_activity', { app: 'Control de stock', days: 7 })
    const events = out.data.events as { text: string; app: string; who: string }[]
    expect(events.every((e) => e.app === 'Control de stock')).toBe(true)
    expect(events[0].who).toContain('Claude')
  })

  it('una herramienta que no existe devuelve un error de parámetros del protocolo', () => {
    const { db, token } = connected()
    const body = call(db, token, 'tools/call', { name: 'borrar_todo', arguments: {} }).body as { error: { code: number } }
    expect(body.error.code).toBe(-32602)
  })
})

describe('revocación simétrica', () => {
  it('si Claude se desconecta por su lado (RFC 7009), deja de figurar como agente conectado en Cellula', () => {
    const { db, token } = connected()
    expect(revokeToken(db, token)).toBe(true)
    expect(db.agents.some((a) => a.tool === 'claude-web')).toBe(false)
    expect(call(db, token, 'ping').status).toBe(401)
    expect(revokeToken(db, token)).toBe(false)
  })

  it('si se desconecta a Claude desde Cellula, su próximo pedido es rechazado', () => {
    const { db, token } = connected()
    expect(call(db, token, 'ping').status).toBe(200)
    db.agents = db.agents.filter((a) => a.tool !== 'claude-web') // lo que hace DELETE /api/agent/connections/:id
    expect(call(db, token, 'ping').status).toBe(401)
  })
})
