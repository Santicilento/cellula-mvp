// Agenda de clases: la app que "armó" Claude en la demo.
// Las alumnas reservan su lugar en cada clase de yoga; la instructora ve quiénes se anotaron.
import { useEffect, useState } from 'react'

interface Clase {
  id: string
  dia: string
  hora: string
  nombre: string
  cupo: number
  anotadas: string[]
}

const CLASES_INICIALES: Clase[] = [
  { id: 'lun-09', dia: 'Lun', hora: '09:00', nombre: 'Hatha suave', cupo: 10, anotadas: ['Camila R.', 'Sofi P.', 'Marina L.'] },
  { id: 'lun-1830', dia: 'Lun', hora: '18:30', nombre: 'Vinyasa', cupo: 12, anotadas: ['Julia M.', 'Paula G.', 'Romina S.', 'Eli T.', 'Noe B.'] },
  { id: 'mar-08', dia: 'Mar', hora: '08:00', nombre: 'Yin yoga', cupo: 8, anotadas: ['Marina L.', 'Dani C.'] },
  { id: 'mie-1830', dia: 'Mié', hora: '18:30', nombre: 'Vinyasa', cupo: 12, anotadas: ['Julia M.', 'Paula G.', 'Lau V.', 'Cande R.', 'Romina S.', 'Eli T.', 'Noe B.', 'Flor A.', 'Mili D.', 'Sofi P.', 'Ana K.', 'Vero C.'] },
  { id: 'jue-09', dia: 'Jue', hora: '09:00', nombre: 'Hatha suave', cupo: 10, anotadas: ['Camila R.'] },
  { id: 'vie-18', dia: 'Vie', hora: '18:00', nombre: 'Restaurativo', cupo: 8, anotadas: ['Dani C.', 'Lau V.', 'Flor A.', 'Ana K.', 'Vero C.', 'Mili D.', 'Cande R.'] },
  { id: 'sab-10', dia: 'Sáb', hora: '10:00', nombre: 'Vinyasa flow', cupo: 14, anotadas: ['Paula G.', 'Julia M.', 'Eli T.'] },
]

const CLAVE = 'claude-demo:agenda-de-clases'

function leer(): Clase[] | null {
  try {
    const guardado = localStorage.getItem(CLAVE)
    return guardado ? (JSON.parse(guardado) as Clase[]) : null
  } catch {
    return null
  }
}

export default function AgendaDeClases() {
  const [clases, setClases] = useState<Clase[]>(() => leer() ?? CLASES_INICIALES)
  const [modo, setModo] = useState<'alumna' | 'instructora'>('alumna')
  const [nombre, setNombre] = useState('Valentina')

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(clases))
    } catch {
      // sin almacenamiento: la agenda dura mientras esté abierta
    }
  }, [clases])

  const yo = nombre.trim()
  const misReservas = clases.filter((c) => c.anotadas.includes(yo)).length
  const totalAnotadas = clases.reduce((suma, c) => suma + c.anotadas.length, 0)

  function alternarReserva(id: string) {
    if (!yo) return
    setClases((actuales) =>
      actuales.map((c) => {
        if (c.id !== id) return c
        if (c.anotadas.includes(yo)) return { ...c, anotadas: c.anotadas.filter((a) => a !== yo) }
        if (c.anotadas.length >= c.cupo) return c
        return { ...c, anotadas: [...c.anotadas, yo] }
      }),
    )
  }

  return (
    <section className="yoga" aria-label="Agenda de clases">
      <header className="yoga__head">
        <div>
          <h2>Agenda de clases</h2>
          <p className="yoga__sub">Yoga con Lucía · semana del lunes</p>
        </div>
        <div className="yoga__mode" role="group" aria-label="Quién sos">
          <button type="button" aria-pressed={modo === 'alumna'} onClick={() => setModo('alumna')}>Soy alumna</button>
          <button type="button" aria-pressed={modo === 'instructora'} onClick={() => setModo('instructora')}>Soy la instructora</button>
        </div>
      </header>

      {modo === 'alumna' && (
        <div className="yoga__me">
          <label htmlFor="yoga-nombre">Tu nombre</label>
          <input id="yoga-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Escribí tu nombre" />
          <span>{misReservas} {misReservas === 1 ? 'reserva' : 'reservas'}</span>
        </div>
      )}

      <ul className="yoga__list">
        {clases.map((c) => {
          const libres = c.cupo - c.anotadas.length
          const reservada = c.anotadas.includes(yo)
          return (
            <li key={c.id} className="yoga__class">
              <div className="yoga__when">
                <b>{c.dia}</b>
                <span>{c.hora}</span>
              </div>
              <div className="yoga__info">
                <b>{c.nombre}</b>
                <span>{c.anotadas.length} de {c.cupo} anotadas</span>
                {modo === 'instructora' && (
                  <div className="yoga__people">
                    {c.anotadas.length === 0 ? <em>Todavía no se anotó nadie</em> : c.anotadas.map((a) => <span key={a}>{a}</span>)}
                  </div>
                )}
              </div>
              <span className={`yoga__spots${libres === 0 ? ' yoga__spots--full' : libres <= 3 ? ' yoga__spots--low' : ''}`}>
                {libres === 0 ? 'Completa' : `${libres} ${libres === 1 ? 'lugar' : 'lugares'}`}
              </span>
              {modo === 'alumna' && (
                <button
                  type="button"
                  className={`yoga__book${reservada ? ' yoga__book--cancel' : ''}`}
                  disabled={!yo || (!reservada && libres === 0)}
                  onClick={() => alternarReserva(c.id)}
                >
                  {reservada ? 'Cancelar' : 'Reservar'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {modo === 'instructora' && <p className="yoga__total">{totalAnotadas} reservas en la semana.</p>}
    </section>
  )
}
