/**
 * Card — Atomic UI component
 *
 * Variants: default | flat | outlined
 * Extras:   hoverable, padding control
 */

import React from 'react'

export type CardVariant = 'default' | 'flat' | 'outlined'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  hoverable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const variantClasses: Record<CardVariant, string> = {
  default:  'bg-[--bg-card] border border-[--border-base] shadow-card',
  flat:     'bg-[--bg-subtle] border border-transparent',
  outlined: 'bg-transparent border border-[--border-strong]',
}

const paddingClasses: Record<string, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hoverable = false,
      padding = 'md',
      className = '',
      children,
      ...rest
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={[
        'rounded-2xl transition-all duration-200',
        variantClasses[variant],
        paddingClasses[padding],
        hoverable
          ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.99]'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'

// Sub-components

export const CardHeader = ({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-start justify-between gap-3 mb-3 ${className}`} {...rest}>
    {children}
  </div>
)
CardHeader.displayName = 'Card.Header'

export const CardTitle = ({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-base font-semibold text-[--text-base] leading-snug ${className}`} {...rest}>
    {children}
  </h3>
)
CardTitle.displayName = 'Card.Title'

export const CardFooter = ({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center gap-2 mt-4 pt-3 border-t border-[--border-base] ${className}`} {...rest}>
    {children}
  </div>
)
CardFooter.displayName = 'Card.Footer'

export default Card
