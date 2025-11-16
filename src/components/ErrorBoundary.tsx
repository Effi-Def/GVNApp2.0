import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error?: any }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
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
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={()=>window.location.reload()}>Ricarica</button>
              <button className="px-4 py-2 rounded-lg bg-neutral-100" onClick={()=>this.resetAppCachesAndReload()}>Reimposta cache</button>
            </div>
            <details className="text-left text-xs text-gray-500 whitespace-pre-wrap break-words">
              <summary>Dettagli</summary>
              {String(this.state.error || '')}
              {'\n'}
              {this.state.error?.stack || ''}
            </details>
          </div>
        </div>
      )
    }
    return this.props.children as any
  }
}

export default ErrorBoundary
