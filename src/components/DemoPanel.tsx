import * as Popover from '@radix-ui/react-popover'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FlaskConical, MessageSquare, RotateCcw, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useApps, useDemo, useDemoActions } from '../api/queries'
import type { DemoState } from '../api/types'
import { Button } from './ui/Button'
import { Segmented } from './ui/Segmented'

/**
 * Panel de demo: NO es parte del producto, solo del prototipo.
 * Sirve para llegar a estados que en la vida real dependen de otras personas o del tiempo
 * (usuario nuevo, invitados que ingresan, lo que ve alguien que recibe el link).
 */
export function DemoPanel() {
  const { data: demo } = useDemo()
  const { data: apps } = useApps()
  const actions = useDemoActions()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const firstActive = apps?.find((a) => a.status === 'active')
  const pending = demo?.pendingTrialInvites ?? 0

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="demo-fab" aria-label="Abrir modo demo">
          <FlaskConical className="cl-i" aria-hidden="true" />
          Modo demo
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="demo-pop" side="top" align="end" sideOffset={10} collisionPadding={16}>
          <h2 className="demo-pop__title">Modo demo</h2>
          <p className="demo-pop__text">Solo existe en el prototipo. Sirve para llegar a pantallas que dependen del tiempo o de otras personas.</p>

          <div className="demo-pop__group">
            <span className="demo-pop__label">Escenario</span>
            <Segmented<DemoState['scenario']>
              compact
              label="Escenario"
              value={demo?.scenario ?? 'with-apps'}
              options={[
                { value: 'with-apps', label: 'Con apps' },
                { value: 'new-user', label: 'Usuario nuevo' },
              ]}
              onChange={(scenario) => {
                if (scenario === demo?.scenario) return
                actions.setScenario.mutate(scenario, {
                  onSuccess: () => {
                    toast.success(scenario === 'new-user' ? 'Escenario: usuario nuevo, sin prueba' : 'Escenario: usuario con apps y prueba en curso')
                    navigate('/apps')
                  },
                })
              }}
            />
          </div>

          <div className="demo-pop__group">
            <span className="demo-pop__label">Atajos</span>
            <Button
              size="sm"
              icon={<UserPlus className="cl-i" aria-hidden="true" />}
              disabled={pending === 0 || actions.simulateInvites.isPending}
              onClick={() => actions.simulateInvites.mutate()}
            >
              Que ingresen los invitados{pending > 0 ? ` (${pending})` : ''}
            </Button>
            <Button
              size="sm"
              icon={<MessageSquare className="cl-i" aria-hidden="true" />}
              onClick={() => window.open(`${import.meta.env.BASE_URL}claude/`, '_blank', 'noopener')}
            >
              Abrir Claude (demo)
            </Button>
            <Button
              size="sm"
              icon={<ExternalLink className="cl-i" aria-hidden="true" />}
              disabled={!firstActive}
              onClick={() => window.open(`${window.location.pathname}#/i/${firstActive?.slug}`, '_blank', 'noopener')}
            >
              Ver como invitado
            </Button>
            <Button
              size="sm"
              icon={<RotateCcw className="cl-i" aria-hidden="true" />}
              disabled={actions.reset.isPending}
              onClick={() =>
                actions.reset.mutate(undefined, {
                  onSuccess: () => {
                    qc.clear()
                    toast.success('Datos de ejemplo restablecidos')
                    navigate('/apps')
                  },
                })
              }
            >
              Restablecer datos
            </Button>
          </div>
          <p className="demo-pop__foot">Los datos viven en este navegador (localStorage).</p>
          <Popover.Arrow className="demo-pop__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
