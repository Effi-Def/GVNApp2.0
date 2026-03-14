import React from 'react'

// ─── Global ErrorBoundary ────────────────────────────────────────────────────
// Wraps the whole app. Shows full-screen reset UI on catastrophic failure.

type GlobalProps = { children: React.ReactNode }
type State = { hasError: boolean; error?: unknown }

export class ErrorBoundary extends React.Component<GlobalProps, State> {
  constructor(props: GlobalProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Global render error captured:', error, info)
  }

  private async resetAppCachesAndReload() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
    } catch {}
    try {
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map(n => caches.delete(n)))
      }
    } catch {}
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center space-y-4">
            <h2 className="text-xl font-semibold">Si è verificato un errore</h2>
            <p className="text-sm text-gray-600">Prova ad aggiornare la pagina. Se il problema persiste, reimposta la cache dell'app.</p>
            <div className="flex gap-2 justify-center">
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={() => window.location.reload()}>Ricarica</button>
              <button className="px-4 py-2 rounded-lg bg-neutral-100" onClick={() => this.resetAppCachesAndReload()}>Reimposta cache</button>
            </div>
            <details className="text-left text-xs text-gray-500 whitespace-pre-wrap break-words">
              <summary>Dettagli</summary>
              {String(this.state.error || '')}
              {'\n'}
              {(this.state.error as Error | undefined)?.stack || ''}
            </details>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── RouteErrorBoundary ──────────────────────────────────────────────────────
// Lightweight boundary for individual routes.
// A crash in one page does NOT take down the whole app.

type RouteProps = { children: React.ReactNode }
type RouteState = { hasError: boolean; error: Error | null }

export class RouteErrorBoundary extends React.Component<RouteProps, RouteState> {
  constructor(props: RouteProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): RouteState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('❌ RouteErrorBoundary:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="text-4xl mb-4">😵</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Qualcosa è andato storto</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            {this.state.error?.message || 'Errore imprevisto in questa sezione.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
          >
            Riprova
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
