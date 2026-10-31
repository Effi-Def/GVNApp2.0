import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, writeBatch, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useNotificationsStore } from '../stores/useNotificationsStore'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { toDateOrNow } from './firestoreMappers'

function showDesktopNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {}
}

export function startNotificationsListeners(currentUserId: string) {
  const setAll = useNotificationsStore.getState().setAll

  // NOTE: Do NOT capture `settings` here. useUserSettingsStore.getState() is called
  // lazily inside the snapshot callback so the handler always sees the *current*
  // desktopEnabled value, even if the user toggles it after login.

  // Listen to the user's private notifications collection (populated by Cloud Functions)
  const q = query(
    collection(db, 'users', currentUserId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50)
  )

  const normalizeType = (raw: unknown) => {
    const t = typeof raw === 'string' ? raw : ''
    if (t === 'event' || t === 'expense' || t === 'poll' || t === 'list' || t === 'chat' || t === 'payment' || t === 'comment' || t === 'reminder') return t
    return 'comment'
  }

  const unsubscribe = onSnapshot(q, (snapshot) => {
    // 1) Reconcile local store with server snapshot (prevents phantom persisted unread badge)
    const next = snapshot.docs.map((d) => {
      const data = d.data() as any
      const createdAt = toDateOrNow(data?.createdAt)
      return {
        id: d.id,
        type: normalizeType(data?.type) as any,
        title: data?.title,
        message: data?.message,
        createdAt,
        actionUrl: data?.actionUrl,
        read: !!data?.read,
        chatMention: !!data?.chatMention,
      }
    })
    setAll(next)

    // 2) Desktop notifications for newly added unread items.
    //    Read settings lazily so toggling desktopEnabled takes effect immediately.
    const settings = useUserSettingsStore.getState().notifications
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return
      const data = change.doc.data() as any
      const createdAt = toDateOrNow(data?.createdAt)
      // Show an OS popup only for fresh (< 60 s old) unread docs when the user
      // has desktop notifications enabled.
      if (!data?.read && settings.desktopEnabled) {
        if (Date.now() - createdAt.getTime() < 60000) {
          showDesktopNotification(data.title, data.message)
        }
      }
      // NOTE: No explicit add() call here. setAll() above already synced the full
      // snapshot into the store. Calling add() as well would double-insert every
      // incoming doc because setAll() is synchronous and runs first.
    })
  })

  return unsubscribe
}

export async function markChatNotificationsAsRead(userId: string) {
  try {
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      where('type', '==', 'chat'),
      where('read', '==', false),
      limit(500)
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) return

    const batch = writeBatch(db)
    let updates = 0
    snapshot.docs.forEach(d => {
      batch.update(d.ref, { read: true })
      updates++
    })
    if (updates > 0) await batch.commit()
  } catch (e) {
    console.error('Error marking chat notifications as read:', e)
  }
}

export const notificationService = {
  async markAsRead(userId: string, notificationId: string) {
    try {
      const ref = doc(db, 'users', userId, 'notifications', notificationId)
      await updateDoc(ref, { read: true })
    } catch (e) {
      console.error('Error marking notification as read:', e)
    }
  },
  
  async markAllAsRead(userId: string) {
    try {
      const q = query(
        collection(db, 'users', userId, 'notifications'), 
        where('read', '==', false),
        limit(500)
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return

      const batch = writeBatch(db)
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { read: true })
      })
      await batch.commit()
    } catch (e) {
      console.error('Error marking all notifications as read:', e)
    }
  }
}
