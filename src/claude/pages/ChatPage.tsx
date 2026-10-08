import { Navigate, useParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { ArtifactPanel } from '../components/ArtifactPanel'
import { Composer } from '../components/Composer'
import { MessageView } from '../components/MessageView'
import { sendMessage, stopChat, useRuntime } from '../store/controller'
import { useClaude } from '../store/store'

/** Una conversación: los mensajes, el panel del artefacto (si hay uno abierto) y el cuadro de texto. */
export default function ChatPage() {
  const { id = '' } = useParams()
  const chat = useClaude((s) => s.chats.find((c) => c.id === id))
  const running = useRuntime((s) => s.running[id] === true)
  const panel = useRuntime((s) => s.panel)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const artifact = panel && panel.chatId === id ? chat?.artifacts[panel.artifactId] : undefined

  // Mientras Claude escribe, el chat sigue la última línea (salvo que la persona haya subido a leer).
  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  })

  if (!chat) return <Navigate to="/" replace />

  return (
    <div className={clsx('cd-chat', artifact && 'cd-chat--panel')}>
      <div className="cd-chat__main">
        <div className="cd-topbar">
          <h1>{chat.title}</h1>
        </div>
        <div
          className="cd-scroll"
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140
          }}
        >
          <div className="cd-thread" role="log" aria-live="polite" aria-label="Conversación">
            {chat.messages.map((m) => (
              <MessageView key={m.id} chat={chat} message={m} running={running} />
            ))}
          </div>
        </div>
        <div className="cd-dock">
          <div className="cd-dock__inner">
            <Composer
              key={chat.id}
              autoFocus
              running={running}
              placeholder="Respondele a Claude"
              onSend={(text) => {
                stick.current = true
                void sendMessage(chat.id, text)
              }}
              onStop={() => stopChat(chat.id)}
            />
            <p className="cd-disclaimer">Claude puede cometer errores. Verificá las respuestas. · Demo: las respuestas son guionadas.</p>
          </div>
        </div>
      </div>
      {artifact && <ArtifactPanel artifact={artifact} />}
    </div>
  )
}
