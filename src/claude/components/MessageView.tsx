import { Check, Copy, LayoutPanelLeft, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { copyText } from '../../lib/clipboard'
import { retry, sendMessage, useRuntime } from '../store/controller'
import type { ActionItem, Chat, Message, Part } from '../store/types'
import { useState } from 'react'
import { ClaudeMark } from './ClaudeMark'
import { Markdown } from './Markdown'
import { PermissionCard } from './PermissionCard'
import { ToolBlock } from './ToolBlock'

function ArtifactCard({ chat, artifactId }: { chat: Chat; artifactId: string }) {
  const artifact = chat.artifacts[artifactId]
  const panel = useRuntime((s) => s.panel)
  const openPanel = useRuntime((s) => s.openPanel)
  if (!artifact) return null
  const isOpen = panel?.chatId === chat.id && panel.artifactId === artifactId
  return (
    <button type="button" className="cd-artcard" onClick={() => openPanel(chat.id, artifactId)} aria-pressed={isOpen}>
      <span className="cd-artcard__icon"><LayoutPanelLeft className="cd-i" style={{ width: 22, height: 22 }} aria-hidden="true" /></span>
      <span className="cd-artcard__text">
        <b>{artifact.title}</b>
        <span>Artefacto interactivo · {isOpen ? 'abierto' : 'tocá para abrirlo'}</span>
      </span>
    </button>
  )
}

function ActionChips({ chatId, items, disabled }: { chatId: string; items: ActionItem[]; disabled: boolean }) {
  const navigate = useNavigate()
  function run(item: ActionItem) {
    if (item.kind === 'send') void sendMessage(chatId, item.text)
    else if (item.kind === 'open-connectors') navigate('/configuracion/conectores')
    else window.open(item.href, '_blank', 'noopener')
  }
  return (
    <div className="cd-actions">
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          className={`cd-action${i === 0 && item.kind !== 'send' ? ' cd-action--primary' : ''}${i === 0 && item.kind === 'send' && items.length === 1 ? ' cd-action--primary' : ''}`}
          disabled={disabled && item.kind === 'send'}
          onClick={() => run(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function renderPart(part: Part, chat: Chat, running: boolean, key: string) {
  switch (part.type) {
    case 'text':
      return <Markdown key={key} text={part.text} />
    case 'tool':
      return <ToolBlock key={part.id} part={part} />
    case 'permission':
      return <PermissionCard key={part.id} part={part} />
    case 'artifact':
      return <ArtifactCard key={key} chat={chat} artifactId={part.artifactId} />
    case 'actions':
      return <ActionChips key={key} chatId={chat.id} items={part.items} disabled={running} />
  }
}

function plainText(m: Message): string {
  return m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n\n')
}

/** Un mensaje del chat: la burbuja de la persona, o la respuesta de Claude con todas sus partes. */
export function MessageView({ chat, message, running }: { chat: Chat; message: Message; running: boolean }) {
  const [copied, setCopied] = useState(false)

  if (message.role === 'user') {
    return <div className="cd-msg--user">{message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')}</div>
  }

  const streaming = message.status === 'streaming'
  const label = message.thinking ?? (streaming && message.parts.length === 0 ? 'Pensando…' : null)

  return (
    <div className="cd-msg--bot">
      {message.parts.map((part, i) => renderPart(part, chat, running, `${message.id}-${i}`))}
      {label && (
        <span className="cd-thinking" role="status">
          <ClaudeMark />
          {label}
        </span>
      )}
      {message.status === 'stopped' && <span className="cd-stopped">Detuviste la respuesta.</span>}
      {!streaming && (
        <div className="cd-msgbar">
          <button
            type="button"
            className="cd-iconbtn"
            aria-label="Copiar respuesta"
            onClick={async () => {
              if (await copyText(plainText(message))) {
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }
            }}
          >
            {copied ? <Check className="cd-i" aria-hidden="true" /> : <Copy className="cd-i" aria-hidden="true" />}
          </button>
          <button type="button" className="cd-iconbtn" aria-label="Me gusta" onClick={() => toast('Gracias por avisar. En la demo no se guarda.')}>
            <ThumbsUp className="cd-i" aria-hidden="true" />
          </button>
          <button type="button" className="cd-iconbtn" aria-label="No me gusta" onClick={() => toast('Gracias por avisar. En la demo no se guarda.')}>
            <ThumbsDown className="cd-i" aria-hidden="true" />
          </button>
          <button type="button" className="cd-iconbtn" aria-label="Volver a generar" disabled={running} onClick={() => void retry(chat.id, message.id)}>
            <RotateCcw className="cd-i" aria-hidden="true" />
          </button>
          <span className="cd-msgbar__note">Claude puede cometer errores. Verificá las respuestas.</span>
        </div>
      )}
    </div>
  )
}
