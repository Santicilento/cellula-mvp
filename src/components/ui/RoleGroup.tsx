import * as RadioGroup from '@radix-ui/react-radio-group'
import clsx from 'clsx'
import type { Role } from '../../api/types'
import { ROLES } from '../../lib/roles'

interface RoleGroupProps {
  value: Role
  onChange: (role: Role) => void
  name?: string
}

/** Los roles se eligen con tarjetas de radio. */
export function RoleGroup({ value, onChange, name = 'rol' }: RoleGroupProps) {
  return (
    <RadioGroup.Root
      className="role-grid"
      value={value}
      onValueChange={(v) => onChange(v as Role)}
      name={name}
      aria-label="Rol de la persona"
    >
      {ROLES.map((r) => (
        <RadioGroup.Item key={r.value} value={r.value} className={clsx('cl-role', 'role-item', value === r.value && 'cl-role--on')}>
          <span className="cl-role__radio" aria-hidden="true" />
          <span className="role-item__text">
            <strong>{r.label}</strong>
            <span>{r.help}</span>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
