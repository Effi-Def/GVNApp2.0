import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useNotificationsStore } from '../../stores/useNotificationsStore'
import { markChatNotificationsAsRead } from '../../services/notifications'
import { useAppStore } from '../../stores/AppStore'
import { useDarkMode } from '../../hooks/useDarkMode'

/** Angle spread (degrees, 0 = straight up) for each count of FAB actions */
const ANGLE_MAP: Record<number, number[]> = {
  1: [0],
  2: [-38, 38],
  3: [-55, 0, 55],
  4: [-65, -22, 22, 65],
}

const BottomNavigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const unreadChat = useNotificationsStore(s => s.notifications.filter(n => !n.read && n.type === 'chat').length)
  const [moreOpen, setMoreOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const { isDark, toggle: toggleDark } = useDarkMode()

  const events = useAppStore(s => s.events)

  const hasUserEvents = useMemo(() => {
    if (!user?.id) return false
    const uid = user.id
    return (events || []).some(e =>
      e.createdBy === uid ||
      (e.participants || []).some(p => p.userId === uid)
    )
  }, [events, user?.id])

  const fabActions = useMemo(() => {
    const all = [
      { icon: '📅', label: 'Evento',    to: '/events?create=1',   always: true  },
      { icon: '🗳️', label: 'Sondaggio', to: '/polls?create=1',    always: false },
      { icon: '📋', label: 'Lista',     to: '/lists?create=1',    always: false },
      { icon: '💰', label: 'Spesa',     to: '/expenses?create=1', always: false },
    ]
    return all.filter(a => a.always || hasUserEvents)
  }, [hasUserEvents])


  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-t border-[--border-base] dark:border-neutral-800 z-50 shadow-2xl">
      <div className="safe-area-inset-bottom">
        <div className="grid grid-cols-5 h-20 px-2">
          {/* Home */}
          <Link
            to="/"
            className={`flex h-full w-full flex-col items-center justify-center space-y-1 rounded-2xl transition-all duration-200 ${
              location.pathname === '/'
                ? 'text-primary-600 bg-primary-50'
                : 'text-[--text-muted] hover:text-primary-600 hover:bg-[--bg-subtle]'
            }`}
          >
            <span className={`text-xl transition-transform ${location.pathname === '/' ? 'scale-110' : ''}`}>🏠</span>
            <span className={`text-xs font-medium ${location.pathname === '/' ? 'text-primary-600 font-semibold' : 'text-[--text-muted]'}`}>Home</span>
          </Link>

          {/* Gruppo */}
          <Link
            to="/farm"
            className={`flex h-full w-full flex-col items-center justify-center space-y-1 rounded-2xl transition-all duration-200 ${
              location.pathname === '/farm'
                ? 'text-primary-600 bg-primary-50'
                : 'text-[--text-muted] hover:text-primary-600 hover:bg-[--bg-subtle]'
            }`}
          >
            <span className={`text-xl transition-transform ${location.pathname === '/farm' ? 'scale-110' : ''}`}>👥</span>
            <span className={`text-xs font-medium ${location.pathname === '/farm' ? 'text-primary-600 font-semibold' : 'text-[--text-muted]'}`}>Gruppo</span>
          </Link>

          {/* FAB — radial speed-dial */}
          <div className="relative flex items-center justify-center">

            {/* Backdrop */}
            {fabOpen && (
              <button
                type="button"
                className="fixed inset-0 z-[45] bg-black/30 backdrop-blur-[2px]"
                onClick={() => setFabOpen(false)}
                aria-label="Chiudi menu"
              />
            )}

            {/* Radial action items */}
            {fabOpen && fabActions.map((action, i) => {
              const angles = ANGLE_MAP[fabActions.length] ?? [0]
              const deg = angles[i] ?? 0
              const rad = deg * Math.PI / 180
              const r = 90
              const xPx = r * Math.sin(rad)
              const yPx = r * Math.cos(rad)
              return (
                <button
                  key={action.label}
                  type="button"
                  className="fixed z-[47] flex flex-col items-center gap-1"
                  style={{
                    bottom: `calc(40px + ${yPx}px)`,
                    left: `calc(50% + ${xPx}px)`,
                    transform: 'translateX(-50%)',
                  }}
                  onClick={() => { setFabOpen(false); navigate(action.to) }}
                  aria-label={action.label}
                >
                  <span className="w-12 h-12 rounded-full bg-[--bg-card] shadow-xl border border-[--border-base] flex items-center justify-center text-xl">
                    {action.icon}
                  </span>
                  <span className="text-[10px] font-semibold text-[--text-base] whitespace-nowrap bg-white/95 rounded-full px-2 py-0.5 shadow-sm border border-neutral-100">
                    {action.label}
                  </span>
                </button>
              )
            })}

            {/* FAB button */}
            <button
              type="button"
              onClick={() => { setMoreOpen(false); setFabOpen(o => !o) }}
              className={`w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-lg hover:bg-neutral-700 active:scale-95 text-2xl z-[47] relative transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
              aria-label={fabOpen ? 'Chiudi menu azioni' : 'Apri menu azioni'}
            >
              +
            </button>
          </div>

          {/* Chat */}
          <button
            type="button"
            onClick={async () => {
              setFabOpen(false)
              try { useNotificationsStore.getState().markTypeAsRead('chat') } catch {}
              try { if (useAuthStore.getState().user?.id) await markChatNotificationsAsRead(useAuthStore.getState().user!.id) } catch {}
              navigate('/chats')
            }}
            className={`relative flex h-full w-full flex-col items-center justify-center space-y-1 rounded-2xl transition-all duration-200 ${
              location.pathname === '/chats' || location.pathname.startsWith('/chats/')
                ? 'text-primary-600 bg-primary-50'
                : 'text-[--text-muted] hover:text-primary-600 hover:bg-[--bg-subtle]'
            }`}
          >
            <span className="relative inline-block">
              <span className={`text-xl transition-transform inline-block ${location.pathname === '/chats' || location.pathname.startsWith('/chats/') ? 'scale-110' : ''}`}>💬</span>
              {unreadChat > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] leading-4 text-center font-bold shadow">
                  {unreadChat > 9 ? '9+' : unreadChat}
                </span>
              )}
            </span>
            <span className={`text-xs font-medium ${location.pathname === '/chats' || location.pathname.startsWith('/chats/') ? 'text-primary-600 font-semibold' : 'text-[--text-muted]'}`}>Chat</span>
          </button>

          {/* Altro (Chat, Notifiche, Impostazioni, Esci) */}
          <button
            onClick={() => { setFabOpen(false); setMoreOpen(o => !o) }}
            className={`flex h-full w-full flex-col items-center justify-center space-y-1 rounded-2xl transition-all duration-200 ${
              moreOpen ? 'text-primary-600 bg-primary-50' : 'text-[--text-muted] hover:text-primary-600 hover:bg-[--bg-subtle]'
            }`}
          >
            <span className="text-xl">⋯</span>
            <span className="text-xs">Altro</span>
          </button>
          {moreOpen && (
            <div className="absolute bottom-24 right-4 left-4 bg-[--bg-card] dark:bg-neutral-800 border border-[--border-base] dark:border-neutral-700 rounded-2xl shadow-xl p-2">
              <button onClick={() => { setMoreOpen(false); navigate('/events') }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-[--bg-subtle] dark:hover:bg-neutral-700 dark:text-neutral-100">📅 Eventi</button>
              <button onClick={() => { setMoreOpen(false); navigate('/notifications') }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-[--bg-subtle] dark:hover:bg-neutral-700 dark:text-neutral-100">🔔 Notifiche</button>
              <button onClick={() => { setMoreOpen(false); navigate('/settings') }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-[--bg-subtle] dark:hover:bg-neutral-700 dark:text-neutral-100">⚙️ Impostazioni</button>
              <button
                onClick={() => { toggleDark(); setMoreOpen(false) }}
                className="w-full text-left px-3 py-3 rounded-xl hover:bg-[--bg-subtle] dark:hover:bg-neutral-700 dark:text-neutral-100"
              >
                {isDark ? '☀️ Modalità chiara' : '🌙 Modalità scura'}
              </button>
              <button onClick={async () => { setMoreOpen(false); await logout() }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">🚪 Esci</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default BottomNavigation

