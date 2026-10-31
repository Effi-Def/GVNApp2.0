/**
 * Badge — Atomic UI component
 *
 * Variants: default | primary | success | warning | danger | info | muted
 * Sizes:    sm | md
 * Extras:   dot indicator, removable (with onRemove callback)
 */

import React from 'react'

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'

export type BadgeSize = 'sm' | 'md'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  onRemove?: () => void
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[--bg-raised] text-[--text-muted] dark:bg-neutral-800 dark:text-neutral-300',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  success: 'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  danger:  'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300',
  info:    'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  muted:   'bg-[--bg-raised] text-[--text-muted] dark:bg-neutral-800 dark:text-[--text-muted]',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-neutral-400',
  primary: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  muted:   'bg-neutral-400',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] rounded-md gap-1',
  md: 'px-2.5 py-1 text-xs rounded-lg gap-1.5',
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot = false,
  onRemove,
  className = '',
  children,
  ...rest
}) => {
  return (
    <span
      className={[
        'inline-flex items-center font-medium border border-transparent',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {dot && (
        <span
          className={`inline-block shrink-0 rounded-full ${dotColors[variant]} ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
          aria-hidden
        />
      )}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors p-0.5 -mr-0.5"
          aria-label="Rimuovi"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  )
}

Badge.displayName = 'Badge'
export default Badge

