// Piezas comunes de los handlers (REST del panel y MCP): rutas, latencia, errores y acceso a la base.

import { delay, HttpResponse } from 'msw'
import type { ApiError } from '../api/types'
import { load, save, tick, type Db } from './db'
import { ServiceError } from './service'

export const API = `${import.meta.env.BASE_URL}api`
export const route = (path: string) => `${API}${path}`

export async function latency(): Promise<void> {
  await delay(120 + Math.random() * 200)
}

export function fail(status: number, error: string, message: string, field?: string) {
  const body: ApiError = { error, message, field }
  return HttpResponse.json(body, { status })
}

/** Relee el estado, avanza el reloj, ejecuta la lógica y guarda. */
export function withDb<T>(fn: (db: Db, now: number) => T): T {
  const db = load()
  const now = Date.now()
  tick(db, now)
  const out = fn(db, now)
  save(db)
  return out
}

/** Convierte un error de regla de negocio en la respuesta HTTP que corresponde. */
export function guard<T>(fn: () => T) {
  try {
    return fn()
  } catch (e) {
    if (e instanceof ServiceError) return fail(e.status, e.code, e.message, e.field)
    throw e
  }
}
