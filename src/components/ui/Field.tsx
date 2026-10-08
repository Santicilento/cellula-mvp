import clsx from 'clsx'
import { CircleAlert } from 'lucide-react'
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  optional?: string
  help?: ReactNode
  error?: string | null
  wrapperClassName?: string
}

/** Campo de formulario con etiqueta, ayuda y error. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, optional, help, error, wrapperClassName, className, id, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  const helpId = `${inputId}-help`
  const errorId = `${inputId}-error`
  return (
    <div className={clsx('cl-field', wrapperClassName)}>
      <label className="cl-field__label" htmlFor={inputId}>
        {label} {optional && <span>{optional}</span>}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={clsx('cl-input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : help ? helpId : undefined}
        {...rest}
      />
      {error ? (
        <span id={errorId} role="alert" className="cl-field__error">
          <CircleAlert className="cl-i" aria-hidden="true" />
          {error}
        </span>
      ) : help ? (
        <span id={helpId} className="cl-field__help">{help}</span>
      ) : null}
    </div>
  )
})
