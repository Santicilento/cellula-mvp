import type { ApiError } from './types'

const BASE = `${import.meta.env.BASE_URL}api`

export class HttpError extends Error {
  status: number
  code: string
  field?: string

  constructor(status: number, body: Partial<ApiError>) {
    super(body.message ?? 'Algo salió mal. Probá de nuevo.')
    this.status = status
    this.code = body.error ?? 'error'
    this.field = body.field
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) throw new HttpError(res.status, data as Partial<ApiError>)
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}
