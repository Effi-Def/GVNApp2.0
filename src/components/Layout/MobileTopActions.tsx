import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useNotificationsStore } from '../../stores/useNotificationsStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { notificationService } from '../../services/notifications'
import { useActiveFarmStore } from '../../stores/useActiveFarmStore'
import { useFarmContext } from '../../contexts/FarmContext'

const MobileTopActions = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const unread = useNotificationsStore(s => s.notifications.filter(n => !n.read && (n.type !== 'chat' || !!n.chatMention)).length)

  const farms = useActiveFarmStore(s => s.farms)
  const activeFarmId = useActiveFarmStore(s => s.activeFarmId)
  const setActiveFarmId = useActiveFarmStore(s => s.setActiveFarmId)
  const switching = useActiveFarmStore(s => s.switching)
  const { activeFarm } = useFarmContext()
  const [farmOpen, setFarmOpen] = useState(false)

  const farmOptions = useMemo(() => {
    const list = Array.isArray(farms) ? farms : []
    return list
      .map(f => ({ id: f.id, name: f.name || 'Gruppo' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [farms])

  return (
    <>
      {/* LEFT: farm name / switcher */}
      {user?.id && activeFarm && (
        <div className="md:hidden fixed top-4 left-4 z-30">
          {farmOptions.length > 1 ? (
            <button
              type="button"
              className="rounded-xl bg-white/90 backdrop-blur border border-[--border-base] shadow px-3 py-2 hover:scale-105 transition flex items-center gap-1 max-w-[160px] disabled:opacity-70 disabled:cursor-wait"
              title="Cambia gruppo"
              aria-label="Cambia gruppo"
              onClick={() => !switching && setFarmOpen(true)}
              disabled={switching}
            >
              {switching
                ? <><span className="text-xs font-semibold text-[--text-muted] truncate">Caricamento...</span><span className="text-[10px] shrink-0 animate-spin">⏳</span></>
                : <><span className="text-xs font-semibold text-[--text-base] truncate">{activeFarm.name}</span><span className="text-[--text-muted] text-[10px] shrink-0">▾</span></>}
            </button>
          ) : (
            <span className="rounded-xl bg-white/90 backdrop-blur border border-[--border-base] shadow px-3 py-2 text-xs font-semibold text-[--text-base] truncate max-w-[160px] block">
              {switching ? 'Caricamento...' : activeFarm.name}
            </span>
          )}

          {farmOpen && farmOptions.length > 1 && (
            <div className="fixed inset-0 z-[70]">
              <button
                type="button"
                className="absolute inset-0 bg-black/30"
                onClick={() => setFarmOpen(false)}
                aria-label="Chiudi"
              />
              <div className="absolute left-1/2 top-24 -translate-x-1/2 w-[360px] max-w-[92vw] bg-[--bg-card] rounded-2xl border border-[--border-base] shadow-xl p-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <div className="font-semibold text-[--text-base]">Gruppi</div>
                  <button type="button" className="text-sm text-[--text-muted] hover:text-[--text-base]" onClick={() => setFarmOpen(false)}>Chiudi</button>
                </div>
                <div className="mt-2 space-y-1">
                  {farmOptions.map((o) => {
                    const active = o.id === activeFarmId
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm ${
                          active
                            ? 'border-primary-200 bg-primary-50 text-primary-800'
                            : 'border-[--border-base] hover:bg-[--bg-subtle] text-[--text-base]'
                        }`}
                        onClick={async () => {
                          setFarmOpen(false)
                          await setActiveFarmId({ userId: user.id, farmId: o.id })
                        }}
                      >
                        <span className="truncate">{o.name}</span>
                        {active && <span className="text-xs font-semibold">Attivo</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RIGHT: action icons */}
      <div className="md:hidden fixed top-4 right-4 z-30 flex items-center gap-3">
      <Link
        to="/events?create=1"
        className="rounded-xl bg-primary-600 text-white shadow px-3 py-2 hover:bg-primary-700 transition-colors"
        title="Organizza evento"
        aria-label="Organizza evento"
      >
        <span className="text-sm font-semibold">Organizza</span>
      </Link>
      {/* Notifications (pig) */}
      <Link
        to="/notifications"
        className="relative rounded-xl bg-white/90 backdrop-blur border border-[--border-base] shadow px-2.5 py-1.5 text-2xl hover:scale-105 transition"
        title="Notifiche"
        aria-label="Notifiche"
        onClick={(e) => {
          e.preventDefault()
          const isOnNotifications = location.pathname === '/notifications'
          if (isOnNotifications) {
            if (window.history.length > 1) navigate(-1)
            else navigate('/')
          } else {
            // Prefer opening latest unread chat mention directly
            try {
              const { notifications, markAsRead } = useNotificationsStore.getState()
              const mention = notifications
                .filter(n => !n.read && n.type === 'chat' && !!n.chatMention && !!n.actionUrl)
                .sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0))[0]
              if (mention?.actionUrl) {
                try { markAsRead(mention.id) } catch {}
                try { if (user?.id) notificationService.markAsRead(user.id, mention.id) } catch {}
                navigate(mention.actionUrl)
                return
              }
            } catch {
              // no-op
            }
            navigate('/notifications')
          }
        }}
      >
        <span aria-hidden>🐷</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>

      {/* Settings (gear) */}
      <Link
        to="/settings"
        className="rounded-xl bg-white/90 backdrop-blur border border-[--border-base] shadow p-2 hover:scale-105 transition"
        title="Impostazioni"
        aria-label="Impostazioni"
        onClick={(e) => {
          e.preventDefault()
          const isOnSettings = location.pathname === '/settings'
          if (isOnSettings) {
            if (window.history.length > 1) navigate(-1)
            else navigate('/')
          } else {
            navigate('/settings')
          }
        }}
      >
        <svg className="w-6 h-6 text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a1 1 0 012 0v1.09a7.007 7.007 0 012.326.96l.77-.771a1 1 0 111.414 1.415l-.77.77c.39.707.676 1.478.84 2.29H20a1 1 0 110 2h-1.09a7.007 7.007 0 01-.96 2.326l.771.77a1 1 0 11-1.415 1.414l-.77-.77a7.007 7.007 0 01-2.29.84V20a1 1 0 11-2 0v-1.09a7.007 7.007 0 01-2.326-.96l-.77.771a1 1 0 11-1.414-1.415l.77-.77a7.007 7.007 0 01-.84-2.29H4a1 1 0 110-2h1.09a7.007 7.007 0 01.96-2.326l-.771-.77a1 1 0 111.415-1.414l.77.77A7.007 7.007 0 019.29 5.09V4zM12 9a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
      </Link>
    </div>
    </>
  )
}

export default MobileTopActions

