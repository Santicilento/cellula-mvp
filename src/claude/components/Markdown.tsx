import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Respuesta de Claude: markdown con el mismo formato que en claude.ai (negritas, listas, tablas, código). */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="cd-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
          table: ({ children }) => (
            <div className="cd-table"><table>{children}</table></div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
