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
        displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Utente'),
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
    
    // 🚀 CARICA AUTOMATICAMENTE I DATI DI BASE
    await loadUserData()
  } else {
    console.log('🔥 Firebase Auth: Utente disconnesso')
    setUser(null)
    // Pulisci i dati quando l'utente si disconnette
    clearUserData()
  }
  
  setLoading(false)
})

// Funzione per caricare automaticamente i dati dell'utente
async function loadUserData() {
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
    
    // Dati mock come fallback (stessi di ExpensesPage-hybrid)
    const mockEvents = [
      {
        id: 'mock-1',
        title: 'Cena di Gruppo',
        description: 'Cena al ristorante Da Mario',
        category: 'cena' as const,
        date: new Date('2025-10-18T20:00:00'),
        time: '20:00',
        location: 'Ristorante Da Mario',
        createdBy: 'mock-user',
        participants: [
          { userId: 'mock-user', name: 'Andrea', status: 'yes' as const, respondedAt: new Date() },
          { userId: 'user2', name: 'Marco', status: 'yes' as const, respondedAt: new Date() },
          { userId: 'user3', name: 'Giulia', status: 'yes' as const, respondedAt: new Date() },
          { userId: 'user4', name: 'Luca', status: 'yes' as const, respondedAt: new Date() }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
    
    const mockExpenses = [
      {
        id: 'mock-exp-1',
        title: 'Ristorante "Da Mario"',
        amount: 158.00,
        paidBy: 'user2',
        participants: [
          { userId: 'user2', name: 'Marco', amount: 39.50, settled: false },
          { userId: 'mock-user', name: 'Andrea', amount: 39.50, settled: false },
          { userId: 'user3', name: 'Giulia', amount: 39.50, settled: false },
          { userId: 'user4', name: 'Luca', amount: 39.50, settled: false }
        ],
        eventId: 'mock-1',
        createdAt: new Date('2025-10-15'),
        updatedAt: new Date('2025-10-15')
      },
      {
        id: 'mock-exp-2',
        title: 'Biglietti Cinema',
        amount: 84.50,
        paidBy: 'mock-user',
        participants: [
          { userId: 'mock-user', name: 'Andrea', amount: 28.17, settled: false },
          { userId: 'user3', name: 'Giulia', amount: 28.17, settled: false },
          { userId: 'user5', name: 'Sara', amount: 28.16, settled: false }
        ],
        eventId: 'mock-2',
        createdAt: new Date('2025-10-12'),
        updatedAt: new Date('2025-10-12')
      }
    ]
    
    try {
      // Prova a caricare da Firebase
      const [eventsData, expensesData] = await Promise.all([
        eventService.getAll(),
        expenseService.getAll()
      ])
      
      setEvents(eventsData)
      setExpenses(expensesData)
      console.log('✅ Auto-loaded from Firebase:', { events: eventsData.length, expenses: expensesData.length })
    } catch (error) {
      console.log('⚠️ Firebase non disponibile, usando dati mock:', error)
      // Fallback ai dati mock
      setEvents(mockEvents)
      setExpenses(mockExpenses)
      console.log('✅ Auto-loaded mock data:', { events: mockEvents.length, expenses: mockExpenses.length })
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
