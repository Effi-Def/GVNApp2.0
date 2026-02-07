import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import app from './config'
import { userService } from '../services/firestore'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function getPwaServiceWorkerRegistration(log: (msg: string) => void, timeoutMs = 30000): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not available in this browser')
  }

  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      const swReg = regs.find(r => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ''
        return url.includes('/sw.js') || url.endsWith('/sw.js')
      })

      if (swReg) {
        const url = swReg.active?.scriptURL || swReg.installing?.scriptURL || swReg.waiting?.scriptURL || ''
        log(`[FCM] Found SW registration: ${url || swReg.scope}`)
        return swReg
      }
    } catch (e) {
      lastError = e
    }

    // Fallback: wait for the controlling SW (may take a moment on cold start)
    try {
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        sleep(750).then(() => null as any),
      ])
      if (ready) {
        const readyUrl = ready.active?.scriptURL || ready.installing?.scriptURL || ready.waiting?.scriptURL || ''
        if (readyUrl.includes('/sw.js') || readyUrl.endsWith('/sw.js')) {
          log(`[FCM] navigator.serviceWorker.ready resolved to PWA SW: ${readyUrl || ready.scope}`)
          return ready
        }
        // Important: don't use a non-PWA SW (e.g. legacy firebase-messaging-sw.js)
        log(`[FCM] navigator.serviceWorker.ready resolved to non-PWA SW (${readyUrl || ready.scope}); waiting for /sw.js...`)
      }
    } catch (e) {
      lastError = e
    }

    await sleep(250)
  }

  throw new Error(`Service Worker not ready for push within ${Math.round(timeoutMs / 1000)}s${lastError ? ` (${String((lastError as any)?.message || lastError)})` : ''}`)
}

export async function initMessaging(userId: string, onLog?: (msg: string) => void) {
  const log = (msg: string) => {
    console.log(msg)
    if (onLog) onLog(msg)
  }

  try {
    // Guard: avoid initializing when env still contains placeholder values
    const senderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    const appId = import.meta.env.VITE_FIREBASE_APP_ID
    const senderIdLooksPlaceholder = !senderId || /(^(123456789)$|your)/i.test(senderId)
    const appIdLooksPlaceholder = !appId || /(abcdef123456|123456789:web)/i.test(appId)
    if (senderIdLooksPlaceholder || appIdLooksPlaceholder) {
      throw new Error(`Invalid Firebase Config: senderId=${senderId}, appId=${appId}`)
    }

    log('[FCM] Checking support...')
    const supported = await isSupported()
    if (!supported) {
      throw new Error('FCM not supported in this browser')
    }

    const messaging = getMessaging(app)
    // VAPID key from env
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      throw new Error('Missing VAPID key in config')
    }

    // Ensure notification permission
    log('[FCM] Checking permission...')
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const res = await Notification.requestPermission().catch(() => 'denied')
      if (res !== 'granted') {
        throw new Error('Push permission denied by user')
      }
    }

    // Always use the PWA service worker (sw.js) registration.
    // IMPORTANT: calling getToken without serviceWorkerRegistration may register a different SW
    // (e.g. /firebase-messaging-sw.js) and generate a token that won't receive pushes in this PWA.
    log('[FCM] Locating PWA SW registration...')
    const reg = await getPwaServiceWorkerRegistration(log)

    log('[FCM] Calling getToken...')
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
    if (token) {
      log('[FCM] Token obtained, saving to Firestore...')
      await userService.addFcmToken(userId, token)
      log(`[FCM] Token saved for user: ${userId}`)

      // Update local settings store too (prevents later saves from wiping tokens)
      try {
        const { useUserSettingsStore } = await import('../stores/UserSettingsStore')
        const current = useUserSettingsStore.getState().notifications
        const existing = current.fcmTokens || (current.fcmToken ? [current.fcmToken] : [])
        const merged = Array.from(new Set([...existing, token]))
        useUserSettingsStore.getState().setNotifications({
          pushEnabled: true,
          fcmToken: token,
          fcmTokens: merged,
        })
      } catch {}
    }

    onMessage(messaging, async (payload) => {
      console.log('[FCM] Foreground message received:', payload)
      // Optional: surface foreground messages
      const title = (payload.notification && payload.notification.title) || 'Notifica'
      const body = (payload.notification && payload.notification.body) || ''
      const click_action = (payload.fcmOptions as any)?.link || (payload.data && (payload.data as any).click_action)
      
      // Salva la notifica nello store
      try {
        // Use dynamic import instead of require for Vite compatibility
        const { useNotificationsStore } = await import('../stores/useNotificationsStore')
        const store = useNotificationsStore.getState()
        
        // Estrai eventId dall'URL se presente
        let eventId: string | undefined
        if (click_action && typeof click_action === 'string') {
          const match = click_action.match(/\/events\/([^\/]+)/)
          if (match) eventId = match[1]
        }
        
        store.add({
          id: `fcm_${Date.now()}`,
          type: 'comment',
          title,
          message: body,
          createdAt: new Date(),
          read: false,
          actionUrl: click_action
        })
        
        console.log('🔔 FCM notification saved to store:', { title, body, eventId, click_action })
      } catch (e) {
        console.warn('Failed to save FCM notification to store:', e)
      }
      
      // Show system notification even in foreground
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          // Try Service Worker first for better PWA integration
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready
            await reg.showNotification(title, {
              body,
              icon: '/icons/pig-192.png',
              data: { click_action }
            })
          } else {
            // Fallback to standard API
            const n = new Notification(title, { body, icon: '/icons/pig-192.png' })
            n.onclick = () => {
              if (click_action) window.open(click_action, '_blank')
            }
          }
        } catch (err) {
          console.error('Error showing notification:', err)
          // Last resort fallback
          new Notification(title, { body })
        }
      }
    })

    return token
  } catch (e) {
    console.error('Error initializing messaging:', e)
    throw e // Rethrow to allow UI to handle/display error
  }
}
