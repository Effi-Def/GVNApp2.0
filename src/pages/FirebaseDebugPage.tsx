import { useState, useEffect } from 'react'
import { auth, db } from '../firebase/config'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { collection, addDoc, getDocs } from 'firebase/firestore'
import { useAuthStore } from '../stores/useAuthStore'

const FirebaseDebugPage = () => {
  const { user, loading } = useAuthStore()
  const [testResults, setTestResults] = useState<string[]>([])
  const [testing, setTesting] = useState(false)

  const getUserDisplayName = () => {
    if (!user) return 'Non autenticato'
    return user.displayName || user.email || 'Utente senza nome'
  }

  const addLog = (message: string) => {
    console.log(message)
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testFirebaseConnection = async () => {
    setTesting(true)
    setTestResults([])
    
    try {
      addLog('🔄 Iniziando test connessione Firebase...')
      
      // Test 1: Configurazione Firebase
      addLog('✅ Firebase config caricato')
      addLog(`📁 Project ID: ${import.meta.env.VITE_FIREBASE_PROJECT_ID}`)
      addLog(`🔑 API Key: ${import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 10)}...`)
      
      // Test 2: Auth
      addLog('🔄 Testing Firebase Auth...')
      if (auth) {
        addLog('✅ Firebase Auth inizializzato')
        addLog(`👤 Utente corrente: ${getUserDisplayName()}`)
      } else {
        addLog('❌ Firebase Auth non inizializzato')
      }
      
      // Test 3: Firestore
      addLog('🔄 Testing Firestore...')
      if (db) {
        addLog('✅ Firestore inizializzato')
        
        // Test lettura collezione
        const testCollection = collection(db, 'test')
        const docs = await getDocs(testCollection)
        addLog(`📄 Collezione test: ${docs.size} documenti`)
        
        // Test scrittura (solo se autenticato)
        if (user) {
          const testDoc = {
            message: 'Test connection',
            timestamp: new Date(),
            user: user.id
          }
          await addDoc(testCollection, testDoc)
          addLog('✅ Test scrittura Firestore riuscito')
        } else {
          addLog('⚠️ Skipping test scrittura: utente non autenticato')
        }
        
      } else {
        addLog('❌ Firestore non inizializzato')
      }
      
      addLog('🎉 Test completato!')
      
    } catch (error: any) {
      addLog(`❌ Errore durante test: ${error.message}`)
      console.error('Firebase test error:', error)
    } finally {
      setTesting(false)
    }
  }

  const testGoogleLogin = async () => {
    try {
      addLog('🔄 Tentativo login Google...')
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      addLog(`✅ Login riuscito: ${result.user.displayName}`)
    } catch (error: any) {
      addLog(`❌ Errore login: ${error.message}`)
    }
  }

  useEffect(() => {
    addLog('🚀 Debug page caricata')
    addLog(`⏳ Auth loading: ${loading}`)
    addLog(`👤 User: ${user ? 'Autenticato' : 'Non autenticato'}`)
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🔧 Firebase Debug</h1>
        <p className="text-gray-600">Diagnostica problemi di connessione Firebase</p>
      </div>

      {/* Status corrente */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">📊 Status Corrente</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl mb-2">🔥</div>
            <p className="text-sm font-medium">Firebase Config</p>
            <p className="text-xs text-gray-600">
              {import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅ Configurato' : '❌ Mancante'}
            </p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl mb-2">🔐</div>
            <p className="text-sm font-medium">Autenticazione</p>
            <p className="text-xs text-gray-600">
              {user ? `✅ ${getUserDisplayName()}` : loading ? '⏳ Caricando...' : '❌ Non autenticato'}
            </p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl mb-2">💾</div>
            <p className="text-sm font-medium">Database</p>
            <p className="text-xs text-gray-600">
              {db ? '✅ Connesso' : '❌ Disconnesso'}
            </p>
          </div>
        </div>
      </div>

      {/* Controlli */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">🎮 Controlli</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={testFirebaseConnection}
            disabled={testing}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {testing ? '⏳ Testing...' : '🧪 Test Connessione'}
          </button>
          
          {!user && (
            <button
              onClick={testGoogleLogin}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              🔑 Login Google
            </button>
          )}
          
          <button
            onClick={() => setTestResults([])}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            🗑️ Clear Log
          </button>
        </div>
      </div>

      {/* Log risultati */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">📋 Log Test</h2>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-500">Nessun test eseguito. Clicca "Test Connessione" per iniziare.</p>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Variabili ambiente */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-xl font-bold mb-4">🔧 Variabili Ambiente</h2>
        <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
          <div><strong>VITE_FIREBASE_PROJECT_ID:</strong> {import.meta.env.VITE_FIREBASE_PROJECT_ID || 'NON DEFINITA'}</div>
          <div><strong>VITE_FIREBASE_API_KEY:</strong> {import.meta.env.VITE_FIREBASE_API_KEY ? `${import.meta.env.VITE_FIREBASE_API_KEY.substring(0, 10)}...` : 'NON DEFINITA'}</div>
          <div><strong>VITE_FIREBASE_AUTH_DOMAIN:</strong> {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'NON DEFINITA'}</div>
        </div>
      </div>
    </div>
  )
}

export default FirebaseDebugPage