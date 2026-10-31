/**
 * NotificationPermissionBanner
 *
 * Chiede le notifiche una sola volta, dopo gli altri passi del primo avvio.
 * - Permesso 'default': spiega a cosa servono e il browser lo chiede solo dopo un tocco.
 * - Permesso 'denied': non possiamo chiederlo di nuovo in JS, indirizziamo
 *   l'utente alle impostazioni del browser.
 *
 * Storage key: 'gvn-notif-denied-banner-seen:{userId}' (per-utente)
 */

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { initMessaging } from '../firebase/messaging'
import { FIRST_RUN_EVENT, isThemeSetupDone, isTutorialPending } from '../utils/firstRun'

// La chiave include l'userId per isolare il dismiss su dispositivi condivisi.
const getSeenKey = (userId: string) => `gvn-notif-denied-banner-seen:${userId}`

export default function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [busy, setBusy] = useState(false)
  const { user } = useAuthStore()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!user?.id) return
    if (typeof Notification === 'undefined') return
    const seenKey = getSeenKey(user.id)
    let timer: ReturnType<typeof setTimeout> | undefined

    const evaluate = () => {
      if (timer) clearTimeout(timer)
      try { if (localStorage.getItem(seenKey)) return } catch {}
      if (Notification.permission === 'granted') return
      if (!isThemeSetupDone() || isTutorialPending() || pathname === '/onboarding') return
      timer = setTimeout(() => setPermission(Notification.permission), 2000)
    }

    evaluate()
    window.addEventListener(FIRST_RUN_EVENT, evaluate)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener(FIRST_RUN_EVENT, evaluate)
    }
  }, [user?.id, pathname])

  const dismiss = () => {
    if (user?.id) {
      try { localStorage.setItem(getSeenKey(user.id), '1') } catch {}
    }
    setPermission(null)
  }

  const enable = async () => {
    if (!user?.id) return
    setBusy(true)
    try {
      const result = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission)
      if (result === 'granted') await initMessaging(user.id)
    } catch (e) {
      console.error('❌ Error enabling notifications:', e)
    } finally {
      setBusy(false)
      dismiss()
    }
  }

  if (!permission || permission === 'granted') return null

  const denied = permission === 'denied'

  return (
    <div className="fixed bottom-24 md:bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-[--bg-card] border border-[--border-base] rounded-2xl shadow-card p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0 mt-0.5">{denied ? '🔕' : '🔔'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[--text-base]">
              {denied ? 'Notifiche bloccate' : 'Vuoi attivare le notifiche?'}
            </p>
            <p className="text-xs text-[--text-muted] mt-0.5">
              {denied
                ? 'Hai bloccato le notifiche in precedenza. Per riattivarle, vai nelle impostazioni del browser e consenti le notifiche per questa app.'
                : 'Ti avvisiamo quando nella tua fattoria ci sono nuovi eventi, sondaggi o spese.'}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm border border-[--border-base]
              bg-[--bg-subtle] text-[--text-muted] hover:bg-[--bg-raised] transition-colors"
          >
            {denied ? 'Ho capito' : 'Non ora'}
          </button>
          {!denied && (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {busy ? 'Attivazione…' : 'Attiva'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
