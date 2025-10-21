import { create } from 'zustand'
import { User } from '../types'
import { auth, storage } from '../firebase/config'
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
        displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Utente'),
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: new Date()
      }
      
      set({ user, loading: false })
      // Prefetch shared avatars right after first sign-in for instant Settings load
      try {
        const { fetchAndCacheAvatars } = await import('../utils/avatarCache')
        fetchAndCacheAvatars(storage)
      } catch {}
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
onAuthStateChanged(auth, async (firebaseUser) => {
  const { setUser, setLoading } = useAuthStore.getState()
  
  if (firebaseUser) {
    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Utente'),
      photoURL: firebaseUser.photoURL || undefined,
      createdAt: new Date()
    }
    console.log('🔥 Firebase Auth: Utente autenticato:', user.displayName)
    setUser(user)
    // Also prefetch avatars on session restore (page refresh)
    try {
      const { fetchAndCacheAvatars } = await import('../utils/avatarCache')
      fetchAndCacheAvatars(storage)
    } catch {}
    
    // 🚀 CARICA AUTOMATICAMENTE I DATI DI BASE
    await loadUserData()

    // 🔧 Carica impostazioni utente e avvia listeners notifiche
    try {
      const [{ useUserSettingsStore }, { startNotificationsListeners }] = await Promise.all([
        import('./UserSettingsStore'),
        import('../services/notifications')
      ])
      const { loadFromFirestore } = useUserSettingsStore.getState()
      await loadFromFirestore(user.id)
      startNotificationsListeners(user.id)
    } catch (e) {
      console.warn('⚠️ Impossibile inizializzare settings/notifications:', e)
    }
  } else {
    console.log('🔥 Firebase Auth: Utente disconnesso')
    setUser(null)
    // Pulisci i dati quando l'utente si disconnette
    clearUserData()
  }
  
  setLoading(false)
})

// Funzione per caricare automaticamente i dati dell'utente
export async function loadUserData() {
  try {
    console.log('📊 Loading user data automatically...')
    
    // Importa dinamicamente per evitare circular dependencies
    const [
      { eventService, expenseService },
      { useAppStore }
    ] = await Promise.all([
      import('../services/firestore'),
      import('./AppStore')
    ])
    
    const { setEvents, setExpenses } = useAppStore.getState()
    // Carica da Firebase; in caso di errore non inserire mock: mantieni vuoto e logga
    try {
      const [eventsData, expensesData] = await Promise.all([
        eventService.getAll(),
        expenseService.getAll()
      ])
      setEvents(eventsData)
      setExpenses(expensesData)
      console.log('✅ Auto-loaded from Firebase:', { events: eventsData.length, expenses: expensesData.length })
    } catch (error) {
      console.warn('⚠️ Impossibile caricare dati da Firebase:', error)
    }
  } catch (error) {
    console.error('❌ Errore nel caricamento automatico dati:', error)
  }
}

// Funzione per pulire i dati al logout
function clearUserData() {
  import('./AppStore').then(({ useAppStore }) => {
    const { setEvents, setExpenses, setPolls, setLists } = useAppStore.getState()
    setEvents([])
    setExpenses([])
    setPolls([])
    setLists([])
    console.log('🧹 Dati utente puliti')
  })
}
