import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getDatabase, type Database } from 'firebase/database'

// Validate required environment variables at startup
const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const missingVars = REQUIRED_ENV_VARS.filter(k => !import.meta.env[k])
if (missingVars.length > 0) {
  throw new Error(
    `⚠️ Firebase: variabili d'ambiente mancanti: ${missingVars.join(', ')}\n` +
    `Controlla il file .env e riavvia il server di sviluppo.`
  )
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Optional — needed only for Realtime Database (presence).
  // Set VITE_FIREBASE_DATABASE_URL in .env.local to enable.
  ...(import.meta.env.VITE_FIREBASE_DATABASE_URL
    ? { databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL }
    : {}),
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Realtime Database — only initialized when a databaseURL is configured.
// Presence features degrade gracefully when rtdb is null.
export const rtdb: Database | null = import.meta.env.VITE_FIREBASE_DATABASE_URL
  ? getDatabase(app)
  : null

export default app
