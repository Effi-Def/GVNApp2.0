import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import app from './config'
import { userService } from '../services/firestore'

export async function initMessaging(userId: string) {
  try {
    const supported = await isSupported()
    if (!supported) return null

    const messaging = getMessaging(app)
    // VAPID key from env
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      console.warn('VAPID key missing (VITE_FIREBASE_VAPID_KEY)')
      return null
    }

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: await navigator.serviceWorker.ready })
    if (token) {
      await userService.updatePartial(userId, { notifications: { fcmToken: token, pushEnabled: true } })
    }

    onMessage(messaging, (payload) => {
      // Optional: surface foreground messages
      const title = (payload.notification && payload.notification.title) || 'Notifica'
      const body = (payload.notification && payload.notification.body) || ''
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    })

    return token
  } catch (e) {
    console.error('Error initializing messaging:', e)
    return null
  }
}
