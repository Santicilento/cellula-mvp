import clsx from 'clsx'
import type { CSSProperties } from 'react'

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={clsx('cl-skel', className)} style={style} aria-hidden="true" />
}
