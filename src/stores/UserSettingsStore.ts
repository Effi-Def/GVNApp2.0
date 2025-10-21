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
}

interface UserSettingsState {
  profile: UserProfileSettings | null
  notifications: NotificationSettings
  loading: boolean
  setProfile: (p: Partial<UserProfileSettings>) => void
  setNotifications: (n: Partial<NotificationSettings>) => void
  loadFromFirestore: (userId: string) => Promise<void>
  saveProfile: () => Promise<void>
  saveNotifications: () => Promise<void>
}

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
  profile: null,
  notifications: { desktopEnabled: false, pushEnabled: false },
  loading: false,
  setProfile: (p) => set(state => ({ profile: { ...(state.profile || { userId: p.userId || '' }), ...p } })),
  setNotifications: (n) => set(state => ({ notifications: { ...state.notifications, ...n } })),
  loadFromFirestore: async (userId: string) => {
    set({ loading: true })
    try {
      const data = await userService.get(userId)
      if (data) {
        const { profile, notifications } = data
        set({ profile: profile || { userId }, notifications: notifications || { desktopEnabled: false, pushEnabled: false } })
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
        set({ profile: { userId }, notifications: { desktopEnabled: false, pushEnabled: false } })
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
