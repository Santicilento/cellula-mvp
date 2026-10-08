import clsx from 'clsx'

/** Destello propio de la demo (un asterisco simple). No es el isotipo oficial de Claude. */
export function ClaudeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('cd-mark', className)} aria-hidden="true">
      <g fill="currentColor" transform="translate(12 12)">
        {[0, 45, 90, 135].map((angle) => (
          <rect key={angle} x="-1.3" y="-10.5" width="2.6" height="21" rx="1.3" transform={`rotate(${angle})`} />
        ))}
      </g>
    </svg>
  )
}
