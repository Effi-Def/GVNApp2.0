import { create } from 'zustand'
import { User } from '../types'
import { auth } from '../firebase/config'
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth'

interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false, // Inizialmente false per evitare problemi
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  
  loginWithGoogle: async () => {
    try {
      set({ loading: true })
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const firebaseUser = result.user
      
      const user: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'Utente',
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: new Date()
      }
      
      set({ user, loading: false })
    } catch (error) {
      console.error('Errore durante il login:', error)
      set({ loading: false })
      throw error
    }
  },
  
  logout: async () => {
    try {
      await signOut(auth)
      set({ user: null })
    } catch (error) {
      console.error('Errore durante il logout:', error)
      throw error
    }
  },
}))

// Listener per i cambi di stato dell'autenticazione
onAuthStateChanged(auth, (firebaseUser) => {
  const { setUser, setLoading } = useAuthStore.getState()
  
  if (firebaseUser) {
    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || 'Utente',
      photoURL: firebaseUser.photoURL || undefined,
      createdAt: new Date()
    }
    console.log('🔥 Firebase Auth: Utente autenticato:', user.displayName)
    setUser(user)
  } else {
    console.log('🔥 Firebase Auth: Utente disconnesso')
    setUser(null)
  }
  
  setLoading(false)
})
