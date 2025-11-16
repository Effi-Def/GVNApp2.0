import { create } from 'zustand'
import { User } from '../types'
import { auth, storage } from '../firebase/config'
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'

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
  loading: true, // Avvia in loading finché Firebase non idrata la sessione
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

// Funzione per caricare automaticamente i dati dell'utente
export async function loadUserData() {
  try {
    console.log('📊 Loading user data automatically...')
    
    // Importa dinamicamente per evitare circular dependencies
    const [
      { eventService, expenseService, pollService, listService },
      { useAppStore }
    ] = await Promise.all([
      import('../services/firestore'),
      import('./AppStore')
    ])
    
    const { setEvents, setExpenses, setPolls, setLists } = useAppStore.getState()
    // Carica da Firebase; in caso di errore non inserire mock: mantieni vuoto e logga
    try {
      const [eventsData, expensesData, pollsData, listsData] = await Promise.all([
        eventService.getAll(),
        expenseService.getAll(),
        pollService.getAll(),
        listService.getAll(),
      ])
      setEvents(eventsData)
      setExpenses(expensesData)
      setPolls(pollsData)
      setLists(listsData)
      console.log('✅ Auto-loaded from Firebase:', { events: eventsData.length, expenses: expensesData.length, polls: pollsData.length, lists: listsData.length })
    } catch (error) {
      console.warn('⚠️ Impossibile caricare dati da Firebase:', error)
    }
  } catch (error) {
    console.error('❌ Errore nel caricamento automatico dati:', error)
  }
}

// Funzione per pulire i dati al logout
export function clearUserData() {
  import('./AppStore').then(({ useAppStore }) => {
    const { setEvents, setExpenses, setPolls, setLists } = useAppStore.getState()
    setEvents([])
    setExpenses([])
    setPolls([])
    setLists([])
    console.log('🧹 Dati utente puliti')
  })
}
