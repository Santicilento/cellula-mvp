import clsx from 'clsx'
import { initialsOf } from '../../lib/format'

/** Iniciales sobre fondo verde oscuro (persona logueada) o tinte (listas). */
export function Avatar({ name, tint, className }: { name: string; tint?: boolean; className?: string }) {
  return (
    <span className={clsx('cl-avatar', tint && 'cl-avatar--tint', className)} aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}
