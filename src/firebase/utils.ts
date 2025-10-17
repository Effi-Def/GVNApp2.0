import { auth, db, storage } from './config'

/**
 * Verifica che Firebase sia configurato correttamente
 */
export const checkFirebaseConfig = () => {
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ]

  const missingVars = requiredEnvVars.filter(varName => {
    const value = import.meta.env[varName]
    return !value || 
           value === 'your_actual_api_key_here' ||
           value === 'your-project-id' ||
           value === '123456789' ||
           value === '1:123456789:web:abcdef123456'
  })

  if (missingVars.length > 0) {
    console.error('❌ Firebase configuration incomplete!')
    console.error('Missing or placeholder values for:', missingVars)
    console.error('Please check your .env.local file')
    return false
  }

  try {
    // Test basic Firebase services initialization
    console.log('🔥 Firebase App initialized:', !!auth.app)
    console.log('🔐 Auth service ready:', !!auth)
    console.log('🗄️ Firestore ready:', !!db)
    console.log('📁 Storage ready:', !!storage)
    console.log('✅ Firebase configuration looks good!')
    return true
  } catch (error) {
    console.error('❌ Firebase initialization error:', error)
    return false
  }
}

/**
 * Mostra informazioni di debug sulla configurazione Firebase
 */
export const debugFirebaseConfig = () => {
  if (import.meta.env.DEV) {
    console.log('🔧 Firebase Debug Info:')
    console.log('Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID)
    console.log('Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
    console.log('Environment:', import.meta.env.MODE)
  }
}
