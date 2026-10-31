/**
 * Spinner — Atomic loading indicator
 *
 * Sizes: sm | md | lg | xl
 * Color adapts to dark mode via currentColor.
 */

import React from 'react'

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
  label?: string  // Screen-reader accessible label
}

const sizeMap: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
  xl: 'h-16 w-16 border-4',
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
  label = 'Caricamento...',
}) => (
  <span role="status" aria-label={label} className={`inline-flex items-center justify-center ${className}`}>
    <span
      className={[
        'animate-spin rounded-full',
        'border-[--border-strong] border-t-primary-500',
        sizeMap[size],
      ].join(' ')}
    />
    <span className="sr-only">{label}</span>
  </span>
)

Spinner.displayName = 'Spinner'

/**
 * FullPageSpinner — covers the full viewport with a centered spinner.
 * Used in Suspense fallbacks and initial loading states.
 */
export const FullPageSpinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-center justify-center min-h-screen bg-[--bg-page]">
    <Spinner size="xl" label={label} />
  </div>
)

export default Spinner
