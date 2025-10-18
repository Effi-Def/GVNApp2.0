import { create } from 'zustand'

export interface AppNotification {
  id: string
  type: 'event' | 'expense' | 'poll' | 'list' | 'payment' | 'comment' | 'reminder'
  title: string
  message: string
  createdAt: Date
  read: boolean
  actionUrl?: string
}

interface NotificationsState {
  notifications: AppNotification[]
  add: (n: Omit<AppNotification, 'id' | 'read'> & { id?: string }) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  unreadCount: () => number
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  add: (n) => set(state => ({
    notifications: [
      { id: n.id || `${Date.now()}`, read: false, ...n },
      ...state.notifications
    ]
  })),
  markAsRead: (id) => set(state => ({ notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),
  markAllAsRead: () => set(state => ({ notifications: state.notifications.map(n => ({ ...n, read: true })) })),
  unreadCount: () => get().notifications.filter(n => !n.read).length,
}))
