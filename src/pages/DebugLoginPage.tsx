import { useState, useEffect } from 'react'
import { auth, db } from '../firebase/config'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export default function DebugLoginPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [authState, setAuthState] = useState<any>(null)
  const [firestoreAccess, setFirestoreAccess] = useState<string>('not tested')
  const [loading, setLoading] = useState(false)

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12)
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    setLogs(prev => [...prev, `[${timestamp}] ${prefix} ${msg}`])
    console.log(`[DEBUG] ${msg}`)
  }

  useEffect(() => {
    addLog('Initializing debug page')
    addLog(`Firebase Project: ${auth.app.options.projectId}`)
    addLog(`Auth Domain: ${auth.app.options.authDomain}`)
    addLog(`Current URL: ${window.location.href}`)
    
    // Check redirect result first
    getRedirectResult(auth).then(result => {
      if (result) {
        addLog(`Redirect result found: ${result.user.email}`, 'success')
      } else {
        addLog('No pending redirect result')
      }
    }).catch(err => {
      addLog(`Redirect result error: ${err.code} - ${err.message}`, 'error')
    })

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        addLog(`Auth state changed: User logged in - ${user.email}`, 'success')
        setAuthState({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        })
        
        // Test Firestore access
        try {
          addLog('Testing Firestore read access...')
          const userRef = doc(db, 'users', user.uid)
          const userSnap = await getDoc(userRef)
          
          if (userSnap.exists()) {
            addLog('Firestore READ: Success - user document exists', 'success')
            addLog(`User data: ${JSON.stringify(userSnap.data())}`)
          } else {
            addLog('Firestore READ: Success - user document does not exist (will create)')
            
            // Try to create user document
            try {
              addLog('Testing Firestore write access...')
              await setDoc(userRef, {
                id: user.uid,
                email: user.email,
                displayName: user.displayName || user.email?.split('@')[0] || 'User',
                photoURL: user.photoURL || null,
                createdAt: new Date()
              })
              addLog('Firestore WRITE: Success - user document created', 'success')
              setFirestoreAccess('✅ Read & Write OK')
            } catch (writeErr: any) {
              addLog(`Firestore WRITE Error: ${writeErr.code} - ${writeErr.message}`, 'error')
              setFirestoreAccess(`❌ Write failed: ${writeErr.code}`)
            }
          }
        } catch (readErr: any) {
          addLog(`Firestore READ Error: ${readErr.code} - ${readErr.message}`, 'error')
          setFirestoreAccess(`❌ Read failed: ${readErr.code}`)
        }
      } else {
        addLog('Auth state changed: User logged out')
        setAuthState(null)
        setFirestoreAccess('not tested')
      }
    })

    return () => unsubscribe()
  }, [])

  const testPopupLogin = async () => {
    setLoading(true)
    addLog('Starting POPUP login test...')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    
    try {
      addLog('Opening popup...')
      const result = await signInWithPopup(auth, provider)
      addLog(`Popup login SUCCESS: ${result.user.email}`, 'success')
    } catch (error: any) {
      addLog(`Popup login ERROR: ${error.code} - ${error.message}`, 'error')
      if (error.code === 'auth/popup-blocked') {
        addLog('Browser blocked the popup. Try redirect flow instead.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const testRedirectLogin = async () => {
    setLoading(true)
    addLog('Starting REDIRECT login test...')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    
    try {
      addLog('Redirecting to Google login...')
      await signInWithRedirect(auth, provider)
      // This will redirect away from the page
    } catch (error: any) {
      addLog(`Redirect login ERROR: ${error.code} - ${error.message}`, 'error')
      setLoading(false)
    }
  }

  const testFirestoreRules = async () => {
    addLog('Testing Firestore rules...')
    try {
      // Test read without auth
      const testRef = doc(db, 'users', 'test-user-id')
      await getDoc(testRef)
      addLog('Firestore rules: Can read without auth (unexpected)', 'error')
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        addLog('Firestore rules: Read requires auth (correct)', 'success')
      } else {
        addLog(`Firestore rules test error: ${err.message}`, 'error')
      }
    }
  }

  const clearLogs = () => setLogs([])

  const logout = async () => {
    addLog('Logging out...')
    try {
      await auth.signOut()
      addLog('Logout successful', 'success')
    } catch (err: any) {
      addLog(`Logout error: ${err.message}`, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">🔧 Debug Login Page</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2">Auth State</h3>
              {authState ? (
                <div className="text-sm space-y-1">
                  <div><strong>UID:</strong> {authState.uid}</div>
                  <div><strong>Email:</strong> {authState.email}</div>
                  <div><strong>Name:</strong> {authState.displayName || 'null'}</div>
                  <button onClick={logout} className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-xs">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="text-gray-500">Not logged in</div>
              )}
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold mb-2">Firestore Access</h3>
              <div className="text-sm">{firestoreAccess}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={testPopupLogin}
              disabled={loading || !!authState}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Test Popup Login
            </button>
            <button
              onClick={testRedirectLogin}
              disabled={loading || !!authState}
              className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
            >
              Test Redirect Login
            </button>
            <button
              onClick={testFirestoreRules}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Test Firestore Rules
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-600 text-white rounded"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs h-96 overflow-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              logs.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <h3 className="font-semibold mb-2">📋 Checklist</h3>
          <ul className="text-sm space-y-1">
            <li>✅ Firebase credentials configured in .env.local</li>
            <li>✅ Firestore rules deployed</li>
            <li>❓ Check if domain is authorized in Firebase Console</li>
            <li>❓ Check browser console (F12) for additional errors</li>
          </ul>
          <a 
            href="https://console.firebase.google.com/project/gvnapp-e3e7d/authentication/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline text-sm mt-2 inline-block"
          >
            → Open Firebase Auth Settings
          </a>
        </div>
      </div>
    </div>
  )
}
