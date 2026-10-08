import { Check, Copy } from 'lucide-react'
import { useCopy } from '../../lib/clipboard'
import { Button, type ButtonVariant } from './Button'

interface CopyButtonProps {
  text: string
  label?: string
  copiedLabel?: string
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onCopied?: () => void
}

export function CopyButton({ text, label = 'Copiar', copiedLabel = '¡Copiado!', variant = 'outline', size, className, onCopied }: CopyButtonProps) {
  const { copied, copy } = useCopy()
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      icon={copied ? <Check className="cl-i" aria-hidden="true" /> : <Copy className="cl-i" aria-hidden="true" />}
      onClick={async () => {
        if (await copy(text)) onCopied?.()
      }}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </Button>
  )
}

/** Botón de solo ícono para copiar una frase. */
export function CopyIconButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy()
  return (
    <button type="button" className="cl-iconbtn" aria-label={copied ? 'Copiado' : label} onClick={() => copy(text)}>
      {copied ? <Check className="cl-i" aria-hidden="true" /> : <Copy className="cl-i" aria-hidden="true" />}
    </button>
  )
}
