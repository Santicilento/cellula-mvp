import type { Role } from '../api/types'

export const ROLES: { value: Role; label: string; help: string }[] = [
  { value: 'ver', label: 'Ver', help: 'Puede ver, sin cambiar nada.' },
  { value: 'usar', label: 'Usar', help: 'Puede ver y cargar datos.' },
  { value: 'administrar', label: 'Administrar', help: 'Puede todo, e invitar o quitar personas.' },
]

export const ROLE_LABEL: Record<Role, string> = { ver: 'Ver', usar: 'Usar', administrar: 'Administrar' }
