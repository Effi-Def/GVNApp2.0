import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { PigAvatar } from '../Avatar/PigAvatar'
import { useUserSettingsStore } from '../../stores/UserSettingsStore'
import { useNotificationsStore } from '../../stores/useNotificationsStore'
import { markChatNotificationsAsRead } from '../../services/notifications'
import { notificationService } from '../../services/notifications'
import FarmSwitcher from '../FarmSwitcher'
import { useDarkMode } from '../../hooks/useDarkMode'

const Navbar = () => {
  const location = useLocation()
  const { user } = useAuthStore()
  const { profile } = useUserSettingsStore()
  const unread = useNotificationsStore(s => s.notifications.filter(n => !n.read && (n.type !== 'chat' || !!n.chatMention)).length)
  const unreadChat = useNotificationsStore(s => s.notifications.filter(n => !n.read && n.type === 'chat').length)
  const navigate = useNavigate()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const preferredName = (profile?.displayName && profile.displayName.trim().length > 0)
    ? profile.displayName
    : ((user?.displayName && user.displayName !== 'Utente') ? user.displayName : (user?.email ? user.email.split('@')[0] : 'Utente'))

  const navigation = [
    { name: 'Home', href: '/', emoji: '🏠' },
    { name: 'Fattoria', href: '/farm', emoji: '🚜' },
    { name: 'Eventi', href: '/events', emoji: '📅' },
    { name: 'Spese', href: '/expenses', emoji: '💰' },
    { name: 'Sondaggi', href: '/polls', emoji: '🗳️' },
    { name: 'Liste', href: '/lists', emoji: '📋' },
  ]
  const isActive = (href: string) => href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)

  // Logout is available in the mobile "Altro" menu; not exposed in top navbar

  return (
    <nav className="bg-[--bg-card] shadow-lg border-b border-[--border-base] fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo con mascotte */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3 group transition-transform hover:scale-105">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg">
                <span className="text-white font-bold text-lg font-display">G</span>
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-xl font-bold font-display text-[--text-base] tracking-tight">GVNApp</span>
              </div>
              {/* Piccola mascotte */}
              <span className="hidden lg:inline text-lg group-hover:animate-bounce transition-transform">
                <PigAvatar keyName={(profile?.avatarKey as any) || 'pig-0'} />
              </span>
            </Link>
          </div>

          {/* Navigation Links - Centrata */}
          <div className="flex items-center gap-1 bg-[--bg-subtle] rounded-2xl p-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                title={item.name}
                aria-label={item.name}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`flex flex-col items-center justify-center min-w-[2.75rem] lg:min-w-[4rem] px-1.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  isActive(item.href)
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-[--text-muted] hover:text-primary-600 hover:bg-[--bg-card]'
                }`}
              >
                <span className="text-base leading-5" aria-hidden>{item.emoji}</span>
                <span className="hidden lg:block">{item.name}</span>
              </Link>
            ))}
          </div>

          {/* User Menu - Redesigned */}
          <div className="flex items-center gap-1 lg:gap-2">
            {/* Primary action */}
            <button
              type="button"
              onClick={() => navigate('/events?create=1')}
              className="hidden lg:inline-flex items-center px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
              title="Organizza un evento"
            >
              Organizza
            </button>
            <FarmSwitcher />
            {/* � Chats icon */}
            <Link
              to="/chats"
              className="p-2 text-[--text-muted] hover:text-[--text-base] hover:bg-[--bg-raised] rounded-lg transition-colors"
              title="Chat"
              aria-label="Chat"
              onClick={async (e) => {
                e.preventDefault()
                // Clear only chat badges when user opens chats
                try { useNotificationsStore.getState().markTypeAsRead('chat') } catch {}
                try { if (user?.id) await markChatNotificationsAsRead(user.id) } catch {}
                navigate('/chats')
              }}
            >
              <span className="relative inline-block">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-9 7l2.5-2.5A9 9 0 1121 12a9 9 0 01-9 9H4z" />
                </svg>
                {unreadChat > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[16px] text-center font-bold shadow">
                    {unreadChat > 9 ? '9+' : unreadChat}
                  </span>
                )}
              </span>
            </Link>
            {/* �🔔 Notifiche (pig) always visible on all sizes */}
            <Link
              to="/notifications"
              className="relative p-2 text-2xl hover:scale-110 transition-transform"
              title="Notifiche"
              aria-label="Notifiche"
              onClick={(e) => {
                e.preventDefault()
                const { markAsRead } = useNotificationsStore.getState()
                const isOnNotifications = location.pathname === '/notifications'
                if (isOnNotifications) {
                  // Toggle back to the page that opened notifications
                  if (window.history.length > 1) navigate(-1)
                  else navigate('/')
                } else {
                  // If there is an unread @mention, open it directly (chat) instead of the notifications list.
                  try {
                    const all = useNotificationsStore.getState().notifications
                    const mention = all
                      .filter(n => !n.read && n.type === 'chat' && !!n.chatMention && !!n.actionUrl)
                      .sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0))[0]
                    if (mention?.actionUrl) {
                      try { markAsRead(mention.id) } catch {}
                      try { if (user?.id) notificationService.markAsRead(user.id, mention.id) } catch {}
                      navigate(mention.actionUrl)
                      return
                    }
                  } catch {}
                  navigate('/notifications')
                }
              }}
            >
              <span aria-hidden>🐷</span>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            {/* 🌙 Dark mode toggle */}
            <button
              type="button"
              onClick={toggleDark}
              className="p-2 text-[--text-muted] hover:text-[--text-base] hover:bg-[--bg-raised] rounded-lg transition-colors"
              title={isDark ? 'Modalità chiara' : 'Modalità scura'}
              aria-label={isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'}
            >
              {isDark
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 100 18A9 9 0 0012 3zm0 2a7 7 0 110 14A7 7 0 0112 5zm0 1a6 6 0 100 12A6 6 0 0012 6z"/><path d="M12 2V1M12 23v-1M4.22 4.22l-.71-.71M20.49 20.49l-.71-.71M1 12H2M22 12h1M4.22 19.78l-.71.71M20.49 3.51l-.71.71"/></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
              }
            </button>
            {/* ⚙️ Settings next to pig (visible on all sizes) */}
            <Link
              to="/settings"
              className="p-2 text-[--text-muted] hover:text-[--text-base] hover:bg-[--bg-raised] rounded-lg transition-colors"
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
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a1 1 0 012 0v1.09a7.007 7.007 0 012.326.96l.77-.771a1 1 0 111.414 1.415l-.77.77c.39.707.676 1.478.84 2.29H20a1 1 0 110 2h-1.09a7.007 7.007 0 01-.96 2.326l.771.77a1 1 0 11-1.415 1.414l-.77-.77a7.007 7.007 0 01-2.29.84V20a1 1 0 11-2 0v-1.09a7.007 7.007 0 01-2.326-.96l-.77.771a1 1 0 11-1.414-1.415l.77-.77a7.007 7.007 0 01-.84-2.29H4a1 1 0 110-2h1.09a7.007 7.007 0 01.96-2.326l-.771-.77a1 1 0 111.415-1.414l.77.77A7.007 7.007 0 019.29 5.09V4zM12 9a3 3 0 100 6 3 3 0 000-6z" />
              </svg>
            </Link>

            {/* User pill (hide on xs to free space) */}
            <div className="hidden xl:flex items-center space-x-3 bg-[--bg-subtle] rounded-2xl p-2 pr-4">
              {user?.photoURL && (
                <img
                  className="h-10 w-10 rounded-xl border-2 border-white shadow-sm"
                  src={user.photoURL}
                  alt={preferredName}
                />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[--text-base] truncate max-w-32" title={preferredName}>
                  {preferredName}
                </span>
                <span className="text-xs text-[--text-muted]">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

