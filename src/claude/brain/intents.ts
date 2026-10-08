// Entiende lo que escribe la persona, sin IA: reconoce frases clave en español rioplatense y saca de ahí los datos
// (email, rol, app, persona, período). Es lo que hace que el clon "interprete" los pedidos de Cellula.

import type { Role } from '../../api/types'

export type IntentKind =
  | 'build'
  | 'publish'
  | 'grant'
  | 'revoke'
  | 'list_apps'
  | 'activity'
  | 'status'
  | 'connect_help'
  | 'confirm'
  | 'deny'
  | 'greeting'
  | 'fallback'

export interface Intent {
  kind: IntentKind
  email?: string
  role?: Role
  /** El rol se dijo explícitamente (si no, se usa "ver", el más restrictivo). */
  roleExplicit?: boolean
  /** Nombre de la app, tal como lo escribió la persona (puede ser parcial). */
  app?: string
  /** Nombre o email de la persona a la que se le da o quita acceso. */
  person?: string
  days?: number
  /** "¿Quién entró…?": solo interesan los ingresos. */
  onlyEntries?: boolean
}

/** Minúsculas y sin acentos, conservando el largo (así los índices sirven para cortar el texto original). */
export function fold(text: string): string {
  return Array.from(text)
    .map((c) => {
      const base = c.normalize('NFD')[0]
      return c.length > 1 ? c : base
    })
    .join('')
    .toLowerCase()
    .replace(/[¿¡]/g, ' ')
}

function words(folded: string): string[] {
  return folded.split(/[^a-z0-9ñ@._-]+/).filter(Boolean)
}

