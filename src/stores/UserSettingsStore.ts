import { create } from 'zustand'
import { userService } from '../services/firestore'

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
  saveNotifications: () => Promise<void>
}

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
  profile: null,
  notifications: { desktopEnabled: false, pushEnabled: false, mutedEventIds: [], lastReadByEvent: {}, types: { event: true, expense: true, poll: true, list: true, chat: false } },
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
    map[eventId] = when ?? Date.now()
    const next = { ...notifications, lastReadByEvent: map }
    set({ notifications: next })
    if (profile) await userService.updatePartial(profile.userId, { notifications: next })
  },
  loadFromFirestore: async (userId: string) => {
    set({ loading: true })
    try {
      const data = await userService.get(userId)
      if (data) {
        const { profile, notifications } = data
        set({ 
          profile: profile || { userId }, 
          notifications: notifications || { desktopEnabled: false, pushEnabled: false, mutedEventIds: [], lastReadByEvent: {}, types: { event: true, expense: true, poll: true, list: true, chat: false } } 
        })
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
        set({ profile: { userId }, notifications: { desktopEnabled: false, pushEnabled: false, mutedEventIds: [], lastReadByEvent: {}, types: { event: true, expense: true, poll: true, list: true, chat: false } } })
      }
    } finally {
      set({ loading: false })
    }
  },
  saveProfile: async () => {
    const { profile } = get()
    if (!profile) return
    await userService.updatePartial(profile.userId, { profile })
  },
  saveNotifications: async () => {
    const { profile, notifications } = get()
    if (!profile) return
    await userService.updatePartial(profile.userId, { notifications })
  }
}))
