import clsx from 'clsx'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

export type ButtonVariant = 'primary' | 'outline' | 'danger' | 'danger-outline' | 'link' | 'ghost'

interface Common {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  disabledLook?: boolean
}

function classes({ variant = 'outline', size = 'md', disabledLook }: Common, extra?: string) {
  return clsx(
    'cl-btn',
    variant !== 'ghost' ? `cl-btn--${variant}` : 'cl-btn--ghost',
    size === 'sm' && 'cl-btn--sm',
    size === 'lg' && 'cl-btn--lg',
    disabledLook && 'cl-btn--disabled',
    extra,
  )
}

export function Button({
  variant, size, icon, disabledLook, className, children, type = 'button', ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, size, disabledLook }, className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}

/** Botón que navega dentro de la app. */
export function ButtonLink({
  variant, size, icon, className, children, ...rest
}: Common & LinkProps) {
  return (
    <Link className={classes({ variant, size }, className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

/** Botón que abre un link externo o una pestaña nueva. */
export function ButtonAnchor({
  variant, size, icon, className, children, ...rest
}: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={classes({ variant, size }, className)} {...rest}>
      {icon}
      {children}
    </a>
  )
}
