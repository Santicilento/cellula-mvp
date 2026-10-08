import { describe, expect, it } from 'vitest'
import { detectIntent, fold } from './intents'

describe('fold', () => {
  it('saca acentos y mayúsculas sin cambiar el largo', () => {
    const t = '¿Quién entró a Turnos del consultorio? Ñandú'
    expect(fold(t)).toHaveLength(t.length)
    expect(fold(t)).toContain('quien entro')
  })
})

describe('frases que Cellula le sugiere pedir al agente ("Qué le podés pedir")', () => {
  it('«Publicá esta app en Cellula»', () => {
    expect(detectIntent('Publicá esta app en Cellula')).toEqual({ kind: 'publish', app: undefined })
  })

  it('«Dale acceso de Ver a ana@ejemplo.com»', () => {
    expect(detectIntent('Dale acceso de Ver a ana@ejemplo.com')).toMatchObject({
      kind: 'grant', email: 'ana@ejemplo.com', role: 'ver', roleExplicit: true, app: undefined,
    })
  })

  it('«Quitale el acceso a Pablo Herrera en Control de stock»', () => {
    expect(detectIntent('Quitale el acceso a Pablo Herrera en Control de stock')).toMatchObject({
      kind: 'revoke', person: 'Pablo Herrera', app: 'Control de stock',
    })
  })

  it('«¿Quién entró a Turnos del consultorio esta semana?»', () => {
    expect(detectIntent('¿Quién entró a Turnos del consultorio esta semana?')).toMatchObject({
      kind: 'activity', app: 'Turnos del consultorio', days: 7, onlyEntries: true,
    })
  })

  it('«Mostrame mis apps en Cellula»', () => {
    expect(detectIntent('Mostrame mis apps en Cellula').kind).toBe('list_apps')
  })
})

describe('armar una app', () => {
  it('el prompt de la demo', () => {
    expect(detectIntent('Armame una app para que mis alumnas reserven clases de yoga y yo vea quién se anotó').kind).toBe('build')
  })

  it.each([
    'Haceme una página para mi consultorio',
    'Creá una app de turnos',
    'Quiero una app para llevar el stock',
    'Necesito una herramienta para presupuestos',
    'construime una calculadora de envíos',
  ])('%s', (text) => {
    expect(detectIntent(text).kind).toBe('build')
  })

  it('"quiero publicar mi app" es publicar, no armar', () => {
    expect(detectIntent('quiero publicar mi app').kind).toBe('publish')
  })
})

describe('publicar', () => {
  it.each(['Publicala', 'publicala en cellula', 'Subila a Cellula', 'ponela online', 'Desplegá la app'])('%s', (text) => {
    expect(detectIntent(text)).toMatchObject({ kind: 'publish', app: undefined })
  })

  it('con nombre de app', () => {
    expect(detectIntent('Publicá Control de stock en Cellula')).toMatchObject({ kind: 'publish', app: 'Control de stock' })
    expect(detectIntent('publicá "Agenda de clases"')).toMatchObject({ kind: 'publish', app: 'Agenda de clases' })
  })

  it('"la app" es una referencia, no un nombre', () => {
    expect(detectIntent('Publicá la app de yoga en Cellula')).toMatchObject({ kind: 'publish', app: undefined })
  })
})

describe('dar acceso', () => {
  it('con app y rol', () => {
    expect(detectIntent('Dale acceso de Usar a ana@ejemplo.com en Agenda de clases')).toMatchObject({
      kind: 'grant', email: 'ana@ejemplo.com', role: 'usar', app: 'Agenda de clases',
    })
  })

  it('"compartí" con una app y una persona', () => {
    expect(detectIntent('Compartí Agenda de clases con ana@ejemplo.com')).toMatchObject({
      kind: 'grant', email: 'ana@ejemplo.com', app: 'Agenda de clases',
    })
  })

  it('"invitá" con rol al final', () => {
    expect(detectIntent('Invitá a rocio@gmail.com a Turnos del consultorio como administrar')).toMatchObject({
      kind: 'grant', email: 'rocio@gmail.com', role: 'administrar', app: 'Turnos del consultorio',
    })
  })

  it('sin rol dicho, usa Ver y lo marca como no explícito', () => {
    expect(detectIntent('Invitá a ana@ejemplo.com')).toMatchObject({ kind: 'grant', role: 'ver', roleExplicit: false })
  })

  it('sin email', () => {
    expect(detectIntent('Dale acceso a mi socia')).toMatchObject({ kind: 'grant', email: undefined })
  })
})

describe('quitar acceso', () => {
  it('por email', () => {
    expect(detectIntent('Sacale el acceso a ana@ejemplo.com de Agenda de clases')).toMatchObject({
      kind: 'revoke', person: 'ana@ejemplo.com', app: 'Agenda de clases',
    })
  })

  it('por nombre, sin app', () => {
    expect(detectIntent('quitale el acceso a Carolina Suárez')).toMatchObject({ kind: 'revoke', person: 'Carolina Suárez', app: undefined })
  })
})

describe('consultas', () => {
  it('actividad de hoy y del mes', () => {
    expect(detectIntent('¿Quién entró hoy a Control de stock?')).toMatchObject({ kind: 'activity', days: 1 })
    expect(detectIntent('mostrame la actividad de Turnos del consultorio de este mes')).toMatchObject({ kind: 'activity', days: 30 })
  })

  it.each(['¿Qué apps tengo?', 'Listame mis apps', 'mis apps'])('%s', (t) => {
    expect(detectIntent(t).kind).toBe('list_apps')
  })

  it('estado de la publicación', () => {
    expect(detectIntent('¿Cómo va la publicación?').kind).toBe('status')
    expect(detectIntent('ya está lista?').kind).toBe('status')
  })
})

describe('conversación', () => {
  it.each(['sí', 'Dale', 'dale, hacelo', 'ok', 'Sí, por favor', 'de una'])('confirma: %s', (t) => {
    expect(detectIntent(t).kind).toBe('confirm')
  })

  it.each(['no', 'No gracias', 'mejor no', 'dejalo'])('rechaza: %s', (t) => {
    expect(detectIntent(t).kind).toBe('deny')
  })

  it('saludos', () => {
    expect(detectIntent('Hola!').kind).toBe('greeting')
    expect(detectIntent('buenas noches').kind).toBe('greeting')
  })

  it('ayuda para conectar', () => {
    expect(detectIntent('¿Cómo conecto Cellula?').kind).toBe('connect_help')
    expect(detectIntent('qué es el MCP').kind).toBe('connect_help')
  })

  it('todo lo demás es respuesta fija', () => {
    expect(detectIntent('¿Cuál es la capital de Francia?').kind).toBe('fallback')
    expect(detectIntent('').kind).toBe('fallback')
  })
})
