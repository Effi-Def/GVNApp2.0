/**
 * NotificationPermissionBanner
 *
 * Appare solo se il permesso notifiche è stato esplicitamente NEGATO dal browser.
 * In quel caso non possiamo chiederlo di nuovo in JS: indirizziamo l'utente
 * alle impostazioni del browser con un messaggio chiaro.
 *
 * Se il permesso è 'default', App.tsx lo richiede automaticamente al login.
 * Storage key: 'gvn-notif-denied-banner-seen:{userId}' (per-utente)
 */

import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'

// La chiave include l'userId per isolare il dismiss su dispositivi condivisi.
const getSeenKey = (userId: string) => `gvn-notif-denied-banner-seen:${userId}`

export default function NotificationPermissionBanner() {
  const [visible, setVisible] = useState(false)
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user?.id) return
    const SEEN_KEY = getSeenKey(user.id)
    try { if (localStorage.getItem(SEEN_KEY)) return } catch {}
    if (typeof Notification === 'undefined') return
    // Mostra solo se il permesso è stato negato esplicitamente
    if (Notification.permission !== 'denied') return
    const t = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(t)
  }, [user?.id])

  const dismiss = () => {
    if (user?.id) {
      try { localStorage.setItem(getSeenKey(user.id), '1') } catch {}
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-[--bg-card] border border-[--border-base] rounded-2xl shadow-card p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0 mt-0.5">🔕</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[--text-base]">
              Notifiche bloccate
            </p>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Hai bloccato le notifiche in precedenza. Per riattivarle, vai nelle impostazioni del browser e consenti le notifiche per questa app.
            </p>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2 rounded-xl text-sm border border-[--border-base]
              bg-[--bg-subtle] text-[--text-muted] hover:bg-[--bg-raised] transition-colors"
          >
            Ho capito
          </button>
        </div>
      </div>
    </div>
  )
}

