import clsx from 'clsx'
import { ArrowUp, Plus, Square } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { ModelMenu } from './ModelMenu'
import { ToolsMenu } from './ToolsMenu'

interface ComposerProps {
  /** Texto con el que arranca (en el inicio viene escrito el prompt de la demo). */
  initial?: string
  placeholder?: string
  running?: boolean
  autoFocus?: boolean
  /** Al enfocar, deja el texto seleccionado: Enter lo envía y escribir encima lo reemplaza. */
  selectOnFocus?: boolean
  onSend: (text: string) => void
  onStop?: () => void
  className?: string
}

/** Cuadro de texto: Enter envía, Shift+Enter hace un salto de línea. */
export function Composer({ initial = '', placeholder = 'Escribile a Claude', running, autoFocus, selectOnFocus, onSend, onStop, className }: ComposerProps) {
  const [text, setText] = useState(initial)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [text])

  useEffect(() => {
    if (!autoFocus) return
    const el = area.current
    if (!el) return
    el.focus()
    if (selectOnFocus) el.select()
    else el.setSelectionRange(el.value.length, el.value.length)
  }, [autoFocus, selectOnFocus])

  function send() {
    const value = text.trim()
    if (!value || running) return
    onSend(value)
    setText('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={clsx('cd-composer', className)}>
      <textarea
        ref={area}
        rows={1}
        value={text}
        placeholder={placeholder}
        aria-label="Mensaje para Claude"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="cd-composer__bar">
        <button
          type="button"
          className="cd-iconbtn"
          aria-label="Adjuntar"
          onClick={() => toast('Adjuntar archivos no está disponible en esta demo.')}
        >
          <Plus className="cd-i" aria-hidden="true" />
        </button>
        <ToolsMenu />
        <span className="cd-composer__spacer" />
        <ModelMenu />
        {running ? (
          <button type="button" className="cd-send cd-send--stop" onClick={onStop} aria-label="Detener respuesta">
            <Square className="cd-i" style={{ width: 14, height: 14 }} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="cd-send" onClick={send} disabled={!text.trim()} aria-label="Enviar mensaje">
            <ArrowUp className="cd-i" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
