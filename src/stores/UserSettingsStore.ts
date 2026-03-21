import { create } from 'zustand'
import { userService } from '../services/firestore'
import { useAuthStore } from './useAuthStore'
import { useNotificationsStore } from './useNotificationsStore'

const LOCAL_LAST_READ_KEY = 'gvn-chat-lastread'
const LOCAL_NOTIF_KEY_PREFIX = 'gvn-notification-settings:'

const loadLocalNotifications = (userId: string): Partial<NotificationSettings> | null => {
  if (typeof window === 'undefined') return null
  if (!userId) return null
  try {
    const raw = window.localStorage.getItem(LOCAL_NOTIF_KEY_PREFIX + userId)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as any) : null
  } catch {
    return null
  }
}

const saveLocalNotifications = (userId: string, settings: NotificationSettings) => {
  if (typeof window === 'undefined') return
  if (!userId) return
  try {
    window.localStorage.setItem(LOCAL_NOTIF_KEY_PREFIX + userId, JSON.stringify(settings))
  } catch {}
}

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
  desktopEnabled: true,
  pushEnabled: true,
  mutedEventIds: [],
  lastReadByEvent: loadLocalLastRead(),
  types: { event: true, expense: true, poll: true, list: true, chat: true },
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
      // Fast local fallback (helps when Firestore is slow/offline)
      const local = loadLocalNotifications(userId)
      if (local) {
        const defaults = createDefaultNotifications()
        set(state => ({
          notifications: {
            ...defaults,
            ...state.notifications,
            ...local,
            types: { ...(defaults.types || {}), ...((state.notifications.types || {}) as any), ...((local as any).types || {}) },
          }
        }))
      }

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

        // Only apply stored enabled flags if the user explicitly saved them.
        // If Firestore has no notifications sub-doc (new user), keep defaults (true).
        const hasStoredSettings = notifications && typeof notifications === 'object' && Object.keys(notifications).length > 0
        const desktopEnabled = hasStoredSettings && 'desktopEnabled' in notifications
          ? (notifications as any).desktopEnabled
          : defaults.desktopEnabled
        const pushEnabled = hasStoredSettings && 'pushEnabled' in notifications
          ? (notifications as any).pushEnabled
          : defaults.pushEnabled

        // Always merge defaults to avoid UI regressions when Firestore has partial objects.
        const mergedNotifications = {
          ...defaults,
          ...(notifications || {}),
          desktopEnabled,
          pushEnabled,
          mutedEventIds: notifications?.mutedEventIds ?? defaults.mutedEventIds,
          types: mergedTypes,
          lastReadByEvent: mergedLastRead,
        }

        set({
          profile: profile || { userId },
          notifications: mergedNotifications,
        })
        saveLocalLastRead(mergedLastRead)
        saveLocalNotifications(userId, mergedNotifications)
        // Propagate displayName into auth store for consistent navbar/name after reload
        if (profile?.displayName) {
          try {
            const { user, setUser } = useAuthStore.getState()
            if (user && user.displayName !== profile.displayName) {
              setUser({ ...user, displayName: profile.displayName })
            }
          } catch {}
        }
      } else {
        // New user: no Firestore record yet. Start with defaults (all notifications ON)
        // and immediately persist so next load reads the correct state.
        const defaults = createDefaultNotifications()
        set({ profile: { userId }, notifications: defaults })
        saveLocalLastRead(defaults.lastReadByEvent || {})
        saveLocalNotifications(userId, defaults)
        // Persist to Firestore in background — do not block the UI
        userService.updatePartial(userId, {
          profile: { userId },
          notifications: defaults,
        }).catch((e) => console.warn('⚠️ Could not persist default notifications for new user:', e))
      }
    } catch (e) {
      // Do not clobber local state on transient Firestore failures (network/rules)
      console.error('❌ Failed to load user settings from Firestore:', e)
      // Keep local preferences if present; otherwise keep current state.
      const local = loadLocalNotifications(userId)
      if (!local) throw e
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
    saveLocalNotifications(effectiveUserId, notifications)
  },
  saveNotificationsPartial: async (userId: string, partial: Partial<NotificationSettings>) => {
    if (!userId) throw new Error('Impossibile salvare: userId mancante')
    // Update Zustand store immediately so the UI reflects the change
    get().setNotifications(partial)
    // Use dot-notation updateDoc so we only write the changed fields and do NOT
    // overwrite the entire notifications map (which would wipe out fcmTokens,
    // pushEnabled, types, etc.).
    await userService.updateNestedPartial(userId, 'notifications', partial as Record<string, unknown>)
    saveLocalNotifications(userId, get().notifications)
  }
}))
