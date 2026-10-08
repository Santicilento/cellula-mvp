import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface BannerProps {
  icon?: LucideIcon
  tone?: 'brand' | 'warn'
  actions?: ReactNode
  className?: string
  children: ReactNode
}

/** Aviso de plan o de privacidad al tope de una pantalla. */
export function Banner({ icon: Icon, tone = 'brand', actions, className, children }: BannerProps) {
  return (
    <section className={clsx('cl-banner', tone === 'warn' && 'cl-banner--warn', className)}>
      {Icon && <Icon className="cl-i cl-i--lg" aria-hidden="true" />}
      <p className="cl-banner__text">{children}</p>
      {actions}
    </section>
  )
}
