import { create } from 'zustand'
import { User } from '../types'
import { auth } from '../firebase/config'
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'
import { useActiveFarmStore } from './useActiveFarmStore'
import { getUserKeys, userCanViewEvent } from '../utils/events'
import { eventService, expenseService, pollService, listService, userPrivateService } from '../services/firestore'
import { useAppStore } from './AppStore'

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
      // AuthContext's onAuthStateChanged listener will handle user creation/loading from Firestore
      await signInWithPopup(auth, provider)
      // loading will be set to false by AuthContext after Firestore read completes
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
// Promise singleton: chiamate concorrenti attendono la stessa promise in corso
let _loadUserDataPromise: Promise<void> | null = null
export function loadUserData(): Promise<void> {
  if (_loadUserDataPromise) {
    console.log('⏩ loadUserData already in progress, awaiting same promise')
    return _loadUserDataPromise
  }
  _loadUserDataPromise = _doLoadUserData().finally(() => { _loadUserDataPromise = null })
  return _loadUserDataPromise
}

async function _doLoadUserData() {
  try {
    console.log('📊 Loading user data automatically...')
    
    const { setEvents, setExpenses, setPolls, setLists, setFarmIds } = useAppStore.getState()
    // Carica da Firebase; in caso di errore non inserire mock: mantieni vuoto e logga
    try {
      const u = useAuthStore.getState().user
      const farmIds = await (async () => {
        try {
          if (!u?.id) return []
          return await userPrivateService.getFarmIds(u.id)
        } catch {
          return []
        }
      })()

      try { setFarmIds(Array.isArray(farmIds) ? farmIds : []) } catch {}

      if (u?.id) {
        // Hydrate active farm + farms metadata
        await useActiveFarmStore.getState().hydrateForUser({ userId: u.id, farmIds: Array.isArray(farmIds) ? farmIds : [] })
      }

      const activeFarmId = useActiveFarmStore.getState().activeFarmId
      const userKeys = getUserKeys(u)
      const eventsAll = await eventService.getAll()

      // Load ALL events across all user farms — ChatsPage needs events from every farm
      const allFarmsCtx = { userKeys, farmIds: Array.isArray(farmIds) ? farmIds : [] }
      const allUserEvents = eventsAll.filter(e => userCanViewEvent(e, allFarmsCtx))

      // Scope expenses / polls / lists to the active farm only
      const activeFarmCtx = { userKeys, farmIds: activeFarmId ? [activeFarmId] : [] }
      const activeFarmEventIds = new Set(
        allUserEvents.filter(e => userCanViewEvent(e, activeFarmCtx)).map(e => e.id)
      )

      const [scopedExpenses, scopedPolls] = await Promise.all([
        expenseService.getForEventIds(Array.from(activeFarmEventIds)).catch(() => []),
        pollService.getForUserVisibleEvents({ userId: u?.id || '', eventIds: Array.from(activeFarmEventIds) }).catch(() => []),
      ])

      const listsData = u?.id
        ? await listService.getForUserVisibleEvents({
            userId: u.id,
            eventIds: Array.from(activeFarmEventIds),
          }).catch(() => [])
        : []
      setEvents(allUserEvents)
      setExpenses(scopedExpenses)
      setPolls(scopedPolls)
      setLists(listsData)
      console.log('✅ Auto-loaded from Firebase:', { events: allUserEvents.length, expenses: scopedExpenses.length, polls: scopedPolls.length, lists: listsData.length, activeFarmId })
    } catch (error) {
      console.warn('⚠️ Impossibile caricare dati da Firebase:', error)
    }
  } catch (error) {
    console.error('❌ Errore nel caricamento automatico dati:', error)
  }
}

// Refresh only the farm-scoped data (events, polls, lists, chat inputs depend on events).
// Use when switching farms to avoid re-initializing unrelated user settings.
let _refreshActiveFarmDataPromise: Promise<void> | null = null
export function refreshActiveFarmData(): Promise<void> {
  if (_refreshActiveFarmDataPromise) {
    console.log('⏩ refreshActiveFarmData already in progress, awaiting same promise')
    return _refreshActiveFarmDataPromise
  }
  _refreshActiveFarmDataPromise = _doRefreshActiveFarmData().finally(() => { _refreshActiveFarmDataPromise = null })
  return _refreshActiveFarmDataPromise
}

async function _doRefreshActiveFarmData() {
  try {
    const u = useAuthStore.getState().user
    if (!u?.id) return

    const activeFarmId = useActiveFarmStore.getState().activeFarmId
    const userKeys = getUserKeys(u)

    const { setEvents, setExpenses, setPolls, setLists } = useAppStore.getState()
    const allFarmIds: string[] = useAppStore.getState().farmIds || []

    // Clear stale data before reloading
    setEvents([])
    setExpenses([])
    setPolls([])
    setLists([])

    const eventsAll = await eventService.getAll()

    // Load ALL events across all user farms — ChatsPage needs events from every farm
    const allFarmsCtx = { userKeys, farmIds: allFarmIds }
    const allUserEvents = eventsAll.filter(e => userCanViewEvent(e, allFarmsCtx))

    // Scope expenses / polls / lists to the active farm only
    const activeFarmCtx = { userKeys, farmIds: activeFarmId ? [activeFarmId] : [] }
    const activeFarmEventIds = new Set(
      allUserEvents.filter(e => userCanViewEvent(e, activeFarmCtx)).map(e => e.id)
    )

    const [scopedExpenses, scopedPolls] = await Promise.all([
      expenseService.getForEventIds(Array.from(activeFarmEventIds)).catch(() => []),
      pollService.getForUserVisibleEvents({ userId: u.id, eventIds: Array.from(activeFarmEventIds) }).catch(() => []),
    ])
    const listsData = await listService.getForUserVisibleEvents({ userId: u.id, eventIds: Array.from(activeFarmEventIds) }).catch(() => [])

    setEvents(allUserEvents)
    setExpenses(scopedExpenses)
    setPolls(scopedPolls)
    setLists(listsData)
  } catch (e) {
    console.warn('⚠️ refreshActiveFarmData failed:', e)
  }
}

// Funzione per pulire i dati al logout
export function clearUserData() {
  const { setEvents, setExpenses, setPolls, setLists } = useAppStore.getState()
  setEvents([])
  setExpenses([])
  setPolls([])
  setLists([])
  console.log('🧹 Dati utente puliti')

  try {
    useActiveFarmStore.setState({
      initializedForUserId: null,
      initializing: false,
      farms: [],
      activeFarmId: null,
    })
  } catch {}
}
