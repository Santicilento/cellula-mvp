import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'error' | 'agent' | 'outline'

interface BadgeProps {
  tone?: BadgeTone
  dot?: boolean
  icon?: LucideIcon
  className?: string
  children: ReactNode
}

/** Estado de una app, rol de una persona u origen de un movimiento. */
export function Badge({ tone = 'neutral', dot, icon: Icon, className, children }: BadgeProps) {
  return (
    <span className={clsx('cl-badge', tone !== 'neutral' && `cl-badge--${tone}`, className)}>
      {dot && <span className="cl-badge__dot" aria-hidden="true" />}
      {Icon && <Icon className="cl-i" aria-hidden="true" />}
      {children}
    </span>
  )
}
