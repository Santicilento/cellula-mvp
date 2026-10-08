// Sesión de quien recibe el link de una app (la guarda el navegador, como una cookie de sesión de Cellula).
import type { Provider } from '../api/types'

const KEY = 'cellula-mvp:visitor'

export interface Visitor {
  email: string
  name: string
  provider: Provider
}

export function getVisitor(): Visitor | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Visitor) : null
  } catch {
    return null
  }
}

export function setVisitor(v: Visitor): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // sin almacenamiento: la sesión dura lo que dure la pantalla
  }
}

export function clearVisitor(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada que borrar
  }
}
