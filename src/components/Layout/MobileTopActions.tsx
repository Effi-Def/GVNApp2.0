import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useNotificationsStore } from '../../stores/useNotificationsStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { notificationService } from '../../services/notifications'

const MobileTopActions = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const unread = useNotificationsStore(s => s.notifications.filter(n => !n.read && (n.type !== 'chat' || !!n.chatMention)).length)
  return (
    <div className="md:hidden fixed top-3 right-3 z-50 flex items-center gap-2">
      {/* Notifications (pig) */}
      <Link
        to="/notifications"
        className="relative rounded-xl bg-white/90 backdrop-blur border border-neutral-200 shadow px-2.5 py-1.5 text-2xl hover:scale-105 transition"
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
        className="rounded-xl bg-white/90 backdrop-blur border border-neutral-200 shadow p-2 hover:scale-105 transition"
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
        <svg className="w-6 h-6 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a1 1 0 012 0v1.09a7.007 7.007 0 012.326.96l.77-.771a1 1 0 111.414 1.415l-.77.77c.39.707.676 1.478.84 2.29H20a1 1 0 110 2h-1.09a7.007 7.007 0 01-.96 2.326l.771.77a1 1 0 11-1.415 1.414l-.77-.77a7.007 7.007 0 01-2.29.84V20a1 1 0 11-2 0v-1.09a7.007 7.007 0 01-2.326-.96l-.77.771a1 1 0 11-1.414-1.415l.77-.77a7.007 7.007 0 01-.84-2.29H4a1 1 0 110-2h1.09a7.007 7.007 0 01.96-2.326l-.771-.77a1 1 0 111.415-1.414l.77.77A7.007 7.007 0 019.29 5.09V4zM12 9a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
      </Link>
    </div>
  )
}

export default MobileTopActions
