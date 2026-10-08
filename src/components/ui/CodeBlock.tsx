import { CopyButton } from './CopyButton'

/** Comando para copiar, en bloque oscuro. */
export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="cl-code">
      <code>{code}</code>
      <CopyButton text={code} label="Copiar" />
    </div>
  )
}
