/**
 * Button — Atomic UI component
 *
 * Variants: primary | secondary | ghost | danger
 * Sizes:    sm | md | lg
 * Extras:   loading state, left/right icon slots, full-width
 */

import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'text-white font-semibold',
    'bg-gradient-to-br from-primary-500 to-primary-600',
    'shadow-[0_4px_14px_0_rgb(16_185_129/0.30)]',
    'hover:brightness-110 hover:shadow-[0_6px_20px_0_rgb(16_185_129/0.40)]',
    'focus-visible:ring-primary-500',
    'dark:from-primary-600 dark:to-primary-700',
  ].join(' '),

  secondary: [
    'font-medium border',
    'bg-[--bg-subtle] text-[--text-base] border-[--border-base]',
    'hover:bg-[--bg-raised] hover:border-[--border-strong]',
    'focus-visible:ring-primary-500',
  ].join(' '),

  ghost: [
    'font-medium',
    'bg-transparent text-[--text-base]',
    'hover:bg-[--bg-raised] dark:hover:bg-neutral-800',
    'focus-visible:ring-primary-500',
  ].join(' '),

  danger: [
    'font-semibold text-white',
    'bg-red-500 hover:bg-red-600',
    'shadow-[0_4px_14px_0_rgb(239_68_68/0.25)] hover:shadow-[0_6px_20px_0_rgb(239_68_68/0.35)]',
    'focus-visible:ring-red-500',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
}

const Spinner = ({ className }: { className?: string }) => (
  <svg
    className={`animate-spin ${className ?? 'h-4 w-4'}`}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
)

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'active:scale-95',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {loading ? (
          <Spinner className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  },
)

Button.displayName = 'Button'
export default Button

