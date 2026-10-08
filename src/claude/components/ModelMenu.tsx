import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { useClaude } from '../store/store'
import { MODELS } from '../store/types'

/** Selector de modelo. Es solo de adorno: la demo responde igual con cualquiera. */
export function ModelMenu() {
  const model = useClaude((s) => s.model)
  const setModel = useClaude((s) => s.setModel)
  const current = MODELS.find((m) => m.id === model) ?? MODELS[0]
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="cd-model" aria-label={`Modelo: ${current.name}`}>
          {current.name}
          <ChevronDown className="cd-i" style={{ width: 15, height: 15 }} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cd-menu" side="top" align="end" sideOffset={8} collisionPadding={12} style={{ width: 280 }}>
          <DropdownMenu.Label className="cd-menu__title">Modelo</DropdownMenu.Label>
          {MODELS.map((m) => (
            <DropdownMenu.Item key={m.id} className="cd-menu__item" onSelect={() => setModel(m.id)}>
              <span>
                {m.name}
                <small>{m.hint}</small>
              </span>
              {m.id === model && <Check className="cd-i cd-menu__check" aria-hidden="true" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
