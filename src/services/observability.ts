import * as Sentry from '@sentry/react'

type ErrorContext = {
  source?: string
  componentStack?: string
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

let initialized = false

export function getReleaseTag(): string {
  const fromEnv = import.meta.env.VITE_APP_RELEASE || import.meta.env.VITE_GIT_SHA
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim()
  return `web-${import.meta.env.MODE}-${new Date().toISOString().slice(0, 10)}`
}

export function initObservability() {
  if (initialized) return
  initialized = true

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    console.info('[observability] Sentry DSN missing, remote error tracking disabled')
    return
  }

  const release = getReleaseTag()
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  })

  Sentry.setTag('runtime', 'web')
  Sentry.setTag('build_mode', import.meta.env.MODE)

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, {
      source: 'window.unhandledrejection',
      extra: { reasonType: typeof event.reason },
    })
  })

  window.addEventListener('error', (event) => {
    if (!event.error) return
    reportError(event.error, {
      source: 'window.error',
      extra: { filename: event.filename, line: event.lineno, column: event.colno },
    })
  })
}

export function reportError(error: unknown, context?: ErrorContext) {
  const payload = error instanceof Error ? error : new Error(String(error))
  const release = getReleaseTag()

  console.error('[observability] captured error', {
    message: payload.message,
    source: context?.source,
    release,
    stack: payload.stack,
  })

  try {
    Sentry.captureException(payload, {
      tags: {
        source: context?.source || 'unknown',
        release,
        ...(context?.tags || {}),
      },
      extra: {
        componentStack: context?.componentStack,
        ...(context?.extra || {}),
      },
    })
  } catch {
    // Keep the app resilient even if telemetry fails
  }
}
