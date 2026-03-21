import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import app from './config'
import { userService } from '../services/firestore'
import { useUserSettingsStore } from '../stores/UserSettingsStore'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// --- Singleton guards ---
// Tracks the userId for which the messaging/onMessage handler has already been
// initialized so that re-renders / resume events don't register a second
// (or third…) listener and cause duplicate in-app notifications.
let _messagingInitializedForUser: string | null = null
// Promise reference when an init is already in progress (avoids parallel inits)
let _messagingInitPromise: Promise<string | null> | null = null

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

export async function initMessaging(userId: string, onLog?: (msg: string) => void, force?: boolean) {
  const log = (msg: string) => {
    console.log(msg)
    if (onLog) onLog(msg)
  }

  // If already initialized for this user, return unless a force re-init is requested.
  // force=true is used when the user explicitly re-enables push notifications in the
  // same session (e.g. toggles pushEnabled on -> off -> on).
  if (_messagingInitializedForUser === userId && !onLog && !force) {
    log('[FCM] Already initialized for this user, skipping re-init')
    return null
  }

  // If a parallel init is already running for the same user (and not forced), wait for it.
  if (_messagingInitPromise && _messagingInitializedForUser === userId && !onLog && !force) {
    log('[FCM] Init already in progress, waiting...')
    return _messagingInitPromise
  }

  _messagingInitPromise = _doInitMessaging(userId, log)
  try {
    const token = await _messagingInitPromise
    return token
  } finally {
    _messagingInitPromise = null
  }
}

async function _doInitMessaging(userId: string, log: (msg: string) => void) {
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

    // Register the foreground message handler only once per user session.
    // If we've already set it up for this user, skip to avoid duplicate handlers
    // that would cause multiple in-app notifications for a single push message.
    if (_messagingInitializedForUser !== userId) {
      onMessage(messaging, async (payload) => {
        console.log('[FCM] Foreground message received:', payload)
        // NOTE: Non salviamo la notifica nello store qui.
        // L'onSnapshot in notifications.ts (setAll) sincronizerà automaticamente
        // entro pochi ms dalla scrittura Firestore fatta dalla Cloud Function.
        // Aggiungere un add() ottimistico con id temporaneo causerebbe una
        // notifica fantasma che setAll() cancella immediatamente dopo.
      })
      _messagingInitializedForUser = userId
      log(`[FCM] onMessage handler registered for user: ${userId}`)
    }

    return token
  } catch (e) {
    console.error('Error initializing messaging:', e)
    throw e
  }
}
