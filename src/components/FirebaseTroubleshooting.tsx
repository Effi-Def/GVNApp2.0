import { useEffect, useState } from 'react'
import { auth, db } from '../firebase/config'
import { doc, setDoc, getDoc } from 'firebase/firestore'

const FirebaseTroubleshooting = () => {
  const [tests, setTests] = useState({
    auth: 'pending',
    firestore: 'pending',
    rules: 'pending'
  })

  useEffect(() => {
    runTests()
  }, [])

  const runTests = async () => {
    console.log('🧪 Running Firebase tests...')

    // Test 1: Auth configuration
    try {
      console.log('Testing auth configuration...')
      if (auth.app.options.apiKey && auth.app.options.projectId) {
        setTests(prev => ({ ...prev, auth: 'success' }))
        console.log('✅ Auth configuration OK')
      } else {
        setTests(prev => ({ ...prev, auth: 'error' }))
        console.log('❌ Auth configuration incomplete')
      }
    } catch (error) {
      console.error('❌ Auth test failed:', error)
      setTests(prev => ({ ...prev, auth: 'error' }))
    }

    // Test 2: Firestore connection
    try {
      console.log('Testing Firestore connection...')
      // Provo a leggere un documento che potrebbe non esistere (non è un errore)
      await getDoc(doc(db, 'test', 'connection'))
      setTests(prev => ({ ...prev, firestore: 'success' }))
      console.log('✅ Firestore connection OK')
    } catch (error: any) {
      // Se l'errore è permission-denied, Firestore funziona comunque
      if (error?.code === 'permission-denied') {
        setTests(prev => ({ ...prev, firestore: 'success' }))
        console.log('✅ Firestore connection OK (permission denied is expected for test collection)')
      } else {
        console.error('❌ Firestore test failed:', error)
        setTests(prev => ({ ...prev, firestore: 'error' }))
      }
    }

    // Test 3: Firestore rules (try to write)
    if (auth.currentUser) {
      try {
        console.log('Testing Firestore rules...')
        await setDoc(doc(db, 'users', auth.currentUser.uid), { 
          test: true, 
          timestamp: new Date() 
        }, { merge: true })
        setTests(prev => ({ ...prev, rules: 'success' }))
        console.log('✅ Firestore rules OK')
      } catch (error) {
        console.error('❌ Firestore rules test failed:', error)
        setTests(prev => ({ ...prev, rules: 'error' }))
      }
    }
  }

  if (!import.meta.env.DEV) return null

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg text-xs">
      <h3 className="font-bold mb-2">🔧 Firebase Debug</h3>
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <StatusIcon status={tests.auth} />
          <span>Auth Config</span>
        </div>
        <div className="flex items-center space-x-2">
          <StatusIcon status={tests.firestore} />
          <span>Firestore</span>
        </div>
        <div className="flex items-center space-x-2">
          <StatusIcon status={tests.rules} />
          <span>DB Rules</span>
        </div>
      </div>
      <button
        onClick={runTests}
        className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded"
      >
        Retest
      </button>
    </div>
  )
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success': return <span className="text-green-500">✅</span>
    case 'error': return <span className="text-red-500">❌</span>
    case 'pending': return <span className="text-yellow-500">⏳</span>
    default: return <span>❓</span>
  }
}

export default FirebaseTroubleshooting
