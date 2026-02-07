import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AppNotification {
  id: string
  type: 'event' | 'expense' | 'poll' | 'list' | 'chat' | 'payment' | 'comment' | 'reminder'
  title: string
  message: string
  createdAt: Date
  read: boolean
  actionUrl?: string
  // For chat notifications: true when user was tagged via @mention
  chatMention?: boolean
}

interface NotificationsState {
  notifications: AppNotification[]
  setAll: (items: AppNotification[]) => void
  add: (n: Omit<AppNotification, 'id'> & { id?: string }) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  markTypeAsRead: (type: AppNotification['type']) => void
  removeRead: () => void
  unreadCount: () => number
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      setAll: (items) => set({ notifications: items }),
      add: (n) => set(state => {
        // Evita duplicati
        const exists = state.notifications.some(existing => existing.id === n.id)
        if (exists) {
          // Se esiste già, aggiorna lo stato di lettura se è cambiato
          if (exists && n.read !== undefined && n.read !== (state.notifications.find(x => x.id === n.id)?.read)) {
             return {
               notifications: state.notifications.map(x => x.id === n.id ? { ...x, read: n.read } : x)
             }
          }
          return state
        }
        
        return {
          notifications: [
            { id: n.id || `${Date.now()}`, ...n },
            ...state.notifications
          ]
        }
      }),
      markAsRead: (id) => set(state => ({ 
        notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n) 
      })),
      markAllAsRead: () => set(state => ({ 
        notifications: state.notifications.map(n => ({ ...n, read: true })) 
      })),
      markTypeAsRead: (type) => set(state => ({
        notifications: state.notifications.map(n => n.type === type ? { ...n, read: true } : n)
      })),
      removeRead: () => set(state => ({
        notifications: state.notifications.filter(n => !n.read)
      })),
      unreadCount: () => get().notifications.filter(n => !n.read).length,
    }),
    {
      name: 'gvn-notifications-storage',
      version: 1,
      // Converti Date per serializzazione JSON
      partialize: (state) => ({
        notifications: state.notifications.map(n => ({
          ...n,
          createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt
        }))
      }),
      // Ripristina Date dalla deserializzazione (senza mutare lo state in-place: serve triggerare i subscriber)
      migrate: (persisted: any, _version) => {
        if (!persisted || typeof persisted !== 'object') return persisted as any
        const raw = Array.isArray(persisted.notifications) ? persisted.notifications : []
        return {
          ...persisted,
          notifications: raw.map((n: any) => ({
            ...n,
            createdAt: typeof n?.createdAt === 'string' ? new Date(n.createdAt) : n?.createdAt,
          })),
        }
      },
    }
  )
)
