import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { toast } from 'sonner'
import { AddConnectorDialog } from '../components/AddConnectorDialog'
import { ConnectorCard } from '../components/ConnectorCard'
import { verifyConnectors } from '../store/controller'
import { useClaude } from '../store/store'

const DIRECTORY = [
  { name: 'Google Drive', note: 'Buscá y leé tus archivos' },
  { name: 'Gmail', note: 'Leé y redactá correos' },
  { name: 'Google Calendar', note: 'Mirá y creá eventos' },
  { name: 'Slack', note: 'Buscá y enviá mensajes' },
  { name: 'GitHub', note: 'Trabajá con tus repositorios' },
  { name: 'Notion', note: 'Consultá tus páginas' },
]

const SECTIONS = ['Perfil', 'Apariencia', 'Capacidades', 'Conectores', 'Cuenta']

/** Configuración → Conectores. */
export default function SettingsConnectors() {
  const connectors = useClaude((s) => s.connectors)
  const [adding, setAdding] = useState(false)

  // Al entrar, se vuelve a comprobar que cada conector siga autorizado (por si lo desconectaron desde Cellula).
  useEffect(() => {
    void verifyConnectors()
  }, [])

  return (
    <div className="cd-settings">
      <nav className="cd-settings__nav" aria-label="Secciones de configuración">
        <h2>Configuración</h2>
        {SECTIONS.map((s) =>
          s === 'Conectores' ? (
            <NavLink key={s} to="/configuracion/conectores" className="cd-settings__link cd-settings__link--on">{s}</NavLink>
          ) : (
            <button
              key={s}
              type="button"
              className="cd-settings__link"
              style={{ border: 0, background: 'transparent', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}
              onClick={() => toast(`«${s}» no está disponible en esta demo.`)}
            >
              {s}
            </button>
          ),
        )}
      </nav>

      <div className="cd-settings__main">
        <div className="cd-settings__col">
          <div className="cd-settings__head">
            <div>
              <h1>Conectores</h1>
              <p className="cd-settings__lead">
                Dejá que Claude use tus herramientas. Con un conector puede publicar apps, compartirlas o consultar información sin que salgas del chat.
              </p>
            </div>
            <button type="button" className="cd-btn cd-btn--primary" onClick={() => setAdding(true)}>
              <Plus className="cd-i" aria-hidden="true" />
              Agregar conector personalizado
            </button>
          </div>

          <section className="cd-section" aria-label="Conectores personalizados">
            <div className="cd-section__head"><h3>Tus conectores</h3></div>
            {connectors.length === 0 ? (
              <div className="cd-empty">
                Todavía no agregaste ningún conector.
                <br />
                Tocá <b>Agregar conector personalizado</b> y pegá la dirección del servidor MCP.
              </div>
            ) : (
              connectors.map((c) => <ConnectorCard key={c.id} connector={c} />)
            )}
          </section>

          <section className="cd-section" aria-label="Directorio de conectores">
            <div className="cd-section__head"><h3>Directorio</h3></div>
            <div className="cd-dir">
              {DIRECTORY.map((d) => (
                <div key={d.name} className="cd-dir__item">
                  <span className="cd-conn__logo" aria-hidden="true">{d.name.charAt(0)}</span>
                  <div>
                    <b>{d.name}</b>
                    <span>{d.note}</span>
                  </div>
                  <button type="button" className="cd-btn cd-btn--sm" onClick={() => toast(`${d.name} no está disponible en esta demo.`)}>Conectar</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <AddConnectorDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
