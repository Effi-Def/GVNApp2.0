/**
 * Input — Atomic UI component
 *
 * Wraps a native <input> with label, helper text, error state, and leading/trailing icons.
 * Fully dark-mode aware via CSS variables from index.css.
 */

import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  wrapperClassName?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      leadingIcon,
      trailingIcon,
      id,
      className = '',
      wrapperClassName = '',
      ...rest
    },
    ref,
  ) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const hasError = !!error

    return (
      <div className={`flex flex-col gap-1 ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[--text-base]"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leadingIcon && (
            <span className="absolute left-3 text-[--text-muted] pointer-events-none">
              {leadingIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full rounded-xl border-2 px-4 py-2.5 text-sm font-medium',
              'bg-[--bg-card] text-[--text-base] placeholder:text-[--text-muted]',
              'transition-all duration-200',
              'focus:outline-none focus:ring-4',
              hasError
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                : 'border-[--border-base] focus:border-primary-500 focus:ring-primary-500/10',
              leadingIcon ? 'pl-10' : '',
              trailingIcon ? 'pr-10' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...rest}
          />

          {trailingIcon && (
            <span className="absolute right-3 text-[--text-muted] pointer-events-none">
              {trailingIcon}
            </span>
          )}
        </div>

        {hint && !hasError && (
          <p id={`${inputId}-hint`} className="text-xs text-[--text-muted]">
            {hint}
          </p>
        )}
        {hasError && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-red-500 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
export default Input
