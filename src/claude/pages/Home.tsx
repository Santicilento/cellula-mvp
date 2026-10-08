import { BookOpen, Code2, PenLine, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Composer } from '../components/Composer'
import { ClaudeMark } from '../components/ClaudeMark'
import { sendMessage } from '../store/controller'
import { useClaude } from '../store/store'
import { DEMO_PROMPT } from '../store/types'

function greeting(): string {
  const h = new Date().getHours()
  if (h >= 6 && h < 13) return 'Buen día'
  if (h >= 13 && h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const IDEAS = [
  { icon: Sparkles, label: 'Armar una app', text: DEMO_PROMPT },
  { icon: PenLine, label: 'Escribir', text: 'Ayudame a escribir un mensaje para avisarle a mis alumnas que cambia un horario' },
  { icon: BookOpen, label: 'Aprender', text: 'Explicame qué es un conector MCP' },
  { icon: Code2, label: 'Código', text: 'Haceme una calculadora de presupuestos' },
]

/** Inicio: saludo y el cuadro de texto con el prompt de la demo ya escrito. */
export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const createChat = useClaude((s) => s.createChat)
  // "Nuevo chat" cambia la clave de la ubicación: el cuadro vuelve a empezar con el prompt de la demo.
  const key = location.key

  function start(text: string) {
    const id = createChat()
    navigate(`/chat/${id}`)
    void sendMessage(id, text)
  }

  return (
    <div className="cd-home">
      <h1 className="cd-greeting">
        <ClaudeMark />
        {greeting()}, Lucía
      </h1>
      <div className="cd-home__composer">
        <Composer
          key={key}
          initial={DEMO_PROMPT}
          autoFocus
          selectOnFocus
          placeholder="¿Cómo te puedo ayudar hoy?"
          onSend={start}
        />
      </div>
      <div className="cd-chips" role="group" aria-label="Ideas para empezar">
        {IDEAS.map(({ icon: Icon, label, text }) => (
          <button key={label} type="button" className="cd-chip" onClick={() => start(text)}>
            <Icon className="cd-i" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