function clean(s: string | undefined): string | undefined {
  if (!s) return undefined
  const out = s.replace(/^[«"'“”\s]+|[«»"'“”.,;:!?\s]+$/g, '').trim()
  return out || undefined
}

/** Corta del texto original el grupo que encontró una expresión sobre el texto sin acentos. */
function grab(original: string, folded: string, re: RegExp, group = 1): string | undefined {
  const m = re.exec(folded) as (RegExpExecArray & { indices?: [number, number][] }) | null
  const span = m?.indices?.[group]
  return span ? clean(original.slice(span[0], span[1])) : undefined
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/

const CONFIRM = /^(si+|sip|sep|dale|dale dale|ok|okey|oka|bueno|hacelo|hacelo nomas|adelante|de una|claro|obvio|va|listo|perfecto|genial|confirmo|confirmado|mandale|metele|yes)\b/
const DENY = /^(no|nop|nope|mejor no|cancela\w*|dejalo|dejalo asi|no gracias|nada|olvidalo)\b/
const GREETING = /^(hola|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal|como estas)\b/

const BUILD_VERB = /\b(arma\w*|hace\w*|crea\w*|constru\w*|genera\w*|programa\w*|desarrolla\w*|disena\w*)\b/
const BUILD_NOUN = /\b(app|apps|aplicacion|pagina|herramienta|sistema|sitio|web|calculadora|agenda|panel)\b/
const WANT_APP = /\b(quiero|necesito|me gustaria|tengo que)\b.*\b(una|un)\s+(app|aplicacion|herramienta|pagina|sistema|sitio)\b/

const PUBLISH =
  /\b(publica(?!cion)\w*|subi|subila|subilo|subir|ponela online|ponelo online|poner online|desplega\w*|despliegue\w*|deploy\w*|lanza\w*|mandala a cellula|pasala a cellula|llevala a cellula)\b/

const GRANT_VERB = /\b(dale|da|dar|daselo|dame|invita\w*|compart\w+|agrega\w*|suma\w*|habilita\w*|permiti\w*|otorga\w*|autoriza\w*)\b/
const REVOKE_VERB = /\b(quita\w*|saca\w*|elimina\w*|borra\w*|revoca\w*|remueve\w*|bloquea\w*|desinvita\w*)\b/

function roleOf(word: string | undefined): Role | undefined {
  if (!word) return undefined
  if (/^admin/.test(word)) return 'administrar'
  if (/^(usar|usa|usuari|cargar|editar)/.test(word)) return 'usar'
  if (/^(ver|lectura|mirar|miron)/.test(word)) return 'ver'
  return undefined
}

function extractRole(f: string): { role: Role; explicit: boolean } {
  const patterns = [
    /\b(?:acceso|permiso|rol)\s+(?:de\s+|como\s+)?(\w+)/,
    /\b(?:como|con rol|con permiso de)\s+(\w+)/,
    /\bde\s+(ver|usar|administrar|lectura)\b/,
    /\b(administrar|administrador|admin|usar)\b/,
  ]
  for (const re of patterns) {
    const found = roleOf(re.exec(f)?.[1])
    if (found) return { role: found, explicit: true }
  }
  if (/\bsolo\s+(ver|lectura)\b/.test(f)) return { role: 'ver', explicit: true }
  return { role: 'ver', explicit: false }
}

const SELF_REFERENCE = /^(esta|la|mi|mis|el|este|esa|ese|esta misma|la misma)\s+(app|apps|aplicacion|pagina|web|herramienta|sitio|carpeta|cosa)\b/

function cleanAppName(name: string | undefined): string | undefined {
  const c = clean(name)
  if (!c) return undefined
  const f = fold(c)
  if (SELF_REFERENCE.test(f)) return undefined
  if (/^(la|lo|el|ahora|ya|eso|esto|todo|nomas|de una|por favor)$/.test(f)) return undefined
  if (/^(en|a|con|usando|por|mediante)\s+cellula\b/.test(f)) return undefined
  return c.replace(/^(?:la app|la aplicacion|la pagina)\s+/i, '')
}

function extractDays(f: string): number {
  if (/\bhoy\b/.test(f)) return 1
  if (/\b(mes|30 dias|treinta dias)\b/.test(f)) return 30
  return 7
}

/** Detecta la intención de un mensaje. Es determinística: el mismo texto da siempre el mismo resultado. */
export function detectIntent(raw: string): Intent {
  const text = raw.trim()
  const f = fold(text)
  const email = EMAIL.exec(text)?.[0]
  const wordCount = words(f).length

  const mentionsAccess = /\b(acceso|permiso|permisos)\b/.test(f)

  // Respuestas cortas a una pregunta de Claude ("sí", "dale", "no, mejor no")
  if (wordCount <= 5) {
    if (DENY.test(f)) return { kind: 'deny' }
    if (CONFIRM.test(f) && !PUBLISH.test(f) && !mentionsAccess && !email) return { kind: 'confirm' }
  }
  if (GREETING.test(f) && wordCount <= 6) return { kind: 'greeting' }

  // Estado de la publicación (antes que "publicar": comparten palabras)
  if (/\b(como va|ya esta|ya termino|estado de la publicacion|termino de publicar|esta lista)\b/.test(f)) return { kind: 'status' }

  // Dar acceso
  if ((GRANT_VERB.test(f) && (mentionsAccess || email)) || /\bacceso de (ver|usar|administrar)/.test(f)) {
    if (!(REVOKE_VERB.test(f) && mentionsAccess)) {
      const { role, explicit } = extractRole(f)
      const app =
        grab(text, f, /\bcompart\w*\s+(?:la app\s+|la aplicacion\s+)?(.+?)\s+con\b/d) ??
        grab(text, f, /@\S+\s+(?:a|en|para)\s+(?:la app\s+|la aplicacion\s+)?(.+?)(?:\s+(?:como|con rol|con permiso).*)?$/d) ??
        grab(text, f, /\ben\s+(?:la app\s+|la aplicacion\s+)?([^@]+?)(?:\s+(?:como|con rol|con permiso).*)?$/d)
      return { kind: 'grant', email, role, roleExplicit: explicit, app: cleanAppName(app) }
    }
  }

  // Quitar acceso
  if (REVOKE_VERB.test(f) && (mentionsAccess || email)) {
    const m = /\bacceso\s+(?:a|de)\s+(.+?)(?:\s+(?:en|de|a)\s+(?:la app\s+|la aplicacion\s+)?(.+))?$/d.exec(f) as
      | (RegExpExecArray & { indices?: [number, number][] })
      | null
    let person = m?.indices?.[1] ? clean(text.slice(m.indices[1][0], m.indices[1][1])) : undefined
    let app = m?.indices?.[2] ? clean(text.slice(m.indices[2][0], m.indices[2][1])) : undefined
    if (email) {
      person = email
      app = app ?? grab(text, f, /@\S+\s+(?:de|en|a)\s+(?:la app\s+|la aplicacion\s+)?(.+)$/d)
    }
    return { kind: 'revoke', person, app: cleanAppName(app), email }
  }

  // Armar una app
  if ((BUILD_VERB.test(f) && BUILD_NOUN.test(f)) || WANT_APP.test(f)) return { kind: 'build' }

  // Publicar
  if (PUBLISH.test(f)) {
    const name = grab(text, f, /\b(?:publica(?!cion)\w*|subi\w*|desplega\w*|lanza\w*)\s+(.+?)(?:\s+(?:en|a|con|usando)\s+cellula.*)?$/d)
    return { kind: 'publish', app: cleanAppName(name) }
  }

  // Mostrar apps
  if (
    /\bmis apps\b/.test(f) ||
    /\b(mostra\w*|lista\w*|listame|decime|cuales)\b.*\b(apps|aplicaciones)\b/.test(f) ||
    /\bque apps\b/.test(f)
  ) {
    return { kind: 'list_apps' }
  }

  // Actividad
  if (/\bquien(?:es)?\b.*\b(entro|entraron|ingreso|ingresaron|uso|usaron|abrio|abrieron)\b/.test(f) || /\b(actividad|movimientos|que paso|ultimos ingresos)\b/.test(f)) {
    const app =
      grab(text, f, /\b(?:entro|entraron|ingreso|ingresaron|uso|usaron|abrio|abrieron)\s+(?:a|en)\s+(?:la app\s+)?(.+?)(?:\s+(?:esta semana|la semana|hoy|ayer|este mes|el mes|ultimamente|recien).*)?$/d) ??
      grab(text, f, /\bactividad\s+(?:de|en)\s+(?:la app\s+)?(.+?)(?:\s+(?:esta|este|hoy|ayer|de la semana).*)?$/d)
    return {
      kind: 'activity',
      app: cleanAppName(app),
      days: extractDays(f),
      onlyEntries: /\bquien(?:es)?\b.*\b(entro|entraron|ingreso|ingresaron)\b/.test(f),
    }
  }

  // Conectar Cellula / qué es
  if (/\b(conector(?:es)?|mcp|conectar\w*|conecto|configurar\w*|cellula)\b/.test(f)) return { kind: 'connect_help' }

  return { kind: 'fallback' }
}
