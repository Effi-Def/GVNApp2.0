import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useNotificationsStore } from '../stores/useNotificationsStore'
import { useUserSettingsStore } from '../stores/UserSettingsStore'

function showDesktopNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {}
}

export function startNotificationsListeners(currentUserId: string) {
  const add = useNotificationsStore.getState().add
  const settings = useUserSettingsStore.getState().notifications

  const makeHandler = (type: 'event' | 'expense' | 'poll' | 'list') => (snapshot: any) => {
    snapshot.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const data = change.doc.data()
        // skip self-authored
        if (data.createdBy && data.createdBy === currentUserId) return
        const titleMap: Record<string, string> = {
          event: 'Nuovo evento',
          expense: 'Nuova spesa',
          poll: 'Nuovo sondaggio',
          list: 'Nuova lista',
        }
        const title = titleMap[type]
        const message = data.title || data.description || 'Nuovo elemento creato'
        add({ type, title, message, createdAt: new Date() })
        if (settings.desktopEnabled) {
          showDesktopNotification(title, message)
        }
      }
    })
  }

  const unsubEvents = onSnapshot(query(collection(db, 'events'), orderBy('createdAt', 'desc')), makeHandler('event'))
  const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')), makeHandler('expense'))
  const unsubPolls = onSnapshot(query(collection(db, 'polls'), orderBy('createdAt', 'desc')), makeHandler('poll'))
  const unsubLists = onSnapshot(query(collection(db, 'lists'), orderBy('createdAt', 'desc')), makeHandler('list'))

  return () => {
    unsubEvents()
    unsubExpenses()
    unsubPolls()
    unsubLists()
  }
}
