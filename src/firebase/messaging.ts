import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import app from './config'
import { userService } from '../services/firestore'

export async function initMessaging(userId: string) {
  try {
    // Guard: avoid initializing when env still contains placeholder values
    const senderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    const appId = import.meta.env.VITE_FIREBASE_APP_ID
    const senderIdLooksPlaceholder = !senderId || /(^(123456789)$|your)/i.test(senderId)
    const appIdLooksPlaceholder = !appId || /(abcdef123456|123456789:web)/i.test(appId)
    if (senderIdLooksPlaceholder || appIdLooksPlaceholder) {
      console.warn('[FCM] Skipping init: placeholder senderId/appId in .env.local', {
        senderId,
        appId,
      })
      return null
    }

    const supported = await isSupported()
    if (!supported) {
      console.warn('[FCM] Messaging not supported in this browser')
      return null
    }

    const messaging = getMessaging(app)
    // VAPID key from env
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      console.warn('VAPID key missing (VITE_FIREBASE_VAPID_KEY)')
      return null
    }

    // Ensure notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const res = await Notification.requestPermission().catch(() => 'denied')
      if (res !== 'granted') {
        console.warn('Push permission denied by user')
        return null
      }
    }

    // Use the existing PWA service worker (sw.js) registration
    let reg: ServiceWorkerRegistration | undefined
    if ('serviceWorker' in navigator) {
      try {
        reg = await navigator.serviceWorker.ready
        console.info('[FCM] Using existing SW registration for messaging')
      } catch (swErr) {
        console.warn('[FCM] navigator.serviceWorker.ready failed, proceeding without explicit reg:', swErr)
      }
    }

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
    if (token) {
      await userService.addFcmToken(userId, token)
      console.info('[FCM] Token obtained and stored for user:', userId)
    }

    onMessage(messaging, (payload) => {
      // Optional: surface foreground messages
      const title = (payload.notification && payload.notification.title) || 'Notifica'
      const body = (payload.notification && payload.notification.body) || ''
      if ('Notification' in window && Notification.permission === 'granted') {
        const click_action = (payload.fcmOptions as any)?.link || (payload.data && (payload.data as any).click_action)
        const n = new Notification(title, { body })
        n.onclick = () => {
          if (click_action) {
            window.open(click_action, '_blank')
          }
        }
      }
    })

    return token
  } catch (e) {
    console.error('Error initializing messaging:', e)
    return null
  }
}
