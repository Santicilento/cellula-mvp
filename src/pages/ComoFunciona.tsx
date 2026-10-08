import { PageHeader } from '../components/layout/PageHeader'
import { usePageTitle } from '../lib/usePageTitle'

type Lane = 'vos' | 'agente' | 'cellula' | 'invitado'

const LANES: { id: Lane; title: string; text: string }[] = [
  { id: 'vos', title: 'Vos', text: 'Quien creó la herramienta' },
  { id: 'agente', title: 'Tu agente de IA', text: 'Claude Code o Cursor' },
  { id: 'cellula', title: 'Cellula', text: 'La plataforma' },
  { id: 'invitado', title: 'Tu invitado', text: 'Quien recibe el link' },
]

interface Step {
  n: number
  lane: Lane
  col: number
  title: string
  text: string
  solid?: boolean
}

const STEPS: Step[] = [
  { n: 1, lane: 'vos', col: 1, title: 'Le pedís a tu agente', text: '«Publicá esta app»' },
  { n: 2, lane: 'agente', col: 1, title: 'El agente usa el conector de Cellula', text: 'Le pasa tu pedido a la plataforma' },
  { n: 3, lane: 'cellula', col: 1, title: 'Cellula publica tu app', text: 'En un entorno aislado y con el login activado', solid: true },
  { n: 4, lane: 'agente', col: 2, title: 'Recibe la URL privada', text: 'Cellula se la devuelve al agente' },
  { n: 5, lane: 'vos', col: 3, title: 'Compartís el link', text: 'Solo con quien vos elijas' },
  { n: 6, lane: 'invitado', col: 4, title: 'El invitado entra', text: 'Con su cuenta de Google o Microsoft' },
  { n: 7, lane: 'cellula', col: 4, title: 'Cellula verifica el permiso', text: 'Ver, Usar o Administrar', solid: true },
  { n: 8, lane: 'invitado', col: 5, title: 'Pasa a la app', text: 'Solo si tiene permiso' },
]

/** Figura 7 del TPO: del pedido al agente hasta que un invitado entra con su cuenta. */
export default function ComoFunciona() {
  usePageTitle('Cómo funciona el conector')
  return (
    <div className="page">
      <PageHeader
        back={{ to: '/agente', label: 'Conectar mi agente' }}
        title="Cómo funciona el conector MCP de Cellula"
        subtitle="De pedirle a tu agente que publique, a que un invitado entre con su propia cuenta."
      />

      {/* Pantallas anchas: carriles por actor. */}
      <div className="flow" role="group" aria-label="Recorrido en ocho pasos, agrupado por quién actúa">
        {LANES.map((lane, i) => (
          <div key={lane.id} className={`flow__lane flow__lane--${lane.id}`} style={{ gridRow: i + 1 }}>
            <b>{lane.title}</b>
            <span>{lane.text}</span>
          </div>
        ))}
        {STEPS.map((s) => (
          <div
            key={s.n}
            className={`flow__step${s.solid ? ' flow__step--solid' : ''}`}
            style={{ gridRow: LANES.findIndex((l) => l.id === s.lane) + 1, gridColumn: s.col + 1 }}
          >
            <span className="flow__n">{s.n}</span>
            <b>{s.title}</b>
            <span>{s.text}</span>
            {s.n === 2 && <span className="flow__pill">Conector MCP</span>}
          </div>
        ))}
        <div className="flow__panel" style={{ gridRow: 1, gridColumn: '5 / span 2' }}>
          <b>También lo podés hacer desde el panel</b>
          <span>Publicar, dar acceso o quitarlo: lo mismo, con clics y sin usar al agente.</span>
        </div>
      </div>

      {/* Pantallas angostas: los mismos pasos, en orden. */}
      <ol className="flow-list">
        {STEPS.map((s) => (
          <li key={s.n} className={s.solid ? 'flow-list__solid' : undefined}>
            <span className="flow__n">{s.n}</span>
            <span>
              <b>{s.title}</b>
              <span>{s.text}</span>
              <em>{LANES.find((l) => l.id === s.lane)?.title}</em>
            </span>
          </li>
        ))}
      </ol>

      <div className="flow-callouts">
        <section className="flow-callout flow-callout--solid">
          <h2>El login vive en la plataforma, no en la app</h2>
          <p>Cellula pide Google o Microsoft y revisa el permiso antes de dejar pasar a nadie (pasos 3 y 7). Tu app no maneja usuarios ni contraseñas.</p>
        </section>
        <section className="flow-callout">
          <h2>La misma acción, desde el panel o desde el agente</h2>
          <p>Publicar, dar acceso o quitarlo se hace con clics en el panel o pidiéndoselo a tu agente por el conector MCP.</p>
        </section>
      </div>
    </div>
  )
}
