import clsx from 'clsx'
import { PanelLeftClose, Plug, Plus, Trash2 } from 'lucide-react'
import { Link, NavLink, useMatch, useNavigate } from 'react-router-dom'
import { useSidebar } from '../store/sidebar'
import { useClaude } from '../store/store'
import { ClaudeMark } from './ClaudeMark'
import { DemoMenu } from './DemoMenu'

/** Barra lateral: nuevo chat, conectores, chats recientes y la persona al pie. */
export function Sidebar() {
  const chats = useClaude((s) => s.chats)
  const deleteChat = useClaude((s) => s.deleteChat)
  const { setOpen, closeDrawer } = useSidebar()
  const navigate = useNavigate()
  const current = useMatch('/chat/:id')?.params.id

  const closeOnMobile = closeDrawer
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <aside className="cd-sidebar" aria-label="Barra lateral">
      <div className="cd-sidebar__top">
        <button type="button" className="cd-iconbtn" aria-label="Cerrar barra lateral" onClick={() => setOpen(false)}>
          <PanelLeftClose className="cd-i" aria-hidden="true" />
        </button>
        <Link to="/" className="cd-brand" onClick={closeOnMobile}>
          <ClaudeMark />
          Claude
        </Link>
        <DemoMenu />
      </div>

      <Link to="/" className="cd-new" onClick={closeOnMobile}>
        <span className="cd-new__plus"><Plus className="cd-i" aria-hidden="true" /></span>
        Nuevo chat
      </Link>
      <NavLink to="/configuracion/conectores" className="cd-new" onClick={closeOnMobile}>
        <Plug className="cd-i" aria-hidden="true" style={{ margin: '0 3px' }} />
        Conectores
      </NavLink>

      <div className="cd-nav-label">Recientes</div>
      <ul className="cd-chatlist">
        {sorted.length === 0 && <li className="cd-chatlist__empty">Todavía no hay chats.</li>}
        {sorted.map((c) => (
          <li key={c.id}>
            <NavLink to={`/chat/${c.id}`} className={clsx('cd-chatlink', current === c.id && 'cd-chatlink--on')} onClick={closeOnMobile}>
              {c.title}
            </NavLink>
            <button
              type="button"
              className="cd-iconbtn cd-chatlist__del"
              aria-label={`Eliminar el chat ${c.title}`}
              onClick={() => {
                deleteChat(c.id)
                if (current === c.id) navigate('/')
              }}
            >
              <Trash2 className="cd-i" style={{ width: 15, height: 15 }} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="cd-user">
        <span className="cd-avatar" aria-hidden="true">LB</span>
        <span className="cd-user__text">
          <b>Lucía Benítez</b>
          <span>Plan Pro</span>
        </span>
      </div>
    </aside>
  )
}
