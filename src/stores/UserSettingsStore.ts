import { create } from 'zustand'
import { userService } from '../services/firestore'

const LOCAL_LAST_READ_KEY = 'gvn-chat-lastread'

const loadLocalLastRead = (): Record<string, number> => {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LOCAL_LAST_READ_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

const saveLocalLastRead = (map: Record<string, number>) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_LAST_READ_KEY, JSON.stringify(map))
  } catch {}
}

const createDefaultNotifications = (): NotificationSettings => ({
  desktopEnabled: false,
  pushEnabled: false,
  mutedEventIds: [],
  lastReadByEvent: loadLocalLastRead(),
  types: { event: true, expense: true, poll: true, list: true, chat: false },
})

export interface UserProfileSettings {
  userId: string
  displayName?: string
  firstName?: string
  lastName?: string
  avatarKey?: string
}

export interface NotificationSettings {
  desktopEnabled: boolean
  pushEnabled: boolean
  fcmToken?: string
  fcmTokens?: string[] // Array of tokens for multiple devices
  telegramChatId?: string // 📱 Telegram Chat ID for notifications
  // Per-event chat settings
  mutedEventIds?: string[]
  lastReadByEvent?: Record<string, number> // epoch ms of last opened/read chat per event
  // Granular preferences by type
  types?: {
    event?: boolean
    expense?: boolean
    poll?: boolean
    list?: boolean
    chat?: boolean
  }
}

interface UserSettingsState {
  profile: UserProfileSettings | null
  notifications: NotificationSettings
  loading: boolean
  setProfile: (p: Partial<UserProfileSettings>) => void
  setNotifications: (n: Partial<NotificationSettings>) => void
  toggleEventMute: (eventId: string) => Promise<void>
  markEventChatRead: (eventId: string, when?: number) => Promise<void>
  loadFromFirestore: (userId: string) => Promise<void>
  saveProfile: () => Promise<void>
  saveNotifications: (userId?: string) => Promise<void>
  saveNotificationsPartial: (userId: string, partial: Partial<NotificationSettings>) => Promise<void>
}

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
  profile: null,
  notifications: createDefaultNotifications(),
  loading: false,
  setProfile: (p) => set(state => ({ profile: { ...(state.profile || { userId: p.userId || '' }), ...p } })),
  setNotifications: (n) => set(state => ({ 
    notifications: { 
      ...state.notifications, 
      ...n, 
      types: { ...(state.notifications.types || {}), ...(n as any).types }
    } 
  })),
  toggleEventMute: async (eventId: string) => {
    const { notifications, profile } = get()
    const current = new Set(notifications.mutedEventIds || [])
    if (current.has(eventId)) current.delete(eventId); else current.add(eventId)
    const next = { ...notifications, mutedEventIds: Array.from(current) }
    set({ notifications: next })
    if (profile) await userService.updatePartial(profile.userId, { notifications: next })
  },
  markEventChatRead: async (eventId: string, when?: number) => {
    const { notifications, profile } = get()
    const map = { ...(notifications.lastReadByEvent || {}) }
    const timestamp = when ?? Date.now()
    map[eventId] = timestamp
    const next = { ...notifications, lastReadByEvent: map }
    
    console.log(`✅ Marking event ${eventId} as read at ${timestamp}`, { before: notifications.lastReadByEvent?.[eventId], after: timestamp })
    
    // Save to local storage immediately to prevent regression on reload
    saveLocalLastRead(map)

    set({ notifications: next })
    if (profile) await userService.updatePartial(profile.userId, { notifications: next })
    
    // Rimuovi le notifiche di chat per questo evento dall'app store
    try {
      const { useNotificationsStore } = await import('./useNotificationsStore')
      const store = useNotificationsStore.getState()
      
      // Trova e rimuovi notifiche che puntano a questo evento
      const toRemove = store.notifications.filter(n => 
        n.actionUrl?.includes(`/events/${eventId}`) || n.actionUrl?.includes(eventId)
      )
      
      if (toRemove.length > 0) {
        const newNotifications = store.notifications.filter(n => !toRemove.includes(n))
        useNotificationsStore.setState({ notifications: newNotifications })
      }
    } catch (e) {
      console.warn('Failed to clear chat notifications:', e)
    }
  },
  loadFromFirestore: async (userId: string) => {
    set({ loading: true })
    try {
      const data = await userService.get(userId)
      if (data) {
        const { profile, notifications } = data
        const localLastRead = loadLocalLastRead()
        
        // Merge lastReadByEvent taking the max timestamp to avoid regression
        const firestoreLastRead = notifications?.lastReadByEvent || {}
        const mergedLastRead = { ...firestoreLastRead }
        
        for (const [k, v] of Object.entries(localLastRead)) {
          if (!mergedLastRead[k] || v > mergedLastRead[k]) {
            mergedLastRead[k] = v
          }
        }

        const defaults = createDefaultNotifications()
        const mergedTypes = {
          ...(defaults.types || {}),
          ...((notifications?.types || {}) as any),
        }

        // Always merge defaults to avoid UI regressions when Firestore has partial objects.
        const mergedNotifications = {
          ...defaults,
          ...(notifications || {}),
          mutedEventIds: notifications?.mutedEventIds ?? defaults.mutedEventIds,
          types: mergedTypes,
          lastReadByEvent: mergedLastRead,
        }

        set({
          profile: profile || { userId },
          notifications: mergedNotifications,
        })
        saveLocalLastRead(mergedLastRead)
        // Propagate displayName into auth store for consistent navbar/name after reload
        if (profile?.displayName) {
          try {
            const { useAuthStore } = await import('./useAuthStore')
            const { user, setUser } = useAuthStore.getState() as any
            if (user && user.displayName !== profile.displayName) {
              setUser({ ...user, displayName: profile.displayName })
            }
          } catch {}
        }
      } else {
        const defaults = createDefaultNotifications()
        set({ profile: { userId }, notifications: defaults })
        saveLocalLastRead(defaults.lastReadByEvent || {})
      }
    } catch (e) {
      // Do not clobber local state on transient Firestore failures (network/rules)
      console.error('❌ Failed to load user settings from Firestore:', e)
      throw e
    } finally {
      set({ loading: false })
    }
  },
  saveProfile: async () => {
    const { profile } = get()
    if (!profile) return
    await userService.updatePartial(profile.userId, { profile })
  },
  saveNotifications: async (userId?: string) => {
    const { profile, notifications } = get()
    const effectiveUserId = profile?.userId || userId
    if (!effectiveUserId) {
      throw new Error('Impossibile salvare: userId mancante (profilo non caricato)')
    }

    // Ensure we have at least a minimal profile in state for subsequent saves.
    if (!profile && userId) {
      set({ profile: { userId } })
    }

    await userService.updatePartial(effectiveUserId, { notifications })
  },
  saveNotificationsPartial: async (userId: string, partial: Partial<NotificationSettings>) => {
    if (!userId) throw new Error('Impossibile salvare: userId mancante')
    await userService.updatePartial(userId, { notifications: partial })
  }
}))
