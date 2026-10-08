import * as ToggleGroup from '@radix-ui/react-toggle-group'
import clsx from 'clsx'

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
  compact?: boolean
}

/** Control segmentado (filtro de una sola opción). */
export function Segmented<T extends string>({ value, onChange, options, label, compact }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      className={clsx('cl-seg', compact && 'cl-seg--compact')}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} className="cl-seg__item">
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
