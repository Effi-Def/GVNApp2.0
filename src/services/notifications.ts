import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, writeBatch, where, getDocs } from 'firebase/firestore'
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
  const setAll = useNotificationsStore.getState().setAll
  const settings = useUserSettingsStore.getState().notifications

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
      const createdAt = data?.createdAt?.toDate ? data.createdAt.toDate() : new Date()
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

    // 2) Desktop notifications for newly added unread items
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return
      const data = change.doc.data() as any
      const createdAt = data?.createdAt?.toDate ? data.createdAt.toDate() : new Date()
      if (!data?.read && settings.desktopEnabled) {
        if (Date.now() - createdAt.getTime() < 60000) {
          showDesktopNotification(data.title, data.message)
        }
      }

      // Also ensure the added doc is present immediately even if setAll is delayed
      add({
        id: change.doc.id,
        type: normalizeType(data?.type) as any,
        title: data?.title,
        message: data?.message,
        createdAt,
        actionUrl: data?.actionUrl,
        read: !!data?.read,
        chatMention: !!data?.chatMention,
      })
    })
  })

  return unsubscribe
}

export async function markChatNotificationsAsRead(userId: string) {
  try {
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      where('read', '==', false),
      limit(500)
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) return

    const batch = writeBatch(db)
    let updates = 0
    snapshot.docs.forEach(d => {
      const data: any = d.data()
      if (data?.type === 'chat') {
        batch.update(d.ref, { read: true })
        updates++
      }
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
