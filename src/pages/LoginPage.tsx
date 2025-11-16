import { useState, useEffect } from 'react'
import { useAuth } from '../hooks'
import { auth } from '../firebase/config'
import { getAuth } from 'firebase/auth'

const LoginPage = () => {
  const { signInWithGoogle } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('🔄 Starting login process...')
      await signInWithGoogle()
      console.log('✅ Login completed')
      // Navigation will be handled automatically by App.tsx when user state updates
    } catch (error) {
      console.error('❌ Errore durante il login:', error)
      setError(error instanceof Error ? error.message : 'Errore durante il login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">GVNApp</h1>
          <p className="text-gray-600">Il tuo hub sociale per eventi e spese di gruppo</p>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Accedi per continuare
            </h2>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isLoading ? 'Accesso in corso...' : 'Continua con Google'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Accedendo accetti i nostri{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500">
                Termini di Servizio
              </a>{' '}
              e la{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="text-center">
              <div className="text-2xl mb-1">📅</div>
              <div>Eventi</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">💰</div>
              <div>Spese</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">📊</div>
              <div>Sondaggi</div>
            </div>
          </div>
        </div>

        {/* Debug toggle */}
        <LoginDebugPanel />
      </div>
    </div>
  )
}

export default LoginPage

// Collapsible debug panel to troubleshoot mobile login issues
const LoginDebugPanel = () => {
  const [open, setOpen] = useState(false)
  const [swInfo, setSwInfo] = useState<{ active: boolean; scriptURL?: string }|null>(null)
  const [envInfo, setEnvInfo] = useState<any>({})
  const [redirectSupported, setRedirectSupported] = useState<boolean | null>(null)

  useEffect(() => {
    // Gather service worker info
    if ('serviceWorker' in navigator) {
      try {
        const reg = navigator.serviceWorker.controller
        if (reg) setSwInfo({ active: true, scriptURL: (reg as any).scriptURL })
        else setSwInfo({ active: false })
      } catch { setSwInfo({ active: false }) }
    }
    // Environment variable sanity (placeholder detection)
    const placeholders = {
      apiKeyPlaceholder: /your_actual_api_key_here/i.test(import.meta.env.VITE_FIREBASE_API_KEY || ''),
      senderIdPlaceholder: /(123456789|your)/i.test(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
      appIdPlaceholder: /(abcdef123456|123456789:web)/i.test(import.meta.env.VITE_FIREBASE_APP_ID || ''),
      vapidPlaceholder: /your_vapid_key_here/i.test(import.meta.env.VITE_FIREBASE_VAPID_KEY || ''),
    }
    setEnvInfo({
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY ? 'present' : 'missing',
      ...placeholders,
    })
    // Simple redirect support heuristic
    setRedirectSupported(typeof window !== 'undefined')
  }, [])

  const resetCaches = async () => {
    try {
      // Unregister SW
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
    try { localStorage.clear(); sessionStorage.clear() } catch {}
    window.location.reload()
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-gray-500 hover:text-gray-700 underline"
      >{open ? 'Nascondi diagnostica login' : 'Mostra diagnostica login'}</button>
      {open && (
        <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-[11px] leading-relaxed font-mono space-y-1 max-h-64 overflow-auto">
          <div><strong>UserAgent:</strong> {navigator.userAgent}</div>
          <div><strong>Location:</strong> {location.origin}</div>
          <div><strong>SW:</strong> {swInfo ? (swInfo.active ? `attivo (${swInfo.scriptURL?.split('/').pop()})` : 'non attivo') : 'n/d'}</div>
          <div><strong>DisplayMode standalone:</strong> {window.matchMedia?.('(display-mode: standalone)')?.matches ? 'si' : 'no'}</div>
          <div><strong>auth.currentUser:</strong> {(() => { try { return getAuth().currentUser?.email || 'null' } catch { return auth.currentUser ? auth.currentUser.email : 'null' } })()}</div>
          <div><strong>Env projectId:</strong> {envInfo.projectId}</div>
          <div><strong>Placeholder apiKey:</strong> {envInfo.apiKeyPlaceholder ? '⚠️' : 'ok'}</div>
          <div><strong>Placeholder senderId:</strong> {envInfo.senderIdPlaceholder ? '⚠️' : 'ok'}</div>
          <div><strong>Placeholder appId:</strong> {envInfo.appIdPlaceholder ? '⚠️' : 'ok'}</div>
          <div><strong>VAPID key:</strong> {envInfo.vapidKey}</div>
          <div><strong>Redirect heuristic supported:</strong> {redirectSupported ? 'yes' : 'no'}</div>
          <div className="pt-2 flex gap-2">
            <button onClick={resetCaches} className="px-2 py-1 rounded bg-red-600 text-white">Reset cache</button>
            <button onClick={()=>{ try { sessionStorage.removeItem('postLoginRedirect'); alert('Redirect pulito') } catch {} }} className="px-2 py-1 rounded bg-gray-200">Clear redirect</button>
          </div>
          <div className="text-gray-500 pt-1">Se vedi ⚠️ sostituisci i valori placeholder in .env.local con quelli reali dalla Firebase Console.</div>
        </div>
      )}
    </div>
  )
}
